'use strict';
process.env.UPLOADS_ROOT = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'vxin-p0-uploads-'));
const { request, app, makeUser } = require('./helpers');
const { db } = require('../src/db/connection');
const config = require('../src/config');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const auth = require('../src/modules/auth/auth.service');
const admin = require('../src/modules/admin/admin.service');
const moments = require('../src/modules/moments/moments.service');
const packets = require('../src/modules/redpackets/redpackets.service');
const wallet = require('../src/modules/wallet/wallet.service');
const { purgeConversation } = require('../src/modules/messages/shared');
const { uploadsCacheMiddleware } = require('../src/integrations/cdnOptimizer');

function conversation(users) {
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO conversations (id,type,owner_id) VALUES (?,'group',?)").run(id, users[0].userId);
  for (const u of users) db.prepare('INSERT INTO conversation_members (conversation_id,user_id,role) VALUES (?,?,?)')
    .run(id, u.userId, u === users[0] ? 'owner' : 'member');
  return id;
}

let a, b, c;
beforeAll(async () => { a = await makeUser(); b = await makeUser(); c = await makeUser(); });

test('P0-01 warm-user rejects another user and omits password from own result', async () => {
  app.set('cacheWarmer', new (require('../src/utils/cacheWarmer'))());
  const other = await request(app).post('/api/optimization/cache/warm-user').auth(a.token, { type: 'bearer' }).send({ userId: b.userId });
  expect(other.status).toBe(403);
  const own = await request(app).post('/api/optimization/cache/warm-user').auth(a.token, { type: 'bearer' }).send({ userId: a.userId });
  expect(own.status).toBe(200);
  expect(own.body.result.user.id).toBe(a.userId);
  expect(own.body.result.user).not.toHaveProperty('password');
  expect(own.body.result.user).not.toHaveProperty('invite_code');
});

test('P0-02 deleting a moment never unlinks client supplied attachments', () => {
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO moments (id,user_id,content,images) VALUES (?,?,?,?)').run(id, a.userId, 'x', '["/uploads/files/victim.pdf"]');
  const unlink = jest.spyOn(fs, 'unlink').mockImplementation((p, cb) => cb && cb());
  try { moments.deleteMoment(a.userId, id); expect(unlink).not.toHaveBeenCalled(); }
  finally { unlink.mockRestore(); }
});

test('P0-03 password change revokes trusted wallets and same-second old JWT', async () => {
  const u = await makeUser();
  auth.recordDeviceAccount('p0-wallet', u.userId);
  const token = await auth.changePassword(u.userId, { oldPassword: u.password, newPassword: 'Newpass123', currentToken: u.token });
  expect(() => auth.switchAccount('p0-wallet', u.userId)).toThrow();
  expect((await request(app).get('/api/auth/me').auth(u.token, { type: 'bearer' })).status).toBe(401);
  expect((await request(app).get('/api/auth/me').auth(token, { type: 'bearer' })).status).toBe(200);
});

test('P0-03 deleting a session revokes its trusted wallet', async () => {
  const u = await makeUser();
  auth.recordDeviceAccount('p0-kick-wallet', u.userId);
  auth.upsertSession(u.userId, { headers: { 'user-agent': 'Android' }, cookies: { [config.walletCookie]: 'p0-kick-wallet' } }, u.token);
  const s = db.prepare("SELECT id FROM user_sessions WHERE user_id=? AND platform='Android'").get(u.userId);
  await auth.deleteSession(u.userId, s.id);
  expect(() => auth.switchAccount('p0-kick-wallet', u.userId)).toThrow();
});

test('P0-04 expired JWT cannot revive through refresh after blacklist expiry', async () => {
  const token = jwt.sign({ id: a.userId, username: a.username, csrf: 'p0', authVersion: 1, exp: Math.floor(Date.now()/1000)-1 }, config.jwtSecret);
  expect((await request(app).post('/api/auth/refresh').auth(token, { type: 'bearer' })).status).toBe(401);
});

test('P0-06 deleting a conversation refunds once and retains settlement facts', async () => {
  const cid = conversation([a, b]);
  wallet.applyDelta(a.userId, 100, 'test_seed');
  const { packetId } = await packets.send(null, a.userId, { conversationId: cid, totalAmount: 100, totalCount: 2 });
  const { amount } = packets.claim(null, b.userId, packetId);
  const before = wallet.getBalance(a.userId);
  purgeConversation(cid);
  expect(wallet.getBalance(a.userId)).toBe(before + 100 - amount);
  expect(db.prepare('SELECT amount FROM red_packet_claims WHERE packet_id=?').get(packetId).amount).toBe(amount);
  expect(db.prepare('SELECT status FROM red_packets WHERE id=?').get(packetId).status).toBe('expired');
  purgeConversation(cid);
  expect(wallet.getBalance(a.userId)).toBe(before + 100 - amount);
});

test('P0-06 admin deleting a claimer cannot increase remaining payout', async () => {
  const u = await makeUser();
  const cid = conversation([a, u, c]);
  wallet.applyDelta(a.userId, 100, 'test_seed');
  const { packetId } = await packets.send(null, a.userId, { conversationId: cid, totalAmount: 100, totalCount: 2 });
  const first = packets.claim(null, u.userId, packetId).amount;
  admin.deleteUser(null, u.userId);
  expect(db.prepare('SELECT amount FROM red_packet_claims WHERE packet_id=? AND user_id=?').get(packetId, u.userId).amount).toBe(first);
  expect(packets.claim(null, c.userId, packetId).amount).toBe(100 - first);
  expect(wallet.getBalance(u.userId)).toBe(first);
});

test('P0-07 cache layer preserves private/no-store', () => {
  const headers = {};
  const res = { setHeader: (k, v) => { headers[k.toLowerCase()] = v; } };
  uploadsCacheMiddleware({ path: '/files/test.pdf' }, res, () => {});
  res.setHeader('Cache-Control', 'private, no-store');
  expect(headers['cache-control']).toBe('private, no-store');
});

test('P0-07 unrelated user is denied a known attachment before static serving', async () => {
  const cid = conversation([a, b]);
  const url = `/uploads/files/${crypto.randomUUID()}.pdf`;
  db.prepare("INSERT INTO messages (id,conversation_id,sender_id,type,file_url,content) VALUES (?,?,?,?,?,'file')")
    .run(crypto.randomUUID(), cid, a.userId, 'file', url);
  expect((await request(app).get(url).auth(c.token, { type: 'bearer' })).status).toBe(403);
  // Authorized caller reaches static middleware: this synthetic path has no bytes.
  expect((await request(app).get(url).auth(b.token, { type: 'bearer' })).status).toBe(404);
});

test('P0-03 device grant expires server-side and admin reset revokes it', async () => {
  const u = await makeUser();
  auth.recordDeviceAccount('p0-expired', u.userId);
  db.prepare('UPDATE device_accounts SET created_at=? WHERE wallet_id=?').run(Math.floor(Date.now()/1000)-config.walletMaxAge-1, 'p0-expired');
  expect(() => auth.switchAccount('p0-expired', u.userId)).toThrow();
  auth.recordDeviceAccount('p0-admin-reset', u.userId);
  await admin.resetPassword(null, u.userId, 'Changed123');
  expect(() => auth.switchAccount('p0-admin-reset', u.userId)).toThrow();
});

test('P0-03 all JWTs from repeated device logins are revoked, other device stays valid', async () => {
  const u = await makeUser();
  const login = async ua => (await request(app).post('/api/auth/login').set('User-Agent', ua).send({ phone: u.phone, password: u.password })).body.token;
  const t1 = await login('Windows');
  const t2 = await login('Windows');
  const current = await login('Android');
  await auth.deleteAllOtherSessions(u.userId, 'Android 手机', 'Android');
  for (const token of [t1, t2]) expect((await request(app).get('/api/auth/me').auth(token, { type: 'bearer' })).status).toBe(401);
  expect((await request(app).get('/api/auth/me').auth(current, { type: 'bearer' })).status).toBe(200);
});

test('P0-07 moment URL cannot grant access to another user private image', async () => {
  const { canAccessUpload } = require('../src/utils/uploadAccess');
  const url = `/uploads/moments/${crypto.randomUUID()}.png`;
  db.prepare('INSERT INTO upload_owners (path,user_id) VALUES (?,?)').run(url, a.userId);
  const moment = moments.createMoment(null, a.userId, { content: 'private', images: [url], visibility: 'private' });
  expect(canAccessUpload(a.userId, url)).toBe(true);
  expect(canAccessUpload(b.userId, url)).toBe(false);
  expect(() => moments.createMoment(null, b.userId, { content: 'steal', images: [url] })).toThrow();
  expect((await request(app).post('/api/stickers/collect').auth(b.token, { type: 'bearer' }).send({ url })).status).toBe(403);
  moments.deleteMoment(a.userId, moment.id);
});

test('P0-07 HTTP GET/HEAD/Range obey membership and retraction; cache never becomes public', async () => {
  const path = require('path');
  const { dir, url, filename } = (() => {
    const dir = path.join(config.uploadsRoot, 'files');
    const name = `${crypto.randomUUID()}.pdf`;
    return { dir, url: '/uploads/files/' + name, filename: path.join(dir, name) };
  })();
  if (!config.uploadsRoot.startsWith(require('os').tmpdir() + path.sep)) throw new Error('Test uploads must be isolated');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filename, '%PDF-1.4 test content');
  try {
    const cid = conversation([a, b]);
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO messages (id,conversation_id,sender_id,type,file_url,content) VALUES (?,?,?,'file',?,'pdf')").run(id, cid, a.userId, url);
    const get = await request(app).get(url).auth(b.token, { type: 'bearer' });
    expect(get.status).toBe(200);
    expect(get.headers['cache-control']).toBe('private, no-store');
    expect((await request(app).head(url).auth(c.token, { type: 'bearer' })).status).toBe(403);
    expect((await request(app).get(url).set('Range', 'bytes=0-3').auth(c.token, { type: 'bearer' })).status).toBe(403);
    const range = await request(app).get(url).set('Range', 'bytes=0-3').auth(b.token, { type: 'bearer' });
    expect(range.status).toBe(206);
    db.prepare('DELETE FROM conversation_members WHERE conversation_id=? AND user_id=?').run(cid, b.userId);
    expect((await request(app).get(url).auth(b.token, { type: 'bearer' })).status).toBe(403);
    db.prepare("UPDATE messages SET deleted=2, file_url='' WHERE id=?").run(id);
    expect((await request(app).get(url).auth(a.token, { type: 'bearer' })).status).toBe(403);
  } finally { fs.unlinkSync(filename); }
});

test('P0-03 legacy JWT rollback stays compatible, but cannot undo a real password revocation', async () => {
  const u = await makeUser();
  const url = `/uploads/avatars/${crypto.randomUUID()}.png`;
  db.prepare('INSERT INTO upload_owners (path,user_id) VALUES (?,?)').run(url, u.userId);
  const issuedAt = Math.floor(Date.now() / 1000) - 60;
  async function check(expected) {
    for (const [method, route, allowed] of [['get', '/api/auth/me', 200], ['post', '/api/auth/refresh', 200], ['get', url, 404]]) {
      const token = jwt.sign({ id: u.userId, username: u.username, csrf: crypto.randomUUID(), iat: issuedAt }, config.jwtSecret, { expiresIn: config.tokenMaxAge });
      expect((await request(app)[method](route).auth(token, { type: 'bearer' })).status).toBe(expected || allowed);
    }
  }
  function timestamp(value) {
    db.prepare('UPDATE users SET password_changed_at=? WHERE id=?').run(value, u.userId);
    require('../src/utils/userStatusCache').invalidateUser(u.userId);
  }
  timestamp(Math.floor(Date.now() / 1000));
  await check(401);
  timestamp(0);
  await check();
  await auth.changePassword(u.userId, { oldPassword: u.password, newPassword: 'Changed123', currentToken: u.token });
  timestamp(0);
  await check(401);
});

test('P0-01 bulk cache warming requires an admin login', async () => {
  app.set('cacheWarmer', new (require('../src/utils/cacheWarmer'))());
  expect((await request(app).post('/api/optimization/cache/warm').auth(a.token, { type: 'bearer' })).status).toBe(401);
  const token = jwt.sign({ admin: true, csrf: crypto.randomUUID() }, config.adminJwtSecret, { expiresIn: 60 });
  expect((await request(app).post('/api/optimization/cache/warm').set('Cookie', `${config.admin.cookieName}=${token}`)).status).toBe(200);
});

test('P0-01 bulk warming never puts password, phone or invite code in the user cache', async () => {
  await new (require('../src/utils/cacheWarmer'))().warmActiveUsers();
  const cached = JSON.parse(await require('../src/utils/redis').redis.get(`user:${a.userId}`));
  expect(cached.id).toBe(a.userId);
  for (const field of ['password', 'phone', 'invite_code']) expect(cached).not.toHaveProperty(field);
});

test('P0-01 profile responses filter sensitive fields left in the cache by older warmers', async () => {
  const cache = require('../src/utils/cache');
  const key = cache.keys.user(b.userId);
  await cache.set(key, { id: b.userId, username: b.username, avatar: '', bio: '', cover_photo: '', password: 'old-cached-hash', phone: 'old-cached-phone', invite_code: 'old-cached-invite' });
  try {
    const result = await request(app).get(`/api/users/${b.userId}`).auth(a.token, { type: 'bearer' });
    expect(result.status).toBe(200);
    expect(result.body.id).toBe(b.userId);
    for (const field of ['password', 'phone', 'invite_code']) expect(result.body).not.toHaveProperty(field);
  } finally { await cache.del(key); }
});
