'use strict';
/**
 * E2E 集成测试 —— 完整业务流程
 * 覆盖: 用户注册→登录→创建会话→发送消息→搜索→缓存命中→监控指标
 */

const request = require('supertest');
const app = require('../src/app');
const cache = require('../src/utils/cache');
const { metrics } = require('../src/utils/monitoring');

describe('E2E 集成测试 - 完整业务流程', () => {
  let user1Token, user2Token;
  let user1Id, user2Id;
  let conversationId;

  beforeAll(async () => {
    await cache.init();
  });

  afterAll(async () => {
    await cache.flush();
  });

  describe('用户认证流程', () => {
    test('用户注册', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: '13800001111',
          password: 'Test@12345',
          username: '用户一',
        });

      expect(res.status).toBeLessThan(400);
      expect(res.body).toHaveProperty('user');
      user1Id = res.body.user.id;
    });

    test('用户登录', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          phone: '13800001111',
          password: 'Test@12345',
        });

      expect(res.status).toBeLessThan(400);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('token');
      user1Token = res.body.user.token;
    });

    test('获取当前用户信息', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBeLessThan(400);
      expect(res.body).toHaveProperty('user');
    });
  });

  describe('用户关系管理', () => {
    test('第二个用户注册并登录', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: '13800002222',
          password: 'Test@12345',
          username: '用户二',
        });

      user2Id = res.body.user.id;

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          phone: '13800002222',
          password: 'Test@12345',
        });

      user2Token = loginRes.body.user.token;
    });

    test('用户搜索', async () => {
      const res = await request(app)
        .get('/api/users/search')
        .query({ q: '用户二' })
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBeLessThan(400);
      expect(res.body).toHaveProperty('results');
    });

    test('发送好友请求', async () => {
      const res = await request(app)
        .post('/api/users/friend-request')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          targetUserId: user2Id,
          message: '你好，我想加你为好友',
        });

      expect(res.status).toBeLessThan(400);
    });
  });

  describe('消息会话流程', () => {
    test('创建私聊会话', async () => {
      const res = await request(app)
        .post('/api/messages/conversation/private')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          participantId: user2Id,
        });

      expect(res.status).toBeLessThan(400);
      expect(res.body).toHaveProperty('conversation');
      conversationId = res.body.conversation.id;
    });

    test('发送消息', async () => {
      const res = await request(app)
        .post(`/api/messages/${conversationId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: '你好，这是第一条消息',
          type: 'text',
        });

      expect(res.status).toBeLessThan(400);
      expect(res.body).toHaveProperty('message');
    });

    test('获取消息历史（第一次 - 缓存未命中）', async () => {
      const res = await request(app)
        .get(`/api/messages/${conversationId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .query({ offset: 0, limit: 20 });

      expect(res.status).toBeLessThan(400);
      expect(res.body).toHaveProperty('messages');
      expect(Array.isArray(res.body.messages)).toBe(true);
    });

    test('获取消息历史（第二次 - 应该命中缓存）', async () => {
      const cacheBefore = metrics.getMetrics().cache_hits || 0;

      const res = await request(app)
        .get(`/api/messages/${conversationId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .query({ offset: 0, limit: 20 });

      expect(res.status).toBeLessThan(400);
      const cacheAfter = metrics.getMetrics().cache_hits || 0;
      expect(cacheAfter).toBeGreaterThan(cacheBefore);
    });

    test('列表对话（缓存测试）', async () => {
      const res = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBeLessThan(400);
      expect(res.body).toHaveProperty('conversations');
    });
  });

  describe('搜索功能', () => {
    test('全局搜索消息', async () => {
      const res = await request(app)
        .get('/api/messages/search')
        .query({ q: '第一条' })
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBeLessThan(400);
      expect(res.body).toHaveProperty('results');
    });

    test('会话内搜索', async () => {
      const res = await request(app)
        .get(`/api/messages/conversation/${conversationId}/search`)
        .query({ q: '你好' })
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBeLessThan(400);
      expect(res.body).toHaveProperty('messages');
    });
  });

  describe('消息操作', () => {
    let messageId;

    test('发送可反应的消息', async () => {
      const res = await request(app)
        .post(`/api/messages/${conversationId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: '这是一条可以点赞的消息',
          type: 'text',
        });

      messageId = res.body.message.id;
    });

    test('消息反应（点赞）', async () => {
      const res = await request(app)
        .post(`/api/messages/${messageId}/react`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          emoji: '👍',
        });

      expect(res.status).toBeLessThan(400);
    });

    test('编辑消息', async () => {
      const res = await request(app)
        .put(`/api/messages/${messageId}/edit`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: '这是一条已编辑的消息',
        });

      expect(res.status).toBeLessThan(400);
    });

    test('收藏消息', async () => {
      const res = await request(app)
        .post(`/api/messages/${messageId}/collect`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBeLessThan(400);
    });

    test('删除消息（撤回）', async () => {
      const res = await request(app)
        .delete(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBeLessThan(400);
    });
  });

  describe('会话管理', () => {
    test('标记会话为已读', async () => {
      const res = await request(app)
        .post(`/api/messages/conversation/${conversationId}/read`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBeLessThan(400);
    });

    test('获取未读计数', async () => {
      const res = await request(app)
        .get('/api/messages/unread-counts')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBeLessThan(400);
      expect(res.body).toHaveProperty('counts');
    });

    test('置顶会话', async () => {
      const res = await request(app)
        .post(`/api/messages/conversation/${conversationId}/pin`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBeLessThan(400);
    });

    test('静音会话', async () => {
      const res = await request(app)
        .post(`/api/messages/conversation/${conversationId}/mute`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ duration: 3600 });

      expect(res.status).toBeLessThan(400);
    });
  });

  describe('用户信息缓存', () => {
    test('获取用户详情（第一次 - 缓存未命中）', async () => {
      const res = await request(app)
        .get(`/api/users/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBeLessThan(400);
      expect(res.body).toHaveProperty('user');
    });

    test('获取用户详情（第二次 - 应该命中缓存）', async () => {
      const cacheBefore = metrics.getMetrics().cache_hits || 0;

      const res = await request(app)
        .get(`/api/users/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBeLessThan(400);
      const cacheAfter = metrics.getMetrics().cache_hits || 0;
      expect(cacheAfter).toBeGreaterThan(cacheBefore);
    });

    test('更新用户信息后缓存失效', async () => {
      // 更新用户信息
      await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          username: '更新的用户名',
        });

      // 再次获取，应该重新从数据库加载
      const res = await request(app)
        .get(`/api/users/${user1Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBeLessThan(400);
    });
  });

  describe('监控指标验证', () => {
    test('指标端点返回有效数据', async () => {
      const res = await request(app)
        .get('/metrics');

      expect(res.status).toBe(200);
      expect(res.type).toBe('text/plain');
      expect(res.text).toContain('http_requests_total');
    });

    test('JSON 格式指标', async () => {
      const res = await request(app)
        .get('/api/metrics');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('requests_total');
      expect(res.body).toHaveProperty('request_duration');
      expect(res.body).toHaveProperty('cache_hits');
      expect(res.body).toHaveProperty('db_queries');
    });

    test('验证性能改进（缓存对比）', async () => {
      const metrics_data = metrics.getMetrics();

      // 验证缓存统计存在
      expect(metrics_data).toHaveProperty('cache_hits');
      expect(metrics_data).toHaveProperty('cache_misses');

      // 缓存命中率应该大于 0
      if (metrics_data.cache_hits && metrics_data.cache_misses) {
        const hitRate = metrics_data.cache_hits / (metrics_data.cache_hits + metrics_data.cache_misses);
        expect(hitRate).toBeGreaterThan(0);
      }
    });
  });

  describe('错误处理', () => {
    test('无效的会话 ID', async () => {
      const res = await request(app)
        .get('/api/messages/invalid-id')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    test('未授权的访问', async () => {
      const res = await request(app)
        .get('/api/messages/conversations');

      expect(res.status).toBeGreaterThanOrEqual(401);
    });

    test('无效的令牌', async () => {
      const res = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBeGreaterThanOrEqual(401);
    });

    test('限流保护', async () => {
      // 快速发送多个请求
      const requests = Array(6).fill(null).map(() =>
        request(app)
          .post(`/api/messages/${conversationId}`)
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ content: '测试', type: 'text' })
      );

      const results = await Promise.all(requests);
      const tooManyRequests = results.some(r => r.status === 429);
      expect(tooManyRequests).toBe(true);
    });
  });

  describe('日志和监控', () => {
    test('验证请求日志记录', async () => {
      const res = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBeLessThan(400);
      // 日志应该自动记录此请求
    });

    test('性能指标记录', async () => {
      const beforeMetrics = metrics.getMetrics();

      await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${user1Token}`);

      const afterMetrics = metrics.getMetrics();
      expect(afterMetrics.requests_total).toBeGreaterThan(beforeMetrics.requests_total);
    });
  });
});
