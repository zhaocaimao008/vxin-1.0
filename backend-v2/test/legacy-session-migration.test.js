'use strict';
/**
 * BATCH4 最终补丁 —— Legacy Session 强制重登 + 单设备精确踢下线 专项测试
 *
 * 覆盖用户要求的全部场景：
 *   1. migration 生效后，旧 JWT（iat < password_changed_at）→ 401
 *   2. 重新登录 → 200
 *   3. refresh → 200（旧 token 黑名单化 + session token 同步）
 *   4. 踢单个 Windows → Windows 立即 401
 *   5. Android 其他设备继续 200
 *   6. 反向踢 Android 同样通过
 *   7. migration idx 104 存在且 SQL 正确（幂等 UPDATE，只影响登录状态）
 */
require('./testEnv');
const request = require('supertest');
const app = require('../src/app');
const { makeUser } = require('./helpers');

const WIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
const AND_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Chrome/126.0';

describe('BATCH4 Legacy Session 强制重登 + 精确踢下线', () => {
  let db;
  let user; // { token, userId, phone, password, username }

  beforeAll(async () => {
    // 延迟 require，与现有测试保持一致
    db = require('../src/db/connection').db;
    user = await makeUser({ username: 'legacy_win_user' });
  });

  test('0. migration idx 104 存在于 migrations 数组且为幂等 UPDATE', () => {
    const schema = require('../src/db/schema');
    // 通过私有方法不可行，直接读源码文件验证数组内容
    const fs = require('fs');
    const src = fs.readFileSync(require.resolve('../src/db/schema.js'), 'utf8');
    const m = src.match(/const migrations = \[([\s\S]*?)\n  \];/);
    const arr = eval('[' + m[1] + ']');
    const last = arr[arr.length - 1];
    expect(last).toContain("UPDATE users SET password_changed_at");
    expect(last).toContain("strftime('%s','now')");
    // 幂等：重复执行只是推进时间戳，不删数据
    expect(last).not.toMatch(/DELETE/i);
    expect(last).not.toMatch(/DROP/i);
    expect(last).not.toMatch(/SET password\s*=\s*['"]/); // 不改密码（password_changed_at 允许）
  });

  test('1. migration 生效后，旧 JWT（iat < password_changed_at）→ 401', async () => {
    // 手工签发一枚「升级前」的旧 JWT（iat 为过去时间），精确模拟旧会话 token
    const jwt = require('jsonwebtoken');
    const config = require('../src/config');
    const oldIat = Math.floor(Date.now() / 1000) - 3600; // 1 小时前签发
    const oldToken = jwt.sign(
      { id: user.userId, username: user.username, csrf: 'legacy-csrf', iat: oldIat },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: `${config.tokenMaxAge}s` }
    );

    // 模拟 BATCH4 migration 执行：推进该用户 password_changed_at 到当前秒
    db.prepare("UPDATE users SET password_changed_at = strftime('%s','now') WHERE id=?")
      .run(user.userId);
    // 生产中 migration 在服务启动时执行，进程内缓存为空；测试需模拟同场景（清缓存）
    const { invalidateUser } = require('../src/utils/userStatusCache');
    invalidateUser(user.userId);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`)
      .set('User-Agent', WIN_UA);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/重新登录/);
  });

  test('1b. 同秒新登录不误杀：migration 后立即重新登录 → 200', async () => {
    // password_changed_at 仍为「当前秒」，新登录 JWT 的 iat >= 该值 → 严格小于判断不误杀
    const res = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', WIN_UA)
      .send({ phone: user.phone, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    user.token = res.body.token; // 升级为新 token，供后续用例使用
  });

  test('2. 重新登录（Windows）→ 200', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', WIN_UA)
      .send({ phone: user.phone, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    user.token = res.body.token; // 升级为新 token
  });

  test('3. refresh → 200，且新 token 可用', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${user.token}`)
      .set('User-Agent', WIN_UA);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    user.token = res.body.token;

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${user.token}`)
      .set('User-Agent', WIN_UA);
    expect(me.status).toBe(200);
  });

  test('4. Android 设备登录（同一用户）→ 200', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', AND_UA)
      .send({ phone: user.phone, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    user.androidToken = res.body.token;
  });

  test('5. 踢单个 Windows → Windows 立即 401，Android 不受影响', async () => {
    // 列出 sessions，找到 Windows session id
    const list = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${user.token}`)
      .set('User-Agent', WIN_UA);
    expect(list.status).toBe(200);
    const winSession = (list.body || []).find(s => s.platform === 'Windows');
    expect(winSession).toBeTruthy();

    // 踢 Windows
    const kick = await request(app)
      .delete(`/api/auth/sessions/${winSession.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .set('User-Agent', WIN_UA);
    expect(kick.status).toBe(200);

    // Windows 的 token 立即 401（精确黑名单）
    const winMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${user.token}`)
      .set('User-Agent', WIN_UA);
    expect(winMe.status).toBe(401);

    // Android 其他设备继续 200
    const andMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${user.androidToken}`)
      .set('User-Agent', AND_UA);
    expect(andMe.status).toBe(200);
  });

  test('6. 反向踢 Android → Android 立即 401，Windows 重新登录后不受影响', async () => {
    // Windows 重新登录（被踢后需重新登录）
    const relog = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', WIN_UA)
      .send({ phone: user.phone, password: user.password });
    expect(relog.status).toBe(200);
    user.token = relog.body.token;

    const list = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${user.token}`)
      .set('User-Agent', WIN_UA);
    const andSession = (list.body || []).find(s => s.platform === 'Android');
    expect(andSession).toBeTruthy();

    const kick = await request(app)
      .delete(`/api/auth/sessions/${andSession.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .set('User-Agent', WIN_UA);
    expect(kick.status).toBe(200);

    // Android token 立即 401
    const andMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${user.androidToken}`)
      .set('User-Agent', AND_UA);
    expect(andMe.status).toBe(401);

    // Windows 继续 200（反向踢不牵连其他设备）
    const winMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${user.token}`)
      .set('User-Agent', WIN_UA);
    expect(winMe.status).toBe(200);
  });

  test('7. 认证字段级回滚：快照备份 → 恢复原值（非一律置 0，脚本实测）', async () => {
    const { execSync } = require('child_process');
    const os = require('os');
    const fs = require('fs');
    const path = require('path');

    // 独立用户：注册时 password_changed_at 默认为 0（未改过密码的真实原值）
    const u = await makeUser({ username: 'rollback_user' });

    const snapshotFile = path.join(os.tmpdir(), `pca-snapshot-${Date.now()}.json`);
    const env = { ...process.env, DB_PATH: process.env.DB_PATH };

    // ① 部署前备份全部用户原值（正式工具：scripts/backup-password-changed-at.js）
    execSync(`node scripts/backup-password-changed-at.js "${snapshotFile}"`, { cwd: path.join(__dirname, '..'), env });
    const snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
    const before = snapshot.users.find(x => x.id === u.userId);
    expect(before).toBeTruthy();
    expect(before.password_changed_at).toBe(0); // 注册用户原值 = 0（未改密）

    // 手工旧 token（iat = 1h 前），用于验证回滚后旧 JWT 恢复可用
    const jwt = require('jsonwebtoken');
    const config = require('../src/config');
    const oldIat = Math.floor(Date.now() / 1000) - 3600;
    const oldToken = jwt.sign(
      { id: u.userId, username: u.username, csrf: 'rollback-csrf', iat: oldIat },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: `${config.tokenMaxAge}s` }
    );

    // ② 模拟 migration 104 推进 → 旧 token 立即失效
    db.prepare("UPDATE users SET password_changed_at = strftime('%s','now') WHERE id=?")
      .run(u.userId);
    require('../src/utils/userStatusCache').invalidateUser(u.userId);
    const kicked = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`)
      .set('User-Agent', WIN_UA);
    expect(kicked.status).toBe(401);

    // ③ 回滚：按快照恢复每个用户原值（正式工具：scripts/restore-password-changed-at.js）
    execSync(`node scripts/restore-password-changed-at.js "${snapshotFile}"`, { cwd: path.join(__dirname, '..'), env });
    require('../src/utils/userStatusCache').invalidateUser(u.userId);

    // ④ 恢复原值后旧 JWT 重新可用（未覆盖上线后新数据；未改密用户原值恢复不会复活应失效 JWT）
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`)
      .set('User-Agent', WIN_UA);
    expect(res.status).toBe(200);
    fs.unlinkSync(snapshotFile);
  });
});
