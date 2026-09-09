'use strict';
process.env.UPLOADS_ROOT = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'vxin-p0-uploads-'));
jest.mock('../src/utils/push', () => ({ pushCallInvite: jest.fn().mockResolvedValue(), pushToUser: jest.fn().mockResolvedValue() }));
const { request, app, makeUser } = require('./helpers');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const http = require('http');
const { db } = require('../src/db/connection');
const crypto = require('crypto');
const groups = require('../src/modules/groups/groups.service');
const groupCall = require('../src/realtime/handlers/groupCall');
const { revocations } = require('../src/utils/tokenBlacklist');
let server, io, port;
const clients = [];
beforeAll(async () => {
  server = http.createServer(app);
  io = new Server(server);
  app.set('io', io);
  require('../src/realtime')(io, app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});
afterAll(async () => {
  for (const c of clients) c.close();
  for (const call of groupCall._state.groupCalls.values()) clearTimeout(call.timer);
  await new Promise(resolve => io.close(resolve));
  app.set('io', null);
});

// Real Engine.IO websocket / Socket.IO framing, without a new socket.io-client dependency.
function connect(token, userAgent = 'Web') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`, { headers: { 'User-Agent': userAgent } });
    clients.push(ws);
    const timeout = setTimeout(() => reject(new Error('Socket connection timeout')), 3000);
    ws.on('error', reject);
    ws.on('message', bytes => {
      const msg = bytes.toString();
      if (msg[0] === '0') ws.send('40' + JSON.stringify({ token }));
      if (msg === '2') ws.send('3');
      if (msg.startsWith('44')) { clearTimeout(timeout); reject(new Error(msg)); ws.close(); }
      if (msg.startsWith('40')) {
        clearTimeout(timeout);
        const id = JSON.parse(msg.slice(2)).sid;
        resolve({ ws, socket: io.sockets.sockets.get(id) });
      }
    });
  });
}
function disconnected(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Revoked socket remained connected')), 3000);
    socket.once('disconnect', () => { clearTimeout(timeout); resolve(); });
  });
}

test('P0-05 logout persists revocation before disconnect and rejects reconnection', async () => {
  const u = await makeUser();
  const client = await connect(u.token);
  const done = disconnected(client.socket);
  let persistedAtEvent = false;
  const inspect = token => { if (token === u.token) persistedAtEvent = !!db.prepare('SELECT 1 FROM token_blacklist WHERE token=?').get(token); };
  revocations.on('token', inspect);
  try {
    expect((await request(app).post('/api/auth/logout').auth(u.token, { type: 'bearer' })).status).toBe(200);
    await done;
    expect(persistedAtEvent).toBe(true);
    await expect(connect(u.token)).rejects.toThrow();
  } finally { revocations.off('token', inspect); }
});

test.each(['change-password', 'delete-account'])('P0-05 %s disconnects all existing sockets', async route => {
  const u = await makeUser();
  const x = await connect(u.token);
  const y = await connect(u.token);
  const done = Promise.all([disconnected(x.socket), disconnected(y.socket)]);
  const body = route === 'change-password' ? { oldPassword: u.password, newPassword: 'Changed123' } : { password: u.password };
  expect((await request(app)[route === 'change-password' ? 'put' : 'post']('/api/auth/' + route).auth(u.token, { type: 'bearer' }).send(body)).status).toBe(200);
  await done;
  await expect(connect(u.token)).rejects.toThrow();
});

test.each(['kick', 'leave', 'dissolve'])('P0-05 group %s removes call membership and signaling authority', async action => {
  const a = await makeUser();
  const b = await makeUser();
  const cid = crypto.randomUUID();
  db.prepare("INSERT INTO conversations (id,type,owner_id) VALUES (?,'group',?)").run(cid, a.userId);
  for (const u of [a, b]) db.prepare('INSERT INTO conversation_members (conversation_id,user_id,role) VALUES (?,?,?)').run(cid, u.userId, u === a ? 'owner' : 'member');
  const x = await connect(a.token);
  const y = await connect(b.token);
  const callId = crypto.randomUUID();
  groupCall._state.groupCalls.set(callId, { conversationId: cid, members: new Set([a.userId, b.userId]), peak: 2 });
  groupCall._state.userCall.set(a.userId, callId);
  groupCall._state.userCall.set(b.userId, callId);
  if (action === 'kick') groups.kick(io, cid, a.userId, b.userId);
  if (action === 'leave') groups.leave(io, cid, b.userId);
  if (action === 'dissolve') groups.dissolve(io, cid, a.userId);
  expect(groupCall._state.userCall.has(b.userId)).toBe(false);
  expect(groupCall._state.groupCalls.get(callId)?.members.has(b.userId) || false).toBe(false);
  expect(y.socket.rooms.has(cid)).toBe(false);
  // Even stale in-memory call membership cannot authorize signaling after DB membership removal.
  groupCall._state.groupCalls.set(callId, { conversationId: cid, members: new Set([a.userId, b.userId]), peak: 2 });
  const events = [];
  const emit = jest.spyOn(io, 'to').mockImplementation(room => ({ emit: (event, payload) => events.push({ room, event, payload }) }));
  try {
    y.socket.listeners('group_call:offer')[0]({ callId, to: a.userId, offer: 'forbidden' });
    expect(groupCall._state.groupCalls.get(callId)?.members.has(b.userId) || false).toBe(false);
    // No offer is forwarded: only removal notifications may use user rooms.
    expect(events.some(e => e.event === 'group_call:offer')).toBe(false);
  } finally { emit.mockRestore(); groupCall.revokeMembership(io, cid); x.ws.close(); y.ws.close(); }
});

test('P0-03/P0-05 legacy sockets honor timestamp rollback and real password revocation', async () => {
  const u = await makeUser();
  const config = require('../src/config');
  const token = require('jsonwebtoken').sign({ id: u.userId, username: u.username, csrf: crypto.randomUUID(), iat: Math.floor(Date.now() / 1000) - 60 }, config.jwtSecret, { expiresIn: config.tokenMaxAge });
  const client = await connect(token);
  const done = disconnected(client.socket);
  db.prepare('UPDATE users SET password_changed_at=? WHERE id=?').run(Math.floor(Date.now() / 1000), u.userId);
  client.ws.send('42' + JSON.stringify(['group_call:leave', { callId: 'none' }]));
  await done;
  await expect(connect(token)).rejects.toThrow();
  db.prepare('UPDATE users SET password_changed_at=0 WHERE id=?').run(u.userId);
  const restored = await connect(token);
  const reset = disconnected(restored.socket);
  await require('../src/modules/admin/admin.service').resetPassword(io, u.userId, 'Changed123');
  await reset;
  db.prepare('UPDATE users SET password_changed_at=0 WHERE id=?').run(u.userId);
  await expect(connect(token)).rejects.toThrow();
});

test('P0-05 deleting other sessions disconnects their sockets and preserves the current device', async () => {
  const u = await makeUser();
  const login = async ua => (await request(app).post('/api/auth/login').set('User-Agent', ua).send({ phone: u.phone, password: u.password })).body.token;
  const winToken = await login('Windows');
  const androidToken = await login('Android');
  const win = await connect(winToken, 'Windows');
  const android = await connect(androidToken, 'Android');
  const done = disconnected(win.socket);
  expect((await request(app).delete('/api/auth/sessions').set('User-Agent', 'Android').auth(androidToken, { type: 'bearer' })).status).toBe(200);
  await done;
  expect(android.socket.connected).toBe(true);
  await expect(connect(winToken)).rejects.toThrow();
});
