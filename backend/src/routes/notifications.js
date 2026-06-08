const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');
const auth = require('../middleware/auth');

const router = express.Router();

// ── VAPID 公钥（前端订阅时需要）─────────────────────────────────
router.get('/vapid-public-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'Web Push 未配置' });
  res.json({ publicKey: key });
});

// ── 保存 Web Push 订阅 ───────────────────────────────────────────
router.post('/web-subscribe', auth, (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: '订阅信息无效' });

  try {
    db.prepare(`
      INSERT INTO push_subscriptions (id, user_id, endpoint, subscription)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, endpoint) DO UPDATE SET subscription=excluded.subscription
    `).run(uuidv4(), req.user.id, subscription.endpoint, JSON.stringify(subscription));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '保存失败' });
  }
});

// ── 删除 Web Push 订阅（用户主动取消或登出）─────────────────────
router.delete('/web-subscribe', auth, (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) {
    db.prepare('DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?').run(req.user.id, endpoint);
  } else {
    db.prepare('DELETE FROM push_subscriptions WHERE user_id=?').run(req.user.id);
  }
  res.json({ success: true });
});

// ── 保存移动端设备 Token（FCM/APNs）─────────────────────────────
router.post('/device-token', auth, (req, res) => {
  const { token, platform } = req.body;
  if (!token || !['android', 'ios'].includes(platform)) {
    return res.status(400).json({ error: '参数无效，platform 必须为 android 或 ios' });
  }
  try {
    db.prepare(`
      INSERT INTO device_tokens (id, user_id, token, platform)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, token) DO UPDATE SET platform=excluded.platform, created_at=(strftime('%s','now'))
    `).run(uuidv4(), req.user.id, token, platform);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: '保存失败' });
  }
});

// ── 删除设备 Token（登出时调用）─────────────────────────────────
router.delete('/device-token', auth, (req, res) => {
  const { token } = req.body;
  if (token) {
    db.prepare('DELETE FROM device_tokens WHERE user_id=? AND token=?').run(req.user.id, token);
  } else {
    db.prepare('DELETE FROM device_tokens WHERE user_id=?').run(req.user.id);
  }
  res.json({ success: true });
});

// ── 查询当前用户的推送状态（调试用）────────────────────────────
router.get('/status', auth, (req, res) => {
  const webSubs = db.prepare('SELECT endpoint, created_at FROM push_subscriptions WHERE user_id=?').all(req.user.id);
  const devices = db.prepare('SELECT platform, created_at FROM device_tokens WHERE user_id=?').all(req.user.id);
  res.json({
    webPush: { enabled: !!process.env.VAPID_PUBLIC_KEY, subscriptions: webSubs.length },
    fcm: { enabled: !!(process.env.FIREBASE_PROJECT_ID), devices: devices.length },
    detail: { webSubs, devices },
  });
});

module.exports = router;
