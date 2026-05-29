const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

const avatarStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/avatars'),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const coverStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/avatars'),
  filename: (req, file, cb) => cb(null, 'cover_' + uuidv4() + path.extname(file.originalname))
});
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadCover = multer({ storage: coverStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// 搜索用户
router.get('/search', auth, (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const users = db.prepare(
    'SELECT id,username,phone,avatar,bio,wechat_id FROM users WHERE (phone=? OR username LIKE ? OR wechat_id=?) AND id!=? LIMIT 20'
  ).all(q, `%${q}%`, q, req.user.id);
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
  const existing = db.prepare('SELECT id FROM contacts WHERE user_id=? AND contact_id=?').get(req.user.id, toId);
  if (existing) return res.status(400).json({ error: '已是好友' });
  const isBlocked = db.prepare('SELECT 1 FROM blocked_users WHERE user_id=? AND blocked_id=?').get(toId, req.user.id);
  if (isBlocked) return res.status(403).json({ error: '对方已将你加入黑名单' });
  const pendingReq = db.prepare('SELECT id FROM friend_requests WHERE from_id=? AND to_id=? AND status=?').get(req.user.id, toId, 'pending');
  if (pendingReq) return res.status(400).json({ error: '请求已发送' });
  const id = uuidv4();
  db.prepare('INSERT INTO friend_requests (id,from_id,to_id,message) VALUES (?,?,?,?)').run(id, req.user.id, toId, message || '');

  const io = req.app.get('io');
  const sender = db.prepare('SELECT id,username,avatar,wechat_id FROM users WHERE id=?').get(req.user.id);
  if (io) io.to(`user_${toId}`).emit('new_friend_request', { id, from: sender, message: message || '' });

  res.json({ success: true, id });
});

// 获取好友请求列表
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
router.post('/avatar', auth, uploadAvatar.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择图片' });
  const url = `/uploads/avatars/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar=? WHERE id=?').run(url, req.user.id);
  res.json({ avatar: url });
});

// 上传封面
router.post('/cover', auth, uploadCover.single('cover'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择图片' });
  const url = `/uploads/avatars/${req.file.filename}`;
  db.prepare('UPDATE users SET cover_photo=? WHERE id=?').run(url, req.user.id);
  res.json({ cover_photo: url });
});

// 更新个人资料
router.put('/profile', auth, (req, res) => {
  const { username, bio, wechat_id } = req.body;
  if (username) {
    const taken = db.prepare('SELECT id FROM users WHERE username=? AND id!=?').get(username, req.user.id);
    if (taken) return res.status(400).json({ error: '用户名已被占用' });
    db.prepare('UPDATE users SET username=? WHERE id=?').run(username, req.user.id);
  }
  if (wechat_id !== undefined) {
    const taken = db.prepare('SELECT id FROM users WHERE wechat_id=? AND id!=? AND wechat_id!=?').get(wechat_id, req.user.id, '');
    if (taken) return res.status(400).json({ error: '微信号已被占用' });
    db.prepare('UPDATE users SET wechat_id=? WHERE id=?').run(wechat_id, req.user.id);
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
  res.json({ ...user, isFriend, isBlocked, remark: contact?.remark || '' });
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
  } catch {}
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
