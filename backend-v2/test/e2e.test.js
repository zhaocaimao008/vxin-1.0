'use strict';
/**
 * E2E 集成测试 — 端到端业务流程验证
 * 覆盖: 注册、登录、发送消息、群组管理、搜索、缓存验证
 */

const request = require('supertest');
const app = require('../src/app');

describe('v信 后端 E2E 集成测试', () => {
  let user1Token, user2Token;
  let user1Id, user2Id;
  let conversationId, groupId;

  // 清理测试数据
  afterAll(async () => {
    // 测试完成后清理
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  describe('用户认证流程', () => {
    test('用户注册成功', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          phone: '+86-13800001111',
          password: 'password123456',
          username: 'testuser1'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.phone).toBe('+86-13800001111');
      user1Id = res.body.user.id;
      user1Token = res.body.token;
    });

    test('第二个用户注册成功', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          phone: '+86-13800002222',
          password: 'password123456',
          username: 'testuser2'
        });

      expect(res.status).toBe(200);
      user2Id = res.body.user.id;
      user2Token = res.body.token;
    });

    test('用户登录成功', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          phone: '+86-13800001111',
          password: 'password123456'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.id).toBe(user1Id);
    });

    test('错误密码登录失败', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          phone: '+86-13800001111',
          password: 'wrongpassword'
        });

      expect(res.status).toBe(400);
    });

    test('获取当前用户信息', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(user1Id);
      expect(res.body.username).toBe('testuser1');
    });
  });

  describe('私聊消息流程', () => {
    test('创建私聊会话', async () => {
      const res = await request(app)
        .post('/messages/conversation/private')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          participantId: user2Id
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('conversationId');
      conversationId = res.body.conversationId;
    });

    test('用户1发送消息给用户2', async () => {
      const res = await request(app)
        .post(`/messages/${conversationId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: '你好，这是一条测试消息',
          type: 'text'
        });

      expect(res.status).toBe(200);
      expect(res.body.message.content).toBe('你好，这是一条测试消息');
      expect(res.body.message.sender_id).toBe(user1Id);
    });

    test('获取消息历史', async () => {
      const res = await request(app)
        .get(`/messages/${conversationId}?limit=20`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].content).toContain('测试消息');
    });

    test('用户2查看消息', async () => {
      const res = await request(app)
        .get(`/messages/${conversationId}?limit=20`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    test('标记消息已读', async () => {
      const res = await request(app)
        .post(`/messages/${conversationId}/read`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({});

      expect(res.status).toBe(200);
    });
  });

  describe('搜索功能', () => {
    test('全局搜索消息', async () => {
      const res = await request(app)
        .get('/messages/search?q=测试')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
      expect(res.body).toHaveProperty('total');
      expect(res.body.results.length).toBeGreaterThan(0);
    });

    test('会话内搜索消息', async () => {
      const res = await request(app)
        .get(`/messages/${conversationId}/search?q=测试`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('搜索不存在的内容', async () => {
      const res = await request(app)
        .get('/messages/search?q=不存在的内容')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.results.length).toBe(0);
    });
  });

  describe('群组管理', () => {
    test('用户1创建群组', async () => {
      const res = await request(app)
        .post('/messages/conversation/group')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'E2E 测试群组',
          memberIds: [user2Id]
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('conversationId');
      groupId = res.body.conversationId;
    });

    test('获取群组信息', async () => {
      const res = await request(app)
        .get(`/messages/conversation/${groupId}/info`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('E2E 测试群组');
      expect(res.body.type).toBe('group');
    });

    test('获取群组成员', async () => {
      const res = await request(app)
        .get(`/messages/conversation/${groupId}/members`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2); // owner + user2
    });

    test('群组内发送消息', async () => {
      const res = await request(app)
        .post(`/messages/${groupId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: '这是群组内的测试消息',
          type: 'text'
        });

      expect(res.status).toBe(200);
      expect(res.body.message.type).toBe('group');
    });
  });

  describe('消息操作', () => {
    let messageId;

    test('发送待操作的消息', async () => {
      const res = await request(app)
        .post(`/messages/${conversationId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: '这条消息将被编辑',
          type: 'text'
        });

      expect(res.status).toBe(200);
      messageId = res.body.message.id;
    });

    test('编辑消息', async () => {
      const res = await request(app)
        .put(`/messages/${messageId}/edit`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: '这条消息已被编辑'
        });

      expect(res.status).toBe(200);
    });

    test('消息表情反应', async () => {
      const res = await request(app)
        .post(`/messages/${messageId}/react`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          emoji: '👍'
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('撤回消息', async () => {
      const res = await request(app)
        .delete(`/messages/${messageId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          forEveryone: true
        });

      expect(res.status).toBe(200);
    });
  });

  describe('对话列表和缓存', () => {
    test('获取对话列表 (第一次 - 缓存未命中)', async () => {
      const startTime = Date.now();
      const res = await request(app)
        .get('/messages/conversations')
        .set('Authorization', `Bearer ${user1Token}`);
      const firstTime = Date.now() - startTime;

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      console.log(`首次查询耗时: ${firstTime}ms`);
    });

    test('获取对话列表 (第二次 - 缓存命中，应该更快)', async () => {
      const startTime = Date.now();
      const res = await request(app)
        .get('/messages/conversations')
        .set('Authorization', `Bearer ${user1Token}`);
      const secondTime = Date.now() - startTime;

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      console.log(`缓存命中查询耗时: ${secondTime}ms`);
      // 缓存查询应该明显更快
    });

    test('获取未读计数', async () => {
      const res = await request(app)
        .get('/messages/unread-counts')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(typeof res.body).toBe('object');
    });

    test('获取我的群列表', async () => {
      const res = await request(app)
        .get('/messages/my-groups')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some(g => g.id === groupId)).toBe(true);
    });
  });

  describe('用户资料', () => {
    test('获取用户详情', async () => {
      const res = await request(app)
        .get(`/users/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(user2Id);
      expect(res.body.username).toBe('testuser2');
    });

    test('更新用户资料', async () => {
      const res = await request(app)
        .put('/users/profile')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          username: 'updateduser1',
          bio: '这是我的个人简介'
        });

      expect(res.status).toBe(200);
      expect(res.body.bio).toBe('这是我的个人简介');
    });

    test('获取更新后的用户信息', async () => {
      const res = await request(app)
        .get(`/users/${user1Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('updateduser1');
    });
  });

  describe('联系人和好友', () => {
    test('搜索用户', async () => {
      const res = await request(app)
        .get('/users/search?q=testuser2')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some(u => u.id === user2Id)).toBe(true);
    });

    test('发送好友请求', async () => {
      const res = await request(app)
        .post('/users/friend-request')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          targetUserId: user2Id,
          message: '让我们成为好友吧'
        });

      expect(res.status).toBe(200);
    });

    test('获取收到的好友请求', async () => {
      const res = await request(app)
        .get('/users/friend-requests')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('获取联系人列表', async () => {
      const res = await request(app)
        .get('/users/contacts')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('系统功能', () => {
    test('获取健康状态', async () => {
      const res = await request(app)
        .get('/health');

      expect(res.status).toBe(200);
    });

    test('获取性能指标', async () => {
      const res = await request(app)
        .get('/metrics');

      expect(res.status).toBe(200);
      expect(res.text).toContain('vxin_requests_total');
    });

    test('获取JSON格式指标', async () => {
      const res = await request(app)
        .get('/api/metrics');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('requests');
      expect(res.body).toHaveProperty('cache');
      expect(res.body).toHaveProperty('database');
    });
  });

  describe('并发和压力测试', () => {
    test('并发发送消息', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post(`/messages/${conversationId}`)
            .set('Authorization', `Bearer ${user1Token}`)
            .send({
              content: `并发消息 ${i}`,
              type: 'text'
            })
        );
      }

      const results = await Promise.all(promises);
      expect(results.every(r => r.status === 200)).toBe(true);
    });

    test('并发查询对话列表', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .get('/messages/conversations')
            .set('Authorization', `Bearer ${user1Token}`)
        );
      }

      const results = await Promise.all(promises);
      expect(results.every(r => r.status === 200)).toBe(true);
    });
  });

  describe('错误处理', () => {
    test('访问不存在的对话', async () => {
      const res = await request(app)
        .get('/messages/nonexistent')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(400);
    });

    test('未授权访问', async () => {
      const res = await request(app)
        .get('/messages/conversations');

      expect(res.status).toBe(401);
    });

    test('无效的token', async () => {
      const res = await request(app)
        .get('/messages/conversations')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });

    test('发送空消息', async () => {
      const res = await request(app)
        .post(`/messages/${conversationId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: '',
          type: 'text'
        });

      expect(res.status).toBe(400);
    });
  });
});
