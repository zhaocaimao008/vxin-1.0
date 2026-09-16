'use strict';
const request = require('supertest');
const express = require('express');

// Real limiter middleware with an in-memory store; tests do not disable the guard.
jest.mock('redis', () => ({ createClient: () => ({ on() {}, connect: async () => { throw Error('memory fixture'); } }) }));
const disabled = process.env.DISABLE_RATE_LIMIT;
delete process.env.DISABLE_RATE_LIMIT;
const { loginLimiter } = require('../src/middleware/rateLimiters');
process.env.DISABLE_RATE_LIMIT = disabled;
const app = express();
app.use(express.json());
app.post('/login', loginLimiter, (req, res) => res.status(req.body.fail ? 401 : 200).json({ ok: !req.body.fail }));

test('successful logins do not lock the user after five attempts', async () => {
  for (let i = 0; i < 8; i++) await request(app).post('/login').send({ phone: 'success-only' }).expect(200);
});
test('five failed attempts still block a sixth and wechat IDs are isolated', async () => {
  for (let i = 0; i < 5; i++) await request(app).post('/login').send({ loginType: 'vxin', identifier: '567890', fail: true }).expect(401);
  await request(app).post('/login').send({ loginType: 'vxin', identifier: '567890', fail: true }).expect(429);
  await request(app).post('/login').send({ loginType: 'vxin', identifier: '567891' }).expect(200);
});

test('whitespace and legacy/new phone fields share the authentication bucket', async () => {
  for (let i = 0; i < 5; i++) await request(app).post('/login').send({ phone: '13910000001', fail: true }).expect(401);
  await request(app).post('/login').send({ loginType: 'phone', identifier: ' 13910000001 ', fail: true }).expect(429);
});

test('unused phone fields cannot change a vxin account failure bucket', async () => {
  for (let i = 0; i < 5; i++) await request(app).post('/login').send({ loginType: 'vxin', wechat_id: '567892', fail: true }).expect(401);
  await request(app).post('/login').send({ loginType: 'vxin', wechat_id: '567892', phone: '13910000002', fail: true }).expect(429);
});
