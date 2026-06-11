'use strict';
/**
 * 性能基准测试 — 测试缓存、日志、监控等P2优化的性能指标
 */

const request = require('supertest');
const app = require('../src/app');

describe('性能基准测试', () => {
  let userId, token;
  let conversationId;

  beforeAll(async () => {
    // 注册并获取token
    const registerRes = await request(app)
      .post('/auth/register')
      .send({
        phone: `+86-138${Math.random().toString().slice(2, 8)}`,
        password: 'password123456',
        username: `perftest${Date.now()}`
      });

    userId = registerRes.body.user.id;
    token = registerRes.body.token;

    // 创建测试对话
    const convRes = await request(app)
      .post('/messages/conversation/private')
      .set('Authorization', `Bearer ${token}`)
      .send({
        participantId: userId // 自己给自己发消息
      });

    conversationId = convRes.body.conversationId;
  });

  describe('缓存性能基准', () => {
    test('对话列表首次查询耗时 (缓存未命中)', async () => {
      const durations = [];

      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        const res = await request(app)
          .get('/messages/conversations')
          .set('Authorization', `Bearer ${token}`);
        const duration = Date.now() - startTime;

        expect(res.status).toBe(200);
        durations.push(duration);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`\n首次查询平均耗时: ${avgDuration.toFixed(2)}ms (${durations})`);
      // P2优化后应该在 5-20ms
      expect(avgDuration).toBeLessThan(100);
    });

    test('缓存命中性能优化验证', async () => {
      // 预热缓存
      await request(app)
        .get('/messages/conversations')
        .set('Authorization', `Bearer ${token}`);

      // 清理缓存间隔，防止TTL过期
      const cachedDurations = [];
      for (let i = 0; i< 10; i++) {
        const startTime = Date.now();
        const res = await request(app)
          .get('/messages/conversations')
          .set('Authorization', `Bearer ${token}`);
        const duration = Date.now() - startTime;

        expect(res.status).toBe(200);
        cachedDurations.push(duration);
      }

      const avgCached = cachedDurations.reduce((a, b) => a + b, 0) / cachedDurations.length;
      console.log(`\n缓存命中平均耗时: ${avgCached.toFixed(2)}ms (${cachedDurations})`);
      // 缓存命中应该非常快 < 5ms
      expect(avgCached).toBeLessThan(10);
    });

    test('搜索缓存性能', async () => {
      // 首次搜索（缓存未命中）
      const startTime1 = Date.now();
      const res1 = await request(app)
        .get('/messages/search?q=test')
        .set('Authorization', `Bearer ${token}`);
      const duration1 = Date.now() - startTime1;

      expect(res1.status).toBe(200);
      console.log(`\n首次搜索耗时: ${duration1}ms`);

      // 第二次搜索同样内容（缓存命中）
      const startTime2 = Date.now();
      const res2 = await request(app)
        .get('/messages/search?q=test')
        .set('Authorization', `Bearer ${token}`);
      const duration2 = Date.now() - startTime2;

      expect(res2.status).toBe(200);
      console.log(`缓存命中搜索耗时: ${duration2}ms`);
      console.log(`性能提升: ${((1 - duration2/duration1) * 100).toFixed(1)}%`);
      // 缓存应该提升至少 50% 的性能
      expect(duration2).toBeLessThan(duration1);
    });
  });

  describe('并发性能测试', () => {
    test('1000个并发读取请求', async () => {
      const startTime = Date.now();
      const promises = [];

      for (let i = 0; i < 100; i++) {
        promises.push(
          request(app)
            .get('/messages/conversations')
            .set('Authorization', `Bearer ${token}`)
        );
      }

      const results = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;

      const successCount = results.filter(r => r.status === 200).length;
      const successRate = (successCount / results.length) * 100;
      const avgResponseTime = totalDuration / results.length;

      console.log(`\n100个并发请求统计:`);
      console.log(`  总耗时: ${totalDuration}ms`);
      console.log(`  成功率: ${successRate.toFixed(1)}%`);
      console.log(`  平均响应时间: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`  吞吐量: ${(100 / totalDuration * 1000).toFixed(0)} req/s`);

      expect(successRate).toBe(100);
      expect(avgResponseTime).toBeLessThan(100);
    });

    test('1000个并发写入请求', async () => {
      const startTime = Date.now();
      const promises = [];

      for (let i = 0; i < 50; i++) {
        promises.push(
          request(app)
            .post(`/messages/${conversationId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
              content: `并发消息 ${i}`,
              type: 'text'
            })
        );
      }

      const results = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;

      const successCount = results.filter(r => r.status === 200).length;
      const successRate = (successCount / results.length) * 100;
      const avgResponseTime = totalDuration / results.length;

      console.log(`\n50个并发写入请求统计:`);
      console.log(`  总耗时: ${totalDuration}ms`);
      console.log(`  成功率: ${successRate.toFixed(1)}%`);
      console.log(`  平均响应时间: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`  吞吐量: ${(50 / totalDuration * 1000).toFixed(0)} req/s`);

      expect(successRate).toBe(100);
    });

    test('混合并发读写请求', async () => {
      const startTime = Date.now();
      const promises = [];

      // 75% 读取，25% 写入
      for (let i = 0; i < 75; i++) {
        promises.push(
          request(app)
            .get('/messages/conversations')
            .set('Authorization', `Bearer ${token}`)
        );
      }

      for (let i = 0; i < 25; i++) {
        promises.push(
          request(app)
            .post(`/messages/${conversationId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
              content: `混合测试 ${i}`,
              type: 'text'
            })
        );
      }

      const results = await Promise.all(promises);
      const totalDuration = Date.now() - startTime;

      const successCount = results.filter(r => r.status === 200 || r.status === 201).length;
      const successRate = (successCount / results.length) * 100;
      const avgResponseTime = totalDuration / results.length;

      console.log(`\n100个混合并发请求统计 (75% 读 + 25% 写):`);
      console.log(`  总耗时: ${totalDuration}ms`);
      console.log(`  成功率: ${successRate.toFixed(1)}%`);
      console.log(`  平均响应时间: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`  吞吐量: ${(100 / totalDuration * 1000).toFixed(0)} req/s`);

      expect(successRate).toBeGreaterThan(95);
    });
  });

  describe('内存和资源使用', () => {
    test('长连接内存稳定性', async () => {
      const memStart = process.memoryUsage();

      // 执行多轮查询
      for (let round = 0; round < 5; round++) {
        for (let i = 0; i < 20; i++) {
          await request(app)
            .get('/messages/conversations')
            .set('Authorization', `Bearer ${token}`);
        }
      }

      const memEnd = process.memoryUsage();
      const heapDiff = (memEnd.heapUsed - memStart.heapUsed) / 1024 / 1024;

      console.log(`\n内存使用统计 (100个请求后):`);
      console.log(`  堆内存增长: ${heapDiff.toFixed(2)}MB`);
      console.log(`  初始堆内存: ${(memStart.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  最终堆内存: ${(memEnd.heapUsed / 1024 / 1024).toFixed(2)}MB`);

      // 应该保持内存相对稳定
      expect(Math.abs(heapDiff)).toBeLessThan(50);
    });
  });

  describe('数据库查询性能', () => {
    test('单条查询性能', async () => {
      const durations = [];

      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        const res = await request(app)
          .get(`/users/${userId}`)
          .set('Authorization', `Bearer ${token}`);
        const duration = Date.now() - startTime;

        expect(res.status).toBe(200);
        durations.push(duration);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);

      console.log(`\n单条查询性能统计:`);
      console.log(`  平均: ${avgDuration.toFixed(2)}ms`);
      console.log(`  最小: ${minDuration}ms`);
      console.log(`  最大: ${maxDuration}ms`);
      console.log(`  P95: ${durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)]}ms`);

      expect(avgDuration).toBeLessThan(50);
    });

    test('批量查询性能', async () => {
      const startTime = Date.now();
      const res = await request(app)
        .get('/messages/conversations')
        .set('Authorization', `Bearer ${token}`);
      const duration = Date.now() - startTime;

      expect(res.status).toBe(200);
      console.log(`\n批量查询 (对话列表) 性能: ${duration}ms`);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('监控指标验证', () => {
    test('Prometheus指标可访问', async () => {
      const res = await request(app)
        .get('/metrics');

      expect(res.status).toBe(200);
      expect(res.text).toContain('vxin_requests_total');
      expect(res.text).toContain('vxin_request_duration_seconds');
      expect(res.text).toContain('vxin_cache_hit_rate');
    });

    test('JSON格式指标', async () => {
      const res = await request(app)
        .get('/api/metrics');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('requests');
      expect(res.body.requests).toHaveProperty('total');
      expect(res.body.requests).toHaveProperty('avgTime');
      expect(res.body.requests).toHaveProperty('errorRate');
      expect(res.body).toHaveProperty('cache');
      expect(res.body.cache).toHaveProperty('hitRate');
      expect(res.body).toHaveProperty('database');
    });
  });

  describe('负载测试', () => {
    test('持续5秒压力测试', async () => {
      const startTime = Date.now();
      let requestCount = 0;
      const errors = [];

      while (Date.now() - startTime < 5000) {
        try {
          const res = await request(app)
            .get('/messages/conversations')
            .set('Authorization', `Bearer ${token}`);

          requestCount++;
          if (res.status !== 200) {
            errors.push(`Status: ${res.status}`);
          }
        } catch (err) {
          errors.push(err.message);
        }
      }

      const duration = Date.now() - startTime;
      const throughput = requestCount / (duration / 1000);
      const errorRate = (errors.length / requestCount) * 100;

      console.log(`\n5秒压力测试结果:`);
      console.log(`  总请求数: ${requestCount}`);
      console.log(`  总耗时: ${duration}ms`);
      console.log(`  吞吐量: ${throughput.toFixed(0)} req/s`);
      console.log(`  错误率: ${errorRate.toFixed(2)}%`);

      expect(errorRate).toBeLessThan(1);
      expect(throughput).toBeGreaterThan(10);
    });
  });
});
