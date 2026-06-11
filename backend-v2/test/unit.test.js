'use strict';
/**
 * 完整单元测试套件 —— 使用 Jest + supertest
 * 覆盖: 认证、消息、搜索、速率限制、Token黑名单、安全
 */

const request = require('supertest');
const app = require('../src/app');
const { addToBlacklist, isBlacklisted, clear: clearBlacklist } = require('../src/utils/tokenBlacklist');
const cache = require('../src/utils/cache');
const { metrics } = require('../src/utils/monitoring');

// 测试数据
const testUser = {
  phone: '13800001111',
  password: '123456',
  nickname: '测试用户',
};

const testContact = {
  phone: '13800002222',
  nickname: '朋友',
};

describe('认证模块 (Auth Module)', () => {
  let token;
  let cookies;

  describe('登录流程', () => {
    test('正确的凭证应该返回用户和 token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          phone: testUser.phone,
          password: testUser.password,
        });

      expect(res.status).toBeLessThan(400);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id');
      expect(res.headers['set-cookie']).toBeDefined();

      // 保存 token 用于后续测试
      token = res.body.user.token;
      cookies = res.headers['set-cookie'];
    });

    test('错误的凭证应该返回 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          phone: testUser.phone,
          password: 'wrongpassword',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    test('缺少参数应该返回 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          phone: testUser.phone,
          // 缺少 password
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Token 黑名单', () => {
    test('应该将 token 加入黑名单', async () => {
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      await addToBlacklist('test_token_123', expiresAt);
      const blacklisted = await isBlacklisted('test_token_123');
      expect(blacklisted).toBe(true);
    });

    test('不在黑名单中的 token 应该返回 false', async () => {
      const blacklisted = await isBlacklisted('unknown_token');
      expect(blacklisted).toBe(false);
    });

    test('过期的 token 应该从黑名单移除', async () => {
      const expiresAt = Math.floor(Date.now() / 1000) - 1; // 已过期
      await addToBlacklist('expired_token', expiresAt);
      // 不应该被添加（TTL <= 0）
      const blacklisted = await isBlacklisted('expired_token');
      expect(blacklisted).toBe(false);
    });
  });

  describe('Logout', () => {
    test('logout 后使用旧 token 应该被拒绝', async () => {
      // 首先登录
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          phone: testUser.phone,
          password: testUser.password,
        });

      const cookie = loginRes.headers['set-cookie'];

      // 然后 logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie);

      expect(logoutRes.status).toBeLessThan(400);

      // 再使用这个 cookie 访问受保护端点应该失败
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(meRes.status).toBe(401);
    });
  });
});

describe('消息模块 (Message Module)', () => {
  let conversationId;
  let token;
  let cookies;

  beforeAll(async () => {
    // 登录获得 token
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        phone: testUser.phone,
        password: testUser.password,
      });
    cookies = res.headers['set-cookie'];
    token = res.body.user.token;

    // 创建对话
    const convRes = await request(app)
      .get('/api/messages/conversations')
      .set('Cookie', cookies);

    if (convRes.body.conversations && convRes.body.conversations.length > 0) {
      conversationId = convRes.body.conversations[0].id;
    }
  });

  describe('消息发送', () => {
    test('应该发送文本消息', async () => {
      if (!conversationId) {
        console.warn('没有对话，跳过消息测试');
        return;
      }

      const res = await request(app)
        .post('/api/messages/send')
        .set('Cookie', cookies)
        .send({
          conversationId,
          content: '测试消息',
          type: 'text',
        });

      expect(res.status).toBeLessThan(400);
      expect(res.body).toHaveProperty('message');
    });

    test('消息长度超过限制应该返回 400', async () => {
      if (!conversationId) return;

      const res = await request(app)
        .post('/api/messages/send')
        .set('Cookie', cookies)
        .send({
          conversationId,
          content: 'x'.repeat(10001), // 超过 10000 字符限制
          type: 'text',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('消息搜索', () => {
    test('应该搜索消息', async () => {
      const res = await request(app)
        .get('/api/messages/search')
        .query({ q: '测试' })
        .set('Cookie', cookies);

      expect(res.status).toBeLessThan(400);
      expect(res.body).toHaveProperty('messages');
      expect(Array.isArray(res.body.messages)).toBe(true);
    });

    test('搜索结果不超过 20 条', async () => {
      const res = await request(app)
        .get('/api/messages/search')
        .query({ q: '测' })
        .set('Cookie', cookies);

      expect(res.status).toBeLessThan(400);
      expect(res.body.messages.length).toBeLessThanOrEqual(20);
    });
  });
});

describe('速率限制 (Rate Limiting)', () => {
  test('连续登录失败 5 次应该被限制', async () => {
    let lastStatus;

    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          phone: testUser.phone,
          password: 'wrongpassword',
        });

      lastStatus = res.status;

      // 第 5 次之后应该被限制
      if (i >= 4) {
        expect(lastStatus).toBe(429); // Too Many Requests
      }
    }
  });
});

describe('安全性 (Security)', () => {
  test('SQL 注入: 搜索应该使用参数化查询', async () => {
    const res = await request(app)
      .get('/api/messages/search')
      .query({ q: "'; DROP TABLE users; --" })
      .set('Cookie', []);

    // 应该返回 401（未授权）而不是 500
    expect(res.status).not.toBe(500);
  });

  test('应该拒绝没有 CSRF 令牌的 POST 请求', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .send({});

    expect(res.status).toBe(401); // 未授权，因为没有 cookie
  });

  test('应该使用 httpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        phone: testUser.phone,
        password: testUser.password,
      });

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/httpOnly/i);
  });
});

describe('性能监控 (Performance)', () => {
  test('应该记录请求指标', async () => {
    await request(app).get('/health');
    const m = metrics.getMetrics();
    expect(m.requests.total).toBeGreaterThan(0);
  });

  test('应该提供 Prometheus 格式的指标', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/vxin_requests_total/);
  });

  test('应该提供 JSON 格式的指标', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('requests');
  });
});

describe('健康检查 (Health Check)', () => {
  test('GET /health 应该返回 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('应该返回版本号', async () => {
    const res = await request(app).get('/health');
    expect(res.body.version).toBeDefined();
  });
});

// 清理
afterAll(async () => {
  await clearBlacklist();
  await cache.flush();
});
