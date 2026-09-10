'use strict';
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../db/connection');
const config = require('../../config');
const { badRequest } = require('../../utils/http');
const { isAllowedPushEndpoint } = require('../../utils/push');

function vapidPublicKey() {
  if (!config.vapid.publicKey) return null;
  return config.vapid.publicKey;
}

function webSubscribe(userId, subscription) {
  if (!subscription?.endpoint || typeof subscription.endpoint !== 'string' || subscription.endpoint.length > 2048)
    throw badRequest('订阅信息无效');
  // endpoint 必须来自已知浏览器推送服务域名，防 SSRF（endpoint 指向内网/元数据地址）
  if (!isAllowedPushEndpoint(subscription.endpoint))
    throw badRequest('订阅端点不受支持');
  // 同一浏览器 Service Worker 的 PushSubscription endpoint 是"一个来源一份"，不是按账号区分的。
  // 免密切换账号（switchAccount，不走 logout）不会清理旧账号在本 endpoint 上的订阅——
  // 旧表约束 UNIQUE(user_id, endpoint) 允许同一 endpoint 同时挂在新旧两个账号名下，
  // 导致这台设备之后收到的推送（含发件人/消息预览，见 push.js buildBody）会同时推给
  // 已经切走的旧账号——真实串号泄露，不是假设。先把该 endpoint 上其它账号的订阅清掉，
  // 保证一个物理 endpoint 任意时刻只属于当前登录的这一个账号。
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND user_id<>?').run(subscription.endpoint, userId);
  db.prepare(`
    INSERT INTO push_subscriptions (id, user_id, endpoint, subscription)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, endpoint) DO UPDATE SET subscription=excluded.subscription
  `).run(uuidv4(), userId, subscription.endpoint, JSON.stringify(subscription));
}

function webUnsubscribe(userId, endpoint) {
  if (endpoint) db.prepare('DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?').run(userId, endpoint);
  else db.prepare('DELETE FROM push_subscriptions WHERE user_id=?').run(userId);
}

function saveDeviceToken(userId, token, platform) {
  if (!token || typeof token !== 'string' || token.length > 512)
    throw badRequest('token 无效，长度不得超过 512 字符');
  // getui = 国产 ROM 的个推 CID（无 GMS 设备靠它兜底锁屏推送）。此前漏了 getui，
  // 导致个推 CID 注册被 400 拒绝、永远存不进库 → getuiPush 的 WHERE platform='getui'
  // 查询恒空 → 国产 ROM 锁屏推送从未生效。
  if (!['android', 'ios', 'ios_voip', 'getui'].includes(platform)) throw badRequest('参数无效，platform 必须为 android、ios、ios_voip 或 getui');
  // 同一物理设备的 FCM/APNs/个推 token 不按账号区分。Android/iOS 都有"免密切换账号"
  // （SessionManager/SessionStore switchAccount，不走 logout），旧账号切走后不会主动删除
  // 自己在本设备上的 device_tokens 行——与 webSubscribe 同一类串号缺陷：先清掉这台设备
  // token 挂在其它账号名下的旧订阅，保证任意时刻一个物理 token 只属于当前登录账号。
  db.prepare('DELETE FROM device_tokens WHERE token=? AND user_id<>?').run(token, userId);
  db.prepare(`
    INSERT INTO device_tokens (id, user_id, token, platform)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, token) DO UPDATE SET platform=excluded.platform, created_at=(strftime('%s','now'))
  `).run(uuidv4(), userId, token, platform);
}

function deleteDeviceToken(userId, token) {
  if (token) db.prepare('DELETE FROM device_tokens WHERE user_id=? AND token=?').run(userId, token);
  else db.prepare('DELETE FROM device_tokens WHERE user_id=?').run(userId);
}

function status(userId) {
  const webSubs = db.prepare('SELECT endpoint, created_at FROM push_subscriptions WHERE user_id=?').all(userId);
  const devices = db.prepare('SELECT platform, created_at FROM device_tokens WHERE user_id=?').all(userId);
  return {
    webPush: { enabled: !!config.vapid.publicKey, subscriptions: webSubs.length },
    fcm:     { enabled: !!process.env.FIREBASE_PROJECT_ID, devices: devices.length },
    detail:  { webSubs, devices },
  };
}

module.exports = { vapidPublicKey, webSubscribe, webUnsubscribe, saveDeviceToken, deleteDeviceToken, status };
