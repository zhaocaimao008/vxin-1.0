'use strict';
/**
 * 回归：/api/optimization/ack/batch 只接受有限长度的消息 ID 数组；
 * /ack/flush 会刷新所有用户的待处理批次，仅限管理员。
 */
require('./testEnv');
const { request, app, makeUser } = require('./helpers');

describe('批量 ACK 接口输入限制', () => {
  let u;
  beforeAll(async () => { u = await makeUser(); });
  const post = (path, body) => request(app).post(path).set('Authorization', `Bearer ${u.token}`).send(body);

  test('超长数组被拒', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `m${i}`);
    expect((await post('/api/optimization/ack/batch', { deliveries: ids })).status).toBe(400);
  });

  test('非数组 / 非字符串 ID 被拒', async () => {
    expect((await post('/api/optimization/ack/batch', { deliveries: 'abc' })).status).toBe(400);
    expect((await post('/api/optimization/ack/batch', { reads: [{ id: 1 }] })).status).toBe(400);
  });

  test('普通用户不能刷新全局批次', async () => {
    expect((await post('/api/optimization/ack/flush', {})).status).toBe(401);
  });
});
