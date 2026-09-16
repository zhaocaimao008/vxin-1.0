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
  for (let i = 0; i < 5; i++) await request(app).post('/login').send({ wechat_id: 'failed-id', fail: true }).expect(401);
  await request(app).post('/login').send({ wechat_id: 'failed-id', fail: true }).expect(429);
  await request(app).post('/login').send({ wechat_id: 'different-id' }).expect(200);
});
