const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const QRCode = require('qrcode');
const db = require('../models/db');
const auth = require('../middleware/auth');
const { makeImageUploader } = require('../utils/upload');

const router = express.Router();

const AVATARS_DIR = path.join(__dirname, '../../uploads/avatars');
const uploadAvatar = makeImageUploader(AVATARS_DIR, 'avatar', 1, 5  * 1024 * 1024);
const uploadCover  = makeImageUploader(AVATARS_DIR, 'cover',  1, 10 * 1024 * 1024);

function userQrPayload(user) {
  return JSON.stringify({
    type: 'vxin-user',
    id: user.id,
    vxinId: user.wechat_id,
  });
}

const settingDefaults = {
  add_by_vxin_id: 1,
  add_by_phone: 1,
  require_verify: 1,
  profile_visible: 1,
  block_unknown_messages: 0,
  message_notify: 1,
  detail_preview: 1,
  sound: 1,
  vibrate: 0,
};

const toBool = value => !!Number(value);
const toIntBool = value => (value ? 1 : 0);

function ensureSettings(userId) {
  db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(userId);
  return db.prepare('SELECT * FROM user_settings WHERE user_id=?').get(userId);
}

function serializeSettings(row) {
  const settings = { ...settingDefaults, ...(row || {}) };
  return {
    addByVxinId: toBool(settings.add_by_vxin_id),
    addByPhone: toBool(settings.add_by_phone),
    requireVerify: toBool(settings.require_verify),
    profileVisible: toBool(settings.profile_visible),
    blockUnknownMessages: toBool(settings.block_unknown_messages),
    messageNotify: toBool(settings.message_notify),
    detailPreview: toBool(settings.detail_preview),
    sound: toBool(settings.sound),
    vibrate: toBool(settings.vibrate),
  };
}

function normalizeSettings(body) {
  const map = {
    addByVxinId: 'add_by_vxin_id',
    addByPhone: 'add_by_phone',
    requireVerify: 'require_verify',
    profileVisible: 'profile_visible',
    blockUnknownMessages: 'block_unknown_messages',
    messageNotify: 'message_notify',
    detailPreview: 'detail_preview',
    sound: 'sound',
    vibrate: 'vibrate',
  };
  const patch = {};
  for (const [clientKey, dbKey] of Object.entries(map)) {
    if (body[clientKey] !== undefined) patch[dbKey] = toIntBool(body[clientKey]);
  }
  return patch;
}

// 我的二维码
router.get('/me/qrcode', auth, async (req, res) => {
  const user = db.prepare('SELECT id,wechat_id FROM users WHERE id=?').get(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  try {
    const png = await QRCode.toBuffer(userQrPayload(user), {
      type: 'png',
      margin: 1,
      width: 280,
      errorCorrectionLevel: 'M',
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: '二维码生成失败' });
  }
});

// 我的设置
router.get('/me/settings', auth, (req, res) => {
  res.json(serializeSettings(ensureSettings(req.user.id)));
});

router.put('/me/settings', auth, (req, res) => {
  ensureSettings(req.user.id);
  const patch = normalizeSettings(req.body || {});
  if (Object.keys(patch).length) {
    const assignments = Object.keys(patch).map(key => `${key}=?`).join(',');
    const values = [...Object.values(patch), Math.floor(Date.now() / 1000), req.user.id];
    db.prepare(`UPDATE user_settings SET ${assignments}, updated_at=? WHERE user_id=?`).run(...values);
  }
  res.json(serializeSettings(ensureSettings(req.user.id)));
});

// 搜索用户
router.get('/search', auth, (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  if (q.length > 50) return res.status(400).json({ error: '搜索内容过长' });
  const users = db.prepare(`
    SELECT u.id,u.username,u.phone,u.avatar,u.bio,u.wechat_id
    FROM users u
    LEFT JOIN user_settings s ON s.user_id = u.id
    WHERE u.id != ?
      AND (
        u.username LIKE ?
        OR (u.wechat_id = ? AND COALESCE(s.add_by_vxin_id, 1) = 1)
        OR (u.phone = ? AND COALESCE(s.add_by_phone, 1) = 1)
      )
    LIMIT 20
  `).all(req.user.id, `%${q}%`, q, q);
  res.json(users);
});

// 获取我的联系人
router.get('/contacts', auth, (req, res) => {
  const contacts = db.prepare(`
    SELECT u.id, u.username, u.phone, u.avatar, u.bio, u.status, u.wechat_id, c.remark
    FROM contacts c
    JOIN users u ON u.id = c.contact_id
    WHERE c.user_id = ?
    ORDER BY COALESCE(c.remark, u.username) COLLATE NOCASE
  `).all(req.user.id);
  res.json(contacts);
});

// 发送好友请求
router.post('/friend-request', auth, (req, res) => {
  const { toId, message } = req.body;
  if (!toId) return res.status(400).json({ error: '参数缺失' });
  if (toId === req.user.id) return res.status(400).json({ error: '不能添加自己' });
  const target = db.prepare('SELECT id FROM users WHERE id=?').get(toId);
  if (!target) return res.status(404).json({ error: '用户不存在' });
  const existing = db.prepare('SELECT id FROM contacts WHERE user_id=? AND contact_id=?').get(req.user.id, toId);
  if (existing) return res.status(400).json({ error: '已是好友' });
  const isBlocked = db.prepare('SELECT 1 FROM blocked_users WHERE user_id=? AND blocked_id=?').get(toId, req.user.id);
  if (isBlocked) return res.status(403).json({ error: '对方已将你加入黑名单' });
  const pendingReq = db.prepare('SELECT id FROM friend_requests WHERE from_id=? AND to_id=? AND status=?').get(req.user.id, toId, 'pending');
  if (pendingReq) return res.status(400).json({ error: '请求已发送' });

  // 若双方同在某个"禁止互加好友"的群中，则拒绝
  const sharedRestrictedGroup = db.prepare(`
    SELECT c.name FROM conversation_members cm1
    JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
    JOIN conversations c ON c.id = cm1.conversation_id
    WHERE cm1.user_id = ? AND cm2.user_id = ? AND c.no_add_friend = 1
    LIMIT 1
  `).get(req.user.id, toId);
  if (sharedRestrictedGroup) {
    return res.status(403).json({ error: `「${sharedRestrictedGroup.name}」已开启"禁止群成员互相添加好友"` });
  }

  const targetSettings = serializeSettings(ensureSettings(toId));
  if (!targetSettings.requireVerify) {
    const addContact = db.prepare('INSERT OR IGNORE INTO contacts (id,user_id,contact_id) VALUES (?,?,?)');
    addContact.run(uuidv4(), req.user.id, toId);
    addContact.run(uuidv4(), toId, req.user.id);

    const io = req.app.get('io');
    const sender = db.prepare('SELECT id,username,avatar,wechat_id FROM users WHERE id=?').get(req.user.id);
    if (io) io.to(`user_${toId}`).emit('friend_request_accepted', { accepter: sender, autoAccepted: true });
    return res.json({ success: true, autoAccepted: true });
  }

  const id = uuidv4();
  db.prepare('INSERT INTO friend_requests (id,from_id,to_id,message) VALUES (?,?,?,?)').run(id, req.user.id, toId, message || '');

  const io = req.app.get('io');
  const sender = db.prepare('SELECT id,username,avatar,wechat_id FROM users WHERE id=?').get(req.user.id);
  if (io) io.to(`user_${toId}`).emit('new_friend_request', { id, from: sender, message: message || '' });

  res.json({ success: true, id });
});

// 获取收到的好友请求列表
router.get('/friend-requests', auth, (req, res) => {
  const requests = db.prepare(`
    SELECT fr.*, u.username, u.avatar, u.phone, u.wechat_id
    FROM friend_requests fr
    JOIN users u ON u.id = fr.from_id
    WHERE fr.to_id=? AND fr.status='pending'
    ORDER BY fr.created_at DESC
  `).all(req.user.id);
  res.json(requests);
});

// 获取已发出的好友请求列表
router.get('/friend-requests/sent', auth, (req, res) => {
  const requests = db.prepare(`
    SELECT fr.id, fr.status, fr.message, fr.created_at,
           u.id as toId, u.username, u.avatar, u.wechat_id
    FROM friend_requests fr
    JOIN users u ON u.id = fr.to_id
    WHERE fr.from_id=?
    ORDER BY fr.created_at DESC
    LIMIT 50
  `).all(req.user.id);
  res.json(requests);
});

// 处理好友请求
router.post('/friend-request/:id/handle', auth, (req, res) => {
  const { action } = req.body;
  const request = db.prepare('SELECT * FROM friend_requests WHERE id=? AND to_id=?').get(req.params.id, req.user.id);
  if (!request) return res.status(404).json({ error: '请求不存在' });

  db.prepare('UPDATE friend_requests SET status=? WHERE id=?').run(action, req.params.id);

  if (action === 'accepted') {
    const addContact = db.prepare('INSERT OR IGNORE INTO contacts (id,user_id,contact_id) VALUES (?,?,?)');
    addContact.run(uuidv4(), request.from_id, request.to_id);
    addContact.run(uuidv4(), request.to_id, request.from_id);

    const io = req.app.get('io');
    const accepter = db.prepare('SELECT id,username,avatar FROM users WHERE id=?').get(req.user.id);
    if (io) io.to(`user_${request.from_id}`).emit('friend_request_accepted', { accepter });
  }
  res.json({ success: true });
});

// 删除好友
router.delete('/contacts/:contactId', auth, (req, res) => {
  db.prepare('DELETE FROM contacts WHERE user_id=? AND contact_id=?').run(req.user.id, req.params.contactId);
  res.json({ success: true });
});

// 设置备注
router.put('/contacts/:contactId/remark', auth, (req, res) => {
  const { remark } = req.body;
  db.prepare('UPDATE contacts SET remark=? WHERE user_id=? AND contact_id=?').run(remark || '', req.user.id, req.params.contactId);
  res.json({ success: true });
});

// 上传头像
router.post('/avatar', auth, ...uploadAvatar, (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择图片' });
  const url = `/uploads/avatars/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar=? WHERE id=?').run(url, req.user.id);
  res.json({ avatar: url });
});

// 上传封面
router.post('/cover', auth, ...uploadCover, (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择图片' });
  const url = `/uploads/avatars/${req.file.filename}`;
  db.prepare('UPDATE users SET cover_photo=? WHERE id=?').run(url, req.user.id);
  res.json({ cover_photo: url });
});

// 更新个人资料
router.put('/profile', auth, (req, res) => {
  const { username, bio } = req.body;
  if (username) {
    const taken = db.prepare('SELECT id FROM users WHERE username=? AND id!=?').get(username, req.user.id);
    if (taken) return res.status(400).json({ error: '用户名已被占用' });
    db.prepare('UPDATE users SET username=? WHERE id=?').run(username, req.user.id);
  }
  if (bio !== undefined) db.prepare('UPDATE users SET bio=? WHERE id=?').run(bio, req.user.id);
  const user = db.prepare('SELECT id,username,phone,avatar,bio,wechat_id,cover_photo FROM users WHERE id=?').get(req.user.id);
  res.json(user);
});

// 获取用户信息
router.get('/:id', auth, (req, res) => {
  const user = db.prepare('SELECT id,username,phone,avatar,bio,status,wechat_id,cover_photo FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const isFriend = !!db.prepare('SELECT 1 FROM contacts WHERE user_id=? AND contact_id=?').get(req.user.id, req.params.id);
  const isBlocked = !!db.prepare('SELECT 1 FROM blocked_users WHERE user_id=? AND blocked_id=?').get(req.user.id, req.params.id);
  const contact = db.prepare('SELECT remark FROM contacts WHERE user_id=? AND contact_id=?').get(req.user.id, req.params.id);
  const settings = serializeSettings(ensureSettings(req.params.id));
  const visible = isFriend || req.params.id === req.user.id || settings.profileVisible;
  const pendingReq = db.prepare('SELECT id FROM friend_requests WHERE from_id=? AND to_id=? AND status=?').get(req.user.id, req.params.id, 'pending');
  res.json({
    ...user,
    phone: visible ? user.phone : '',
    bio: visible ? user.bio : '',
    cover_photo: visible ? user.cover_photo : '',
    isFriend,
    isBlocked,
    remark: contact?.remark || '',
    hasPendingRequest: !!pendingReq,
  });
});

// 获取收藏列表
router.get('/me/collections', auth, (req, res) => {
  const items = db.prepare('SELECT * FROM collections WHERE user_id=? ORDER BY created_at DESC').all(req.user.id);
  res.json(items.map(i => ({ ...i, extra: JSON.parse(i.extra || '{}') })));
});

// 拉黑用户
router.post('/block/:targetId', auth, (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE id=?').get(req.params.targetId);
  if (!target) return res.status(404).json({ error: '用户不存在' });
  if (req.params.targetId === req.user.id) return res.status(400).json({ error: '不能拉黑自己' });
  try {
    db.prepare('INSERT INTO blocked_users (id,user_id,blocked_id) VALUES (?,?,?)').run(uuidv4(), req.user.id, req.params.targetId);
  } catch (e) {
    if (!e.message?.includes('UNIQUE')) {
      console.error('[block] 操作失败:', e.message);
      return res.status(500).json({ error: '操作失败，请重试' });
    }
    // UNIQUE 冲突 = 已经拉黑过，静默忽略
  }
  res.json({ success: true, blocked: true });
});

// 取消拉黑
router.delete('/block/:targetId', auth, (req, res) => {
  db.prepare('DELETE FROM blocked_users WHERE user_id=? AND blocked_id=?').run(req.user.id, req.params.targetId);
  res.json({ success: true, blocked: false });
});

// 获取拉黑列表
router.get('/me/blocked', auth, (req, res) => {
  const list = db.prepare(`
    SELECT u.id, u.username, u.avatar FROM blocked_users b
    JOIN users u ON u.id=b.blocked_id
    WHERE b.user_id=?
  `).all(req.user.id);
  res.json(list);
});

module.exports = router;
