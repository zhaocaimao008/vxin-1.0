'use strict';
/**
 * 回归：语音来电提醒 bug 修复。
 *
 * 根因：call.js 曾用 presence.isOnline(to) 门控 pushCallInvite —— App 后台/锁屏但
 * socket 进程仍连着时被误判「在线」，来电推送永远不发，只能等用户打开 App 才看到来电。
 * pushNewMessage 早已修过同样的「幽灵在线」问题（总是推送，客户端去重），来电链路
 * 之前漏掉了。本测试锁定 pushCallInvite 本身「总是尝试推送」+「FCM/iOS/个推三条通道
 * 都覆盖」的契约，防止再退化回按 presence 过滤。
 */
require('./testEnv');

process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_CLIENT_EMAIL = 'test@example.com';
process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n';
process.env.GETUI_APP_ID = 'test-app-id';
process.env.GETUI_APP_KEY = 'test-app-key';
process.env.GETUI_MASTER_SECRET = 'test-master-secret';

jest.mock('firebase-admin', () => {
  const sendMock = jest.fn().mockResolvedValue('mock-message-id');
  return {
    apps: [],
    credential: { cert: jest.fn(() => ({})) },
    initializeApp: jest.fn(),
    messaging: () => ({ send: sendMock }),
    __sendMock: sendMock,
  };
});

jest.mock('../src/utils/getuiPush', () => ({
  isEnabled: jest.fn(() => true),
  pushToCid: jest.fn().mockResolvedValue({ status: 200, json: { code: 0 } }),
}));

const { db } = require('../src/db/connection');
const { makeUser } = require('./helpers');
const { pushCallInvite } = require('../src/utils/push');
const getuiPush = require('../src/utils/getuiPush');
const firebaseAdmin = require('firebase-admin');

describe('pushCallInvite 来电推送', () => {
  let u;

  beforeAll(async () => {
    u = await makeUser({ username: 'call_push_target' });
  });

  afterEach(() => {
    firebaseAdmin.__sendMock.mockClear();
    getuiPush.pushToCid.mockClear();
    db.prepare('DELETE FROM device_tokens WHERE user_id=?').run(u.userId);
  });

  test('不接收 presence/isOnline 参数：只要有 device_tokens 就总是推送', async () => {
    db.prepare("INSERT INTO device_tokens (id,user_id,token,platform) VALUES (?,?,?,?)")
      .run('dt-android-1', u.userId, 'fcm-android-tok', 'android');
    await pushCallInvite({ toUserId: u.userId, fromUserId: 'caller1', callerName: '小明', callType: 'audio', callId: 'call-1' });
    expect(firebaseAdmin.__sendMock).toHaveBeenCalledTimes(1);
    const msg = firebaseAdmin.__sendMock.mock.calls[0][0];
    expect(msg.data.type).toBe('call');
    expect(msg.data.callId).toBe('call-1');
    expect(msg.android.priority).toBe('high');
  });

  test('iOS 设备附带 apns content-available 后台唤醒块（不含普通 alert，避免静默无效）', async () => {
    db.prepare("INSERT INTO device_tokens (id,user_id,token,platform) VALUES (?,?,?,?)")
      .run('dt-ios-1', u.userId, 'fcm-ios-tok', 'ios');
    await pushCallInvite({ toUserId: u.userId, fromUserId: 'caller1', callerName: '小明', callType: 'video', callId: 'call-2' });
    expect(firebaseAdmin.__sendMock).toHaveBeenCalledTimes(1);
    const msg = firebaseAdmin.__sendMock.mock.calls[0][0];
    expect(msg.apns.payload.aps['content-available']).toBe(1);
    expect(msg.apns.headers['apns-push-type']).toBe('background');
    expect(msg.notification).toBeUndefined();
  });

  test('个推分支：国产 ROM（无 FCM token，只有 getui CID）也能收到来电透传', async () => {
    db.prepare("INSERT INTO device_tokens (id,user_id,token,platform) VALUES (?,?,?,?)")
      .run('dt-getui-1', u.userId, 'getui-cid-1', 'getui');
    await pushCallInvite({ toUserId: u.userId, fromUserId: 'caller1', callerName: '小明', callType: 'audio', callId: 'call-3' });
    expect(firebaseAdmin.__sendMock).not.toHaveBeenCalled(); // 没有 android/ios token，不该碰 FCM
    expect(getuiPush.pushToCid).toHaveBeenCalledTimes(1);
    const [cid, opts] = getuiPush.pushToCid.mock.calls[0];
    expect(cid).toBe('getui-cid-1');
    expect(opts.payload.type).toBe('call');
    expect(opts.payload.callId).toBe('call-3');
    expect(opts.payload.callerName).toBe('小明');
  });

  test('FCM 与个推并行：同一用户同时有 android + getui token 都收到推送', async () => {
    db.prepare("INSERT INTO device_tokens (id,user_id,token,platform) VALUES (?,?,?,?)")
      .run('dt-android-2', u.userId, 'fcm-android-tok-2', 'android');
    db.prepare("INSERT INTO device_tokens (id,user_id,token,platform) VALUES (?,?,?,?)")
      .run('dt-getui-2', u.userId, 'getui-cid-2', 'getui');
    await pushCallInvite({ toUserId: u.userId, fromUserId: 'caller1', callerName: '小明', callType: 'audio', callId: 'call-4' });
    expect(firebaseAdmin.__sendMock).toHaveBeenCalledTimes(1);
    expect(getuiPush.pushToCid).toHaveBeenCalledTimes(1);
  });

  test('无任何 device_tokens 时不报错、不发任何推送', async () => {
    await expect(
      pushCallInvite({ toUserId: u.userId, fromUserId: 'caller1', callerName: '小明', callType: 'audio', callId: 'call-5' })
    ).resolves.toBeUndefined();
    expect(firebaseAdmin.__sendMock).not.toHaveBeenCalled();
    expect(getuiPush.pushToCid).not.toHaveBeenCalled();
  });
});
