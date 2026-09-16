'use strict';
const { app, request, makeUser } = require('./helpers');
const config = require('../src/config');
const auth = require('../src/modules/auth/auth.service');

test('切换账号返回新 Bearer token，桌面端重载后身份一致', async () => {
  const a = await makeUser({ username: 'switch_a' });
  const b = await makeUser({ username: 'switch_b' });
  const wallet = 'switch-token-test-wallet';
  auth.recordDeviceAccount(wallet, a.userId);
  auth.recordDeviceAccount(wallet, b.userId);
  const response = await request(app).post('/api/auth/switch')
    .set('Cookie', `${config.walletCookie}=${wallet}`)
    .set('Authorization', `Bearer ${a.token}`)
    .send({ userId: b.userId });
  expect(response.status).toBe(200);
  expect(response.body.token).toEqual(expect.any(String));
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${response.body.token}`);
  expect(me.status).toBe(200);
  expect(me.body.id).toBe(b.userId);
  const stranger = await makeUser({ username: 'switch_stranger' });
  const denied = await request(app).post('/api/auth/switch')
    .set('Cookie', `${config.walletCookie}=${wallet}`)
    .send({ userId: stranger.userId });
  expect(denied.status).toBeGreaterThanOrEqual(400);
  expect(denied.body.token).toBeUndefined();
});
