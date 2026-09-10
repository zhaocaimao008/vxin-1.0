'use strict';
/**
 * 回归（2026-09-10，批次9）：免密切换账号后，旧账号仍收到已切走设备的推送（串号泄露）。
 *
 * bug：push_subscriptions/device_tokens 的唯一约束是 UNIQUE(user_id, endpoint/token)，
 * 而同一浏览器 PushSubscription endpoint（或同一部手机的 FCM/APNs token）是"一个物理端点
 * 一份"，不是按账号区分的。Web/Android/iOS 都有"免密切换账号"（switchAccount，不走
 * logout），旧账号切走后从不主动清理自己在这台设备上的订阅/token 行。于是同一个 endpoint
 * 同时挂在新旧两个账号名下，push.js 的 pushToUser 给旧账号发消息时依然会推到这台已经登录
 * 新账号的设备上（buildBody 里 detail_preview 打开时甚至带真实消息内容），是真实的跨账号
 * 内容泄露，不是理论风险。
 *
 * 修复：webSubscribe/saveDeviceToken 写入前，先删掉该 endpoint/token 上属于其它 user_id 的
 * 旧订阅行，保证一个物理端点任意时刻只属于当前登录账号。
 */
const { db } = require('../src/db/connection');
const { request, app, makeUser } = require('./helpers');

describe('推送订阅账号切换串号防护（2026-09-10）', () => {
  const sameEndpoint = 'https://fcm.googleapis.com/fcm/send/shared-device-001';
  const sub = (endpoint) => ({ endpoint, keys: { p256dh: 'BOxxk', auth: 'abc' } });

  test('Web Push：账号 B 在同一 endpoint 订阅后，账号 A 的订阅行必须被清除', async () => {
    const a = await makeUser({ username: 'push_switch_a' });
    const b = await makeUser({ username: 'push_switch_b' });

    const resA = await request(app).post('/api/notifications/web-subscribe')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ subscription: sub(sameEndpoint) });
    expect(resA.status).toBe(200);
    expect(db.prepare('SELECT 1 FROM push_subscriptions WHERE user_id=? AND endpoint=?').get(a.userId, sameEndpoint)).toBeTruthy();

    // 免密切换账号：同一台设备/同一个 Service Worker endpoint，换成账号 B 订阅
    const resB = await request(app).post('/api/notifications/web-subscribe')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ subscription: sub(sameEndpoint) });
    expect(resB.status).toBe(200);

    // 断言：账号 A 在这个 endpoint 上的订阅必须已被清除，否则 A 会继续收到推到这台设备的推送
    const leaked = db.prepare('SELECT 1 FROM push_subscriptions WHERE user_id=? AND endpoint=?').get(a.userId, sameEndpoint);
    expect(leaked).toBeFalsy();
    // 账号 B 自己的订阅应正常存在
    expect(db.prepare('SELECT 1 FROM push_subscriptions WHERE user_id=? AND endpoint=?').get(b.userId, sameEndpoint)).toBeTruthy();
  });

  test('原生设备 token：账号 B 在同一 token 注册后，账号 A 的 device_tokens 行必须被清除', async () => {
    const a = await makeUser({ username: 'dev_switch_a' });
    const b = await makeUser({ username: 'dev_switch_b' });
    const sharedToken = 'shared-fcm-token-002';

    const resA = await request(app).post('/api/notifications/device-token')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ token: sharedToken, platform: 'android' });
    expect(resA.status).toBe(200);

    const resB = await request(app).post('/api/notifications/device-token')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ token: sharedToken, platform: 'android' });
    expect(resB.status).toBe(200);

    const leaked = db.prepare('SELECT 1 FROM device_tokens WHERE user_id=? AND token=?').get(a.userId, sharedToken);
    expect(leaked).toBeFalsy();
    expect(db.prepare('SELECT 1 FROM device_tokens WHERE user_id=? AND token=?').get(b.userId, sharedToken)).toBeTruthy();
  });
});
