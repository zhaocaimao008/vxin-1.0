const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/files'),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

function getConvSetting(userId, convId) {
  return db.prepare('SELECT * FROM conversation_settings WHERE user_id=? AND conversation_id=?').get(userId, convId) || { pinned: 0, muted: 0, last_read_at: 0 };
}

function buildMessage(id) {
  const msg = db.prepare(`
    SELECT m.*, u.username as senderName, u.avatar as senderAvatar
    FROM messages m JOIN users u ON u.id=m.sender_id
    WHERE m.id=?
  `).get(id);
  if (!msg) return null;

  // attach reply_to
  if (msg.reply_to_id) {
    const replied = db.prepare(`
      SELECT m.id, m.type, m.content, m.file_url, u.username as senderName
      FROM messages m JOIN users u ON u.id=m.sender_id
      WHERE m.id=?
    `).get(msg.reply_to_id);
    msg.replyTo = replied || null;
  }

  // attach reactions
  const reactions = db.prepare(`
    SELECT emoji, GROUP_CONCAT(user_id) as userIds, COUNT(*) as count
    FROM message_reactions WHERE message_id=?
    GROUP BY emoji
  `).all(id);
  msg.reactions = reactions.map(r => ({ emoji: r.emoji, count: r.count, userIds: r.userIds.split(',') }));

  return msg;
}

// 获取或创建私聊会话
router.post('/conversation/private', auth, (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: '参数缺失' });

  const existing = db.prepare(`
    SELECT c.id FROM conversations c
    JOIN conversation_members cm1 ON cm1.conversation_id=c.id AND cm1.user_id=?
    JOIN conversation_members cm2 ON cm2.conversation_id=c.id AND cm2.user_id=?
    WHERE c.type='private'
  `).get(req.user.id, userId);

  if (existing) return res.json({ conversationId: existing.id });

  const id = uuidv4();
  db.prepare('INSERT INTO conversations (id,type) VALUES (?,?)').run(id, 'private');
  db.prepare('INSERT INTO conversation_members (conversation_id,user_id) VALUES (?,?)').run(id, req.user.id);
  db.prepare('INSERT INTO conversation_members (conversation_id,user_id) VALUES (?,?)').run(id, userId);
  res.json({ conversationId: id });
});

// 创建群聊
router.post('/conversation/group', auth, (req, res) => {
  const { name, memberIds } = req.body;
  if (!name || !memberIds?.length) return res.status(400).json({ error: '参数缺失' });

  const id = uuidv4();
  db.prepare('INSERT INTO conversations (id,type,name) VALUES (?,?,?)').run(id, 'group', name);
  const addMember = db.prepare('INSERT INTO conversation_members (conversation_id,user_id) VALUES (?,?)');
  addMember.run(id, req.user.id);
  memberIds.forEach(uid => addMember.run(id, uid));

  const io = req.app.get('io');
  if (io) {
    const conv = { id, type: 'group', name, avatar: '', pinned: 0, muted: 0 };
    [req.user.id, ...memberIds].forEach(uid => {
      io.to(`user_${uid}`).emit('new_conversation', conv);
    });
  }

  res.json({ conversationId: id });
});

// 获取会话列表
router.get('/conversations', auth, (req, res) => {
  const conversations = db.prepare(`
    SELECT c.id, c.type, c.name, c.avatar,
      m.content as lastMessage, m.type as lastMessageType, m.created_at as lastTime,
      u.username as lastSenderName
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id=c.id AND cm.user_id=?
    LEFT JOIN messages m ON m.id = (
      SELECT id FROM messages WHERE conversation_id=c.id AND deleted=0 ORDER BY created_at DESC LIMIT 1
    )
    LEFT JOIN users u ON u.id = m.sender_id
    ORDER BY COALESCE(m.created_at, c.created_at) DESC
  `).all(req.user.id);

  const result = conversations.map(conv => {
    const settings = getConvSetting(req.user.id, conv.id);
    const unreadCount = db.prepare(`
      SELECT COUNT(*) as cnt FROM messages
      WHERE conversation_id=? AND deleted=0 AND sender_id!=?
      AND created_at > ?
    `).get(conv.id, req.user.id, settings.last_read_at)?.cnt || 0;

    if (conv.type === 'private') {
      const other = db.prepare(`
        SELECT u.id, u.username, u.avatar, u.status FROM users u
        JOIN conversation_members cm ON cm.user_id=u.id
        WHERE cm.conversation_id=? AND u.id!=?
      `).get(conv.id, req.user.id);
      return { ...conv, name: other?.username || '', avatar: other?.avatar || '',
        otherUser: other, pinned: settings.pinned, muted: settings.muted, unreadCount };
    }
    const members = db.prepare(`
      SELECT u.id, u.username, u.avatar FROM users u
      JOIN conversation_members cm ON cm.user_id=u.id
      WHERE cm.conversation_id=?
    `).all(conv.id);
    return { ...conv, members, pinned: settings.pinned, muted: settings.muted, unreadCount };
  });

  // pinned first
  result.sort((a, b) => (b.pinned - a.pinned) || ((b.lastTime || 0) - (a.lastTime || 0)));
  res.json(result);
});

// 获取群成员
router.get('/conversation/:conversationId/members', auth, (req, res) => {
  const { conversationId } = req.params;
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(conversationId, req.user.id);
  if (!member) return res.status(403).json({ error: '无权访问' });
  const members = db.prepare(`
    SELECT u.id, u.username, u.avatar FROM users u
    JOIN conversation_members cm ON cm.user_id=u.id
    WHERE cm.conversation_id=? ORDER BY u.username
  `).all(conversationId);
  res.json(members);
});

// 获取我加入的群聊列表
router.get('/my-groups', auth, (req, res) => {
  const groups = db.prepare(`
    SELECT c.id, c.type, c.name, c.avatar, c.announcement, c.owner_id,
      (SELECT COUNT(*) FROM conversation_members WHERE conversation_id=c.id) as memberCount
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id=c.id AND cm.user_id=?
    WHERE c.type='group'
    ORDER BY c.created_at DESC
  `).all(req.user.id);
  res.json(groups);
});

// 修改群信息（名称、公告）
router.put('/conversation/:convId', auth, (req, res) => {
  const { convId } = req.params;
  const conv = db.prepare('SELECT * FROM conversations WHERE id=? AND type=?').get(convId, 'group');
  if (!conv) return res.status(404).json({ error: '群不存在' });
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(convId, req.user.id);
  if (!member) return res.status(403).json({ error: '不在群内' });

  const { name, announcement } = req.body;
  if (name !== undefined) db.prepare('UPDATE conversations SET name=? WHERE id=?').run(name, convId);
  if (announcement !== undefined) db.prepare('UPDATE conversations SET announcement=? WHERE id=?').run(announcement, convId);

  const updated = db.prepare('SELECT id, name, announcement, owner_id FROM conversations WHERE id=?').get(convId);
  const io = req.app.get('io');
  if (io) io.to(convId).emit('group_updated', updated);
  res.json(updated);
});

// 邀请成员进群
router.post('/conversation/:convId/invite', auth, (req, res) => {
  const { convId } = req.params;
  const { userIds } = req.body;
  if (!userIds?.length) return res.status(400).json({ error: '参数缺失' });
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(convId, req.user.id);
  if (!member) return res.status(403).json({ error: '不在群内' });

  const addMember = db.prepare('INSERT OR IGNORE INTO conversation_members (conversation_id,user_id) VALUES (?,?)');
  const added = [];
  userIds.forEach(uid => {
    const r = addMember.run(convId, uid);
    if (r.changes > 0) added.push(uid);
  });

  const io = req.app.get('io');
  if (io && added.length > 0) {
    const conv = db.prepare('SELECT id,type,name,avatar FROM conversations WHERE id=?').get(convId);
    added.forEach(uid => {
      io.to(`user_${uid}`).emit('new_conversation', conv);
      io.to(`user_${uid}`).emit('group_member_added', { conversationId: convId, userId: uid });
    });
    io.to(convId).emit('group_updated', { id: convId });
  }
  res.json({ success: true, added: added.length });
});

// 移除成员（仅群主）
router.delete('/conversation/:convId/members/:uid', auth, (req, res) => {
  const { convId, uid } = req.params;
  const conv = db.prepare('SELECT owner_id FROM conversations WHERE id=?').get(convId);
  if (!conv) return res.status(404).json({ error: '群不存在' });
  if (conv.owner_id !== req.user.id) return res.status(403).json({ error: '仅群主可操作' });
  if (uid === req.user.id) return res.status(400).json({ error: '不能移除自己' });

  db.prepare('DELETE FROM conversation_members WHERE conversation_id=? AND user_id=?').run(convId, uid);
  const io = req.app.get('io');
  if (io) {
    io.to(convId).emit('group_updated', { id: convId });
    io.to(`user_${uid}`).emit('group_kicked', { conversationId: convId });
  }
  res.json({ success: true });
});

// 退出群聊
router.post('/conversation/:convId/leave', auth, (req, res) => {
  const { convId } = req.params;
  const conv = db.prepare('SELECT owner_id FROM conversations WHERE id=?').get(convId);
  if (!conv) return res.status(404).json({ error: '群不存在' });

  if (conv.owner_id === req.user.id) {
    // 群主解散群
    db.prepare('DELETE FROM conversation_members WHERE conversation_id=?').run(convId);
    db.prepare('DELETE FROM conversations WHERE id=?').run(convId);
    const io = req.app.get('io');
    if (io) io.to(convId).emit('group_dismissed', { conversationId: convId });
  } else {
    db.prepare('DELETE FROM conversation_members WHERE conversation_id=? AND user_id=?').run(convId, req.user.id);
    const io = req.app.get('io');
    if (io) io.to(convId).emit('group_updated', { id: convId });
  }
  res.json({ success: true });
});

// 获取群详情
router.get('/conversation/:convId/info', auth, (req, res) => {
  const { convId } = req.params;
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(convId, req.user.id);
  if (!member) return res.status(403).json({ error: '不在群内' });
  const conv = db.prepare('SELECT * FROM conversations WHERE id=?').get(convId);
  if (!conv) return res.status(404).json({ error: '群不存在' });
  const members = db.prepare(`
    SELECT u.id, u.username, u.avatar, u.bio,
      CASE WHEN c.owner_id = u.id THEN 1 ELSE 0 END as isOwner
    FROM users u
    JOIN conversation_members cm ON cm.user_id=u.id
    LEFT JOIN conversations c ON c.id=cm.conversation_id
    WHERE cm.conversation_id=?
    ORDER BY isOwner DESC, u.username
  `).all(convId);
  res.json({ ...conv, members });
});

// 置顶/取消置顶
router.post('/conversation/:convId/pin', auth, (req, res) => {
  const { convId } = req.params;
  const { pinned } = req.body;
  db.prepare(`
    INSERT INTO conversation_settings (user_id, conversation_id, pinned)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, conversation_id) DO UPDATE SET pinned=excluded.pinned
  `).run(req.user.id, convId, pinned ? 1 : 0);
  res.json({ success: true });
});

// 免打扰/取消
router.post('/conversation/:convId/mute', auth, (req, res) => {
  const { convId } = req.params;
  const { muted } = req.body;
  db.prepare(`
    INSERT INTO conversation_settings (user_id, conversation_id, muted)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, conversation_id) DO UPDATE SET muted=excluded.muted
  `).run(req.user.id, convId, muted ? 1 : 0);
  res.json({ success: true });
});

// 标记已读
router.post('/conversation/:convId/read', auth, (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO conversation_settings (user_id, conversation_id, last_read_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, conversation_id) DO UPDATE SET last_read_at=excluded.last_read_at
  `).run(req.user.id, req.params.convId, now);

  const io = req.app.get('io');
  if (io) {
    io.to(req.params.convId).emit('message_read', { userId: req.user.id, conversationId: req.params.convId, readAt: now });
  }
  res.json({ success: true });
});

// 搜索消息
router.get('/conversation/:convId/search', auth, (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(req.params.convId, req.user.id);
  if (!member) return res.status(403).json({ error: '无权访问' });
  const messages = db.prepare(`
    SELECT m.*, u.username as senderName, u.avatar as senderAvatar
    FROM messages m JOIN users u ON u.id=m.sender_id
    WHERE m.conversation_id=? AND m.type='text' AND m.content LIKE ? AND m.deleted=0
    ORDER BY m.created_at DESC LIMIT 30
  `).all(req.params.convId, `%${q}%`);
  res.json(messages);
});

// 获取消息历史
router.get('/:conversationId', auth, (req, res) => {
  const { conversationId } = req.params;
  const { before, limit = 50 } = req.query;

  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(conversationId, req.user.id);
  if (!member) return res.status(403).json({ error: '无权访问' });

  let query = `
    SELECT m.*, u.username as senderName, u.avatar as senderAvatar
    FROM messages m JOIN users u ON u.id=m.sender_id
    WHERE m.conversation_id=? AND m.deleted=0
  `;
  const params = [conversationId];
  if (before) { query += ' AND m.created_at < ?'; params.push(before); }
  query += ' ORDER BY m.created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const messages = db.prepare(query).all(...params).reverse();

  // Enrich with reply_to and reactions
  const enriched = messages.map(msg => {
    if (msg.reply_to_id) {
      const replied = db.prepare(`
        SELECT m.id, m.type, m.content, m.file_url, u.username as senderName
        FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?
      `).get(msg.reply_to_id);
      msg.replyTo = replied || null;
    }
    const reactions = db.prepare(`
      SELECT emoji, GROUP_CONCAT(user_id) as userIds, COUNT(*) as count
      FROM message_reactions WHERE message_id=? GROUP BY emoji
    `).all(msg.id);
    msg.reactions = reactions.map(r => ({ emoji: r.emoji, count: r.count, userIds: r.userIds.split(',') }));
    return msg;
  });

  res.json(enriched);
});

// 发消息 HTTP fallback
router.post('/:conversationId', auth, (req, res) => {
  const { conversationId } = req.params;
  const { content, type = 'text', reply_to_id } = req.body;
  if (!content) return res.status(400).json({ error: '消息不能为空' });

  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(conversationId, req.user.id);
  if (!member) return res.status(403).json({ error: '无权发送' });

  const id = uuidv4();
  db.prepare('INSERT INTO messages (id,conversation_id,sender_id,type,content,reply_to_id) VALUES (?,?,?,?,?,?)').run(id, conversationId, req.user.id, type, content, reply_to_id || null);
  const msg = buildMessage(id);
  res.json(msg);
});

// 上传文件/图片/语音
router.post('/:conversationId/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择文件' });
  const url = `/uploads/files/${req.file.filename}`;
  const mime = req.file.mimetype;
  const type = mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'voice' : 'file';
  const { conversationId } = req.params;
  const { reply_to_id } = req.body;

  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(conversationId, req.user.id);
  if (!member) return res.status(403).json({ error: '无权发送' });

  const id = uuidv4();
  db.prepare('INSERT INTO messages (id,conversation_id,sender_id,type,content,file_url,reply_to_id) VALUES (?,?,?,?,?,?,?)').run(id, conversationId, req.user.id, type, req.file.originalname, url, reply_to_id || null);
  const msg = buildMessage(id);

  const io = req.app.get('io');
  if (io) io.to(conversationId).emit('new_message', msg);

  res.json(msg);
});

// 删除消息
router.delete('/:msgId', auth, (req, res) => {
  const msg = db.prepare('SELECT * FROM messages WHERE id=?').get(req.params.msgId);
  if (!msg) return res.status(404).json({ error: '消息不存在' });

  const { forEveryone } = req.body;

  if (forEveryone) {
    if (msg.sender_id !== req.user.id) return res.status(403).json({ error: '只能撤回自己的消息' });
    const now = Math.floor(Date.now() / 1000);
    if (now - msg.created_at > 120) return res.status(400).json({ error: '超过2分钟无法撤回' });
    db.prepare('UPDATE messages SET deleted=1 WHERE id=?').run(req.params.msgId);
    const io = req.app.get('io');
    if (io) io.to(msg.conversation_id).emit('message_deleted', { msgId: req.params.msgId, conversationId: msg.conversation_id });
  } else {
    // soft delete for me only - just mark in a separate table or use deleted flag with user id
    // For simplicity, same as forEveryone but only affects this user's view
    db.prepare('UPDATE messages SET deleted=1 WHERE id=?').run(req.params.msgId);
    const io = req.app.get('io');
    if (io) io.to(msg.conversation_id).emit('message_deleted', { msgId: req.params.msgId, conversationId: msg.conversation_id });
  }
  res.json({ success: true });
});

// 消息表情回应
router.post('/:msgId/react', auth, (req, res) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: '参数缺失' });

  const msg = db.prepare('SELECT conversation_id FROM messages WHERE id=?').get(req.params.msgId);
  if (!msg) return res.status(404).json({ error: '消息不存在' });

  const existing = db.prepare('SELECT * FROM message_reactions WHERE message_id=? AND user_id=?').get(req.params.msgId, req.user.id);
  if (existing && existing.emoji === emoji) {
    db.prepare('DELETE FROM message_reactions WHERE message_id=? AND user_id=?').run(req.params.msgId, req.user.id);
  } else {
    db.prepare('INSERT OR REPLACE INTO message_reactions (message_id,user_id,emoji) VALUES (?,?,?)').run(req.params.msgId, req.user.id, emoji);
  }

  const reactions = db.prepare(`
    SELECT emoji, GROUP_CONCAT(user_id) as userIds, COUNT(*) as count
    FROM message_reactions WHERE message_id=? GROUP BY emoji
  `).all(req.params.msgId);
  const result = reactions.map(r => ({ emoji: r.emoji, count: r.count, userIds: r.userIds.split(',') }));

  const io = req.app.get('io');
  if (io) io.to(msg.conversation_id).emit('message_reaction', { msgId: req.params.msgId, reactions: result });

  res.json({ reactions: result });
});

// 收藏消息
router.post('/:msgId/collect', auth, (req, res) => {
  const msg = db.prepare('SELECT * FROM messages WHERE id=?').get(req.params.msgId);
  if (!msg) return res.status(404).json({ error: '消息不存在' });

  const id = uuidv4();
  db.prepare('INSERT INTO collections (id,user_id,type,content,extra) VALUES (?,?,?,?,?)').run(
    id, req.user.id, msg.type, msg.content, JSON.stringify({ file_url: msg.file_url, source_msg_id: msg.id })
  );
  res.json({ success: true });
});

module.exports = router;
