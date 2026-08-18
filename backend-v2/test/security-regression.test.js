'use strict';
/**
 * 安全回归测试（Task VXIN-20260818-002）
 *  1. logout 后旧 JWT 立即失效（Bearer 客户端 / 黑名单生效）
 *  2. GET /api/auth/sessions 响应绝不包含 token 等认证凭据
 *  3. CORS：非法 Origin 返回 403（而非 500），合法/无 Origin 请求不受影响
 */
const request = require('supertest');
const { app, makeUser } = require('./helpers');

describe('安全回归 — logout 后旧 JWT 立即失效', () => {
  test('logout 后旧 Bearer token 立即 401', async () => {
    const user = await makeUser();

    // 前置：旧 token 可访问私有接口
    const before = await request(app)
      .get('/api/users/me/invite')
      .set('Authorization', `Bearer ${user.token}`);
    expect(before.status).not.toBe(401);

    // logout 携带 Bearer header（模拟桌面/移动端，非 cookie）
    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${user.token}`);
    expect(logout.status).toBe(200);

    // 旧 token 立即失效 → 401
    const after = await request(app)
      .get('/api/users/me/invite')
      .set('Authorization', `Bearer ${user.token}`);
    expect(after.status).toBe(401);
  });

  test('logout 不影响其他设备（重新登录的新 token 仍有效）', async () => {
    const user = await makeUser();
    const login2 = await request(app)
      .post('/api/auth/login')
      .send({ phone: user.phone, password: user.password });
    expect(login2.status).toBe(200);
    const token2 = login2.body.token;
    expect(token2).toBeTruthy();

    // 设备1 logout
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${user.token}`);

    // 设备2 token 仍 200（未被牵连）
    const res = await request(app)
      .get('/api/users/me/invite')
      .set('Authorization', `Bearer ${token2}`);
    expect(res.status).not.toBe(401);
  });
});

describe('安全回归 — sessions 响应不泄露 token', () => {
  test('GET /api/auth/sessions 不含 token 字段', async () => {
    const user = await makeUser();
    const res = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const s of res.body) {
      expect(s.token).toBeUndefined();
      expect(JSON.stringify(s)).not.toContain('eyJ');
    }
  });
});

describe('安全回归 — CORS 非法 Origin 返回 403', () => {
  test('非法 Origin 预检返回 403 而非 500', async () => {
    const res = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://evil.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(403);
    expect(res.body.error_code).toBe('FORBIDDEN');
  });

  test('无 Origin 的预检请求不受影响（同源/服务端）', async () => {
    const res = await request(app)
      .options('/api/auth/login');
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(500);
  });
});
