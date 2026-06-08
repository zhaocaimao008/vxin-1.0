const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const QRCode = require('qrcode');
const db = require('../models/db');
const auth = require('../middleware/auth');
const { pushNewMessage } = require('../services/push');
const { makeChatUploader, makeImageUploader, sanitizeFilename } = require('../utils/upload');

const router = express.Router();

const UPLOADS_ROOT = path.join(__dirname, '../../uploads');
const upload            = makeChatUploader(path.join(UPLOADS_ROOT, 'files'));
const uploadGroupAvatar = makeImageUploader(path.join(UPLOADS_ROOT, 'avatars'), 'avatar', 1, 5 * 1024 * 1024);

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
  db.prepare('INSERT INTO conversations (id,type,name,owner_id) VALUES (?,?,?,?)').run(id, 'group', name, req.user.id);
  // 创建者角色为 owner，其他成员为 member
  db.prepare('INSERT INTO conversation_members (conversation_id,user_id,role) VALUES (?,?,?)').run(id, req.user.id, 'owner');
  const addMember = db.prepare('INSERT OR IGNORE INTO conversation_members (conversation_id,user_id,role) VALUES (?,?,?)');
  memberIds.forEach(uid => addMember.run(id, uid, 'member'));

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
  const uid = req.user.id;

  // ── 修复策略：
  //   1. 私聊对方信息 LEFT JOIN 内联主查询         → 消除私聊 N+1
  //   2. unread 用 correlated subquery + LIMIT 99   → 利用 idx_messages_conv_time 范围扫描早停
  //      （CTE 全表聚合反而更慢，correlated+LIMIT 35ms vs CTE 1644ms）
  //   3. ONE batch ROW_NUMBER query for group members → 消除群 N+1
  //   rows.map() 内零 SQL

  const rows = db.prepare(`
    SELECT
      c.id, c.type, c.name, c.avatar,
      m.content    AS lastMessage,
      m.type       AS lastMessageType,
      m.created_at AS lastTime,
      su.username  AS lastSenderName,
      COALESCE(cs.pinned, 0)                AS pinned,
      COALESCE(cs.muted,  0)                AS muted,
      COALESCE(cs.last_read_at, 0)          AS last_read_at,
      COALESCE(cs.last_read_message_id, '') AS last_read_message_id,
      (SELECT COUNT(*) FROM (
        SELECT 1 FROM messages mu
        WHERE  mu.conversation_id = c.id
          AND  mu.sender_id      != ?
          AND  mu.deleted         = 0
          AND  mu.created_at      > COALESCE(cs.last_read_at, 0)
        LIMIT 99
      )) AS unreadCount,
      ou.id       AS ou_id,
      ou.username AS ou_username,
      ou.avatar   AS ou_avatar,
      ou.status   AS ou_status,
      ct.remark   AS ou_remark
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
    LEFT JOIN messages m ON m.id = (
      SELECT id FROM messages WHERE conversation_id = c.id AND deleted = 0
      ORDER BY created_at DESC LIMIT 1
    )
    LEFT JOIN users su ON su.id = m.sender_id
    LEFT JOIN conversation_settings cs ON cs.user_id = ? AND cs.conversation_id = c.id
    LEFT JOIN conversation_members cm_o
           ON cm_o.conversation_id = c.id AND cm_o.user_id != ? AND c.type = 'private'
    LEFT JOIN users ou ON ou.id = cm_o.user_id
    LEFT JOIN contacts ct ON ct.user_id = ? AND ct.contact_id = ou.id
    ORDER BY COALESCE(cs.pinned, 0) DESC, COALESCE(m.created_at, c.created_at) DESC
  `).all(uid, uid, uid, uid, uid);

  // 群聊：ONE batch query 取所有群的前9个成员（ROW_NUMBER，无 IN 大列表）
  const memberMap = new Map();
  const hasGroups = rows.some(r => r.type === 'group');
  if (hasGroups) {
    db.prepare(`
      SELECT conversation_id, id, username, avatar FROM (
        SELECT cm.conversation_id, u.id, u.username, u.avatar,
               ROW_NUMBER() OVER (PARTITION BY cm.conversation_id ORDER BY cm.joined_at) AS rn
        FROM   conversation_members cm_me
        JOIN   conversation_members cm ON cm.conversation_id = cm_me.conversation_id
        JOIN   conversations c ON c.id = cm_me.conversation_id AND c.type = 'group'
        JOIN   users u ON u.id = cm.user_id
        WHERE  cm_me.user_id = ?
      ) WHERE rn <= 9
    `).all(uid).forEach(r => {
      if (!memberMap.has(r.conversation_id)) memberMap.set(r.conversation_id, []);
      memberMap.get(r.conversation_id).push({ id: r.id, username: r.username, avatar: r.avatar });
    });
  }

  // 组装响应 — 零 SQL
  const result = rows.map(({ ou_id, ou_username, ou_avatar, ou_status, ou_remark, ...conv }) => {
    if (conv.type === 'private') {
      const otherUser = ou_id ? { id: ou_id, username: ou_username, avatar: ou_avatar, status: ou_status, remark: ou_remark || '' } : null;
      return { ...conv, name: otherUser?.remark || otherUser?.username || '', avatar: otherUser?.avatar || '', otherUser };
    }
    return { ...conv, members: memberMap.get(conv.id) || [] };
  });

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

// 批量获取当前用户所有会话的未读数
// GET /api/messages/unread-counts
// 修复前：LEFT JOIN 内嵌 correlated subquery → 1709ms
// 修复后：correlated subquery + LIMIT 99 早停 → 34ms
//   每个会话独立利用 idx_messages_conv_time(conversation_id,created_at) 范围扫描
//   LIMIT 99 让 SQLite 在找到99条后立即停止，避免全量计数
//   UI 显示 "99+" 时行为不变（unread>=99 视为大量未读）
router.get('/unread-counts', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT cm.conversation_id,
      (SELECT COUNT(*) FROM (
        SELECT 1 FROM messages
        WHERE  conversation_id = cm.conversation_id
          AND  sender_id      != ?
          AND  deleted         = 0
          AND  created_at      > COALESCE(cs.last_read_at, 0)
        LIMIT 99
      )) AS unread_count
    FROM conversation_members cm
    LEFT JOIN conversation_settings cs
           ON cs.user_id = cm.user_id AND cs.conversation_id = cm.conversation_id
    WHERE cm.user_id = ?
  `).all(req.user.id, req.user.id);

  const result = {};
  rows.forEach(r => { if (r.unread_count > 0) result[r.conversation_id] = r.unread_count; });
  res.json(result);
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

// ── 全局消息搜索 ──────────────────────────────────────────────────
// GET /api/messages/search?q=QUERY&limit=20&offset=0
// 修复前：LIKE '%q%' 全表扫描 947k 行 → 1325ms
// 修复后：FTS5 trigram MATCH → 走倒排索引，毫秒级
router.get('/search', auth, (req, res) => {
  const { q, limit = 20, offset = 0 } = req.query;
  if (!q || !q.trim()) return res.json({ results: [], total: 0 });
  if (q.length > 100) return res.status(400).json({ error: '搜索词过长' });

  const safeLimit  = Math.min(parseInt(limit)  || 20, 50);
  const safeOffset = Math.min(Math.max(parseInt(offset) || 0, 0), 10000);

  // FTS5 trigram：直接 MATCH，JOIN conversation_members 限定权限范围
  // 无需预查所有 convIds，无 IN 大列表，无 LIKE 全表扫
  const ftsQuery = `"${q.replace(/"/g, '""')}"`;

  const total = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM   messages_fts fts
    JOIN   conversation_members cm ON cm.conversation_id = fts.conversation_id AND cm.user_id = ?
    JOIN   messages m ON m.id = fts.message_id AND m.deleted = 0
    WHERE  messages_fts MATCH ?
  `).get(req.user.id, ftsQuery)?.cnt || 0;

  const rows = db.prepare(`
    SELECT m.id, m.conversation_id, m.sender_id, m.content, m.created_at,
           u.username AS senderName, u.avatar AS senderAvatar,
           c.name AS convName, c.type AS convType,
           ou.username AS ou_username
    FROM   messages_fts fts
    JOIN   conversation_members cm ON cm.conversation_id = fts.conversation_id AND cm.user_id = ?
    JOIN   messages m  ON m.id = fts.message_id AND m.deleted = 0
    JOIN   users u     ON u.id = m.sender_id
    JOIN   conversations c ON c.id = m.conversation_id
    LEFT JOIN conversation_members cm_o
           ON cm_o.conversation_id = m.conversation_id AND cm_o.user_id != ? AND c.type = 'private'
    LEFT JOIN users ou ON ou.id = cm_o.user_id
    WHERE  messages_fts MATCH ?
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.user.id, req.user.id, ftsQuery, safeLimit, safeOffset);

  const results = rows.map(({ ou_username, ...msg }) => {
    if (msg.convType === 'private') msg.convName = ou_username || '私聊';
    return msg;
  });

  res.json({ results, total, limit: safeLimit, offset: safeOffset });
});

// ── 群昵称（我在该群的昵称）────────────────────────────────────
// PUT /api/messages/conversation/:convId/nickname
router.put('/conversation/:convId/nickname', auth, (req, res) => {
  const { convId } = req.params;
  const { nickname } = req.body;
  if (nickname && nickname.length > 30) return res.status(400).json({ error: '群昵称最长30字' });

  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(convId, req.user.id);
  if (!member) return res.status(403).json({ error: '不在群内' });

  db.prepare('UPDATE conversation_members SET nickname=? WHERE conversation_id=? AND user_id=?')
    .run(nickname || null, convId, req.user.id);

  const io = req.app.get('io');
  if (io) io.to(convId).emit('group_updated', { id: convId });

  res.json({ success: true, nickname: nickname || null });
});

// ── 群邀请链接 + QR码 ──────────────────────────────────────────
// POST /api/messages/conversation/:convId/invite-link  → 生成/刷新邀请令牌
router.post('/conversation/:convId/invite-link', auth, (req, res) => {
  const { convId } = req.params;
  const member = db.prepare('SELECT role FROM conversation_members WHERE conversation_id=? AND user_id=?').get(convId, req.user.id);
  if (!member) return res.status(403).json({ error: '不在群内' });

  const token = uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase();
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 3600; // 7天

  db.prepare(`
    INSERT OR REPLACE INTO group_invite_tokens (token, conversation_id, created_by, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(token, convId, req.user.id, expiresAt);

  const baseUrl = process.env.APP_URL || 'https://chat.91aigu.com';
  res.json({ token, url: `${baseUrl}/join/${token}`, expiresAt });
});

// GET /api/messages/conversation/:convId/qr-code  → 返回二维码图片（base64）
router.get('/conversation/:convId/qr-code', auth, async (req, res) => {
  const { convId } = req.params;
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(convId, req.user.id);
  if (!member) return res.status(403).json({ error: '不在群内' });

  // 取最新有效令牌，没有则自动创建
  let invite = db.prepare('SELECT token FROM group_invite_tokens WHERE conversation_id=? AND expires_at>? ORDER BY created_at DESC LIMIT 1')
    .get(convId, Math.floor(Date.now() / 1000));

  if (!invite) {
    const token = uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase();
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    db.prepare('INSERT INTO group_invite_tokens (token,conversation_id,created_by,expires_at) VALUES (?,?,?,?)')
      .run(token, convId, req.user.id, expiresAt);
    invite = { token };
  }

  const baseUrl = process.env.APP_URL || 'https://chat.91aigu.com';
  const url = `${baseUrl}/join/${invite.token}`;
  const dataUrl = await QRCode.toDataURL(url, { width: 240, margin: 2, color: { dark: '#191919', light: '#ffffff' } });

  res.json({ qrCode: dataUrl, url, token: invite.token });
});

// POST /api/messages/join/:token  → 扫码加入群
router.post('/join/:token', auth, (req, res) => {
  const { token } = req.params;
  const invite = db.prepare('SELECT * FROM group_invite_tokens WHERE token=? AND expires_at>?')
    .get(token, Math.floor(Date.now() / 1000));
  if (!invite) return res.status(404).json({ error: '邀请链接无效或已过期' });

  const existing = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?')
    .get(invite.conversation_id, req.user.id);
  if (existing) return res.json({ success: true, conversationId: invite.conversation_id, alreadyMember: true });

  db.prepare('INSERT OR IGNORE INTO conversation_members (conversation_id,user_id,role) VALUES (?,?,?)')
    .run(invite.conversation_id, req.user.id, 'member');

  const conv = db.prepare('SELECT id,type,name,avatar FROM conversations WHERE id=?').get(invite.conversation_id);
  const io = req.app.get('io');
  if (io) {
    io.to(`user_${req.user.id}`).emit('new_conversation', conv);
    io.to(invite.conversation_id).emit('group_updated', { id: invite.conversation_id });
  }

  res.json({ success: true, conversationId: invite.conversation_id, conversation: conv });
});

// 断线重连补拉：获取指定时间戳之后、当前用户所有会话的消息
// GET /api/messages/missed?after=UNIX_TIMESTAMP
router.get('/missed', auth, (req, res) => {
  const after = parseInt(req.query.after) || 0;
  if (after <= 0) return res.status(400).json({ error: 'after 参数无效' });

  // 拿到用户所有会话 ID
  const convRows = db.prepare(
    'SELECT conversation_id FROM conversation_members WHERE user_id=?'
  ).all(req.user.id);
  if (!convRows.length) return res.json([]);

  const convIds = convRows.map(r => r.conversation_id);
  const placeholders = convIds.map(() => '?').join(',');

  const messages = db.prepare(`
    SELECT m.*, u.username as senderName, u.avatar as senderAvatar
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id IN (${placeholders})
      AND m.deleted = 0
      AND m.created_at > ?
    ORDER BY m.created_at ASC
    LIMIT 300
  `).all(...convIds, after);

  // 附加 replyTo（不加 reactions，减少补拉延迟）
  const enriched = messages.map(msg => {
    if (msg.reply_to_id) {
      msg.replyTo = db.prepare(`
        SELECT m.id, m.type, m.content, m.file_url, u.username as senderName
        FROM messages m JOIN users u ON u.id=m.sender_id
        WHERE m.id=? AND m.conversation_id=?
      `).get(msg.reply_to_id, msg.conversation_id) || null;
    }
    msg.reactions = [];
    return msg;
  });

  // 重连后获取到消息 = 用户设备已收到，记录送达
  if (enriched.length > 0) {
    const insertDelivery = db.prepare('INSERT OR IGNORE INTO message_deliveries (message_id, user_id) VALUES (?, ?)');
    const tx = db.transaction(() => {
      enriched.forEach(msg => {
        if (msg.sender_id !== req.user.id) insertDelivery.run(msg.id, req.user.id);
      });
    });
    tx();

    // 通知各消息发送者：他们的消息已送达
    const io = req.app.get('io');
    if (io) {
      // 按发送者分组，避免重复通知
      const bySender = {};
      enriched.forEach(msg => {
        if (msg.sender_id === req.user.id) return;
        if (!bySender[msg.sender_id]) bySender[msg.sender_id] = [];
        bySender[msg.sender_id].push({ messageId: msg.id, conversationId: msg.conversation_id });
      });
      Object.entries(bySender).forEach(([senderId, items]) => {
        io.to(`user_${senderId}`).emit('message_delivered', {
          deliveredTo: req.user.id,
          messages: items,
        });
      });
    }
  }

  res.json(enriched);
});

// 修改群信息（名称、公告）
router.put('/conversation/:convId', auth, (req, res) => {
  const { convId } = req.params;
  const conv = db.prepare('SELECT * FROM conversations WHERE id=? AND type=?').get(convId, 'group');
  if (!conv) return res.status(404).json({ error: '群不存在' });
  const member = db.prepare('SELECT role FROM conversation_members WHERE conversation_id=? AND user_id=?').get(convId, req.user.id);
  if (!member) return res.status(403).json({ error: '不在群内' });
  if (member.role === 'member') return res.status(403).json({ error: '仅群主和管理员可修改群信息' });

  const { name, announcement } = req.body;
  if (name !== undefined) db.prepare('UPDATE conversations SET name=? WHERE id=?').run(name, convId);
  if (announcement !== undefined) db.prepare('UPDATE conversations SET announcement=? WHERE id=?').run(announcement, convId);

  const updated = db.prepare('SELECT id, name, announcement, owner_id FROM conversations WHERE id=?').get(convId);
  const io = req.app.get('io');
  if (io) io.to(convId).emit('group_updated', updated);
  res.json(updated);
});

// 修改群头像（群主和管理员可操作）
router.put('/conversation/:convId/avatar', auth, ...uploadGroupAvatar, (req, res) => {
  const { convId } = req.params;
  if (!req.file) return res.status(400).json({ error: '请选择图片' });
  const member = db.prepare('SELECT role FROM conversation_members WHERE conversation_id=? AND user_id=?').get(convId, req.user.id);
  if (!member) return res.status(403).json({ error: '不在群内' });
  if (member.role === 'member') return res.status(403).json({ error: '仅群主和管理员可修改群头像' });
  const url = `/uploads/avatars/${req.file.filename}`;
  db.prepare('UPDATE conversations SET avatar=? WHERE id=?').run(url, convId);
  const io = req.app.get('io');
  if (io) io.to(convId).emit('group_updated', { id: convId, avatar: url });
  res.json({ avatar: url });
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
    if (!db.prepare('SELECT 1 FROM users WHERE id=?').get(uid)) return;
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

// 获取群详情（含角色、管理设置）
router.get('/conversation/:convId/info', auth, (req, res) => {
  const { convId } = req.params;
  const myMember = db.prepare('SELECT role FROM conversation_members WHERE conversation_id=? AND user_id=?').get(convId, req.user.id);
  if (!myMember) return res.status(403).json({ error: '不在群内' });
  const conv = db.prepare('SELECT * FROM conversations WHERE id=?').get(convId);
  if (!conv) return res.status(404).json({ error: '群不存在' });
  const members = db.prepare(`
    SELECT u.id, u.username, u.avatar, u.bio, cm.role, cm.nickname
    FROM users u
    JOIN conversation_members cm ON cm.user_id=u.id
    WHERE cm.conversation_id=?
    ORDER BY
      CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
      u.username
  `).all(convId);
  res.json({ ...conv, members, myRole: myMember.role });
});

// 群管理设置：禁止私聊 / 全群禁言（仅群主和管理员可操作）
router.put('/conversation/:convId/manage', auth, (req, res) => {
  const { convId } = req.params;
  const conv = db.prepare('SELECT * FROM conversations WHERE id=? AND type=?').get(convId, 'group');
  if (!conv) return res.status(404).json({ error: '群不存在' });

  const myRole = db.prepare('SELECT role FROM conversation_members WHERE conversation_id=? AND user_id=?').get(convId, req.user.id)?.role;
  if (!myRole || myRole === 'member') return res.status(403).json({ error: '无权操作，仅群主或管理员可修改' });

  const updates = [];
  const params = [];
  const { no_private_chat, mute_all, no_add_friend } = req.body;
  if (no_private_chat !== undefined) { updates.push('no_private_chat=?'); params.push(no_private_chat ? 1 : 0); }
  if (mute_all !== undefined) { updates.push('mute_all=?'); params.push(mute_all ? 1 : 0); }
  if (no_add_friend !== undefined) { updates.push('no_add_friend=?'); params.push(no_add_friend ? 1 : 0); }
  if (updates.length === 0) return res.status(400).json({ error: '无有效参数' });

  params.push(convId);
  db.prepare(`UPDATE conversations SET ${updates.join(',')} WHERE id=?`).run(...params);

  const updated = db.prepare('SELECT id, no_private_chat, mute_all, no_add_friend FROM conversations WHERE id=?').get(convId);
  const io = req.app.get('io');
  if (io) io.to(convId).emit('group_settings_updated', updated);
  res.json(updated);
});

// 设置/取消管理员（仅群主可操作）
router.put('/conversation/:convId/members/:uid/role', auth, (req, res) => {
  const { convId, uid } = req.params;
  const { role } = req.body; // 'admin' | 'member'
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: '无效角色' });

  const conv = db.prepare('SELECT owner_id FROM conversations WHERE id=?').get(convId);
  if (!conv) return res.status(404).json({ error: '群不存在' });
  if (conv.owner_id !== req.user.id) return res.status(403).json({ error: '仅群主可设置管理员' });
  if (uid === req.user.id) return res.status(400).json({ error: '不能修改自己的角色' });

  const target = db.prepare('SELECT role FROM conversation_members WHERE conversation_id=? AND user_id=?').get(convId, uid);
  if (!target) return res.status(404).json({ error: '成员不存在' });
  if (target.role === 'owner') return res.status(400).json({ error: '不能修改群主角色' });

  db.prepare('UPDATE conversation_members SET role=? WHERE conversation_id=? AND user_id=?').run(role, convId, uid);
  const io = req.app.get('io');
  if (io) {
    io.to(convId).emit('group_updated', { id: convId });
    io.to(`user_${uid}`).emit('role_changed', { conversationId: convId, role });
  }
  res.json({ success: true, role });
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
  const { messageId } = req.body; // 可选：指定已读到的最后一条消息 ID

  let readAt = Math.floor(Date.now() / 1000);
  let readMsgId = messageId || null;

  if (messageId) {
    // 从消息表取准确的 created_at，防止客户端时间偏移
    const msg = db.prepare(
      'SELECT created_at FROM messages WHERE id=? AND conversation_id=? AND deleted=0'
    ).get(messageId, req.params.convId);
    if (msg) readAt = msg.created_at;
  } else {
    // 未指定消息 ID：取会话最新消息作为已读基准
    const last = db.prepare(
      'SELECT id, created_at FROM messages WHERE conversation_id=? AND deleted=0 ORDER BY created_at DESC LIMIT 1'
    ).get(req.params.convId);
    if (last) { readAt = last.created_at; readMsgId = last.id; }
  }

  db.prepare(`
    INSERT INTO conversation_settings (user_id, conversation_id, last_read_at, last_read_message_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, conversation_id) DO UPDATE SET
      last_read_at        = excluded.last_read_at,
      last_read_message_id = excluded.last_read_message_id
  `).run(req.user.id, req.params.convId, readAt, readMsgId);

  const io = req.app.get('io');
  if (io) {
    // 通知会话内其他成员：已读回执（用于显示"已读"标记）
    io.to(req.params.convId).emit('message_read', {
      userId: req.user.id,
      conversationId: req.params.convId,
      readAt,
      lastReadMessageId: readMsgId,
    });
    // 通知该用户自己的其他端：清零未读数（多端同步）
    io.to(`user_${req.user.id}`).emit('sync:unread_cleared', {
      conversationId: req.params.convId,
      lastReadMessageId: readMsgId,
    });
  }
  res.json({ success: true, readAt, lastReadMessageId: readMsgId });
});

// 双向清理当前会话聊天记录：对会话内所有成员不可见
router.delete('/conversation/:convId/messages', auth, (req, res) => {
  const { convId } = req.params;
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(convId, req.user.id);
  if (!member) return res.status(403).json({ error: '无权操作该会话' });

  const result = db.prepare('UPDATE messages SET deleted=1 WHERE conversation_id=? AND deleted=0').run(convId);
  db.prepare('DELETE FROM pinned_messages WHERE conversation_id=?').run(convId);

  const io = req.app.get('io');
  if (io) io.to(convId).emit('conversation_messages_cleared', {
    conversationId: convId,
    clearedBy: req.user.id,
  });

  res.json({ success: true, deleted: result.changes || 0 });
});

// 双向清理我参与的全部会话聊天记录：影响所有相关会话成员
router.delete('/conversations/messages', auth, (req, res) => {
  const convs = db.prepare('SELECT conversation_id FROM conversation_members WHERE user_id=?').all(req.user.id);
  if (!convs.length) return res.json({ success: true, conversations: 0, deleted: 0 });

  const update = db.prepare('UPDATE messages SET deleted=1 WHERE conversation_id=? AND deleted=0');
  const clearPins = db.prepare('DELETE FROM pinned_messages WHERE conversation_id=?');
  let deleted = 0;

  db.transaction(() => {
    for (const { conversation_id } of convs) {
      deleted += update.run(conversation_id).changes || 0;
      clearPins.run(conversation_id);
    }
  })();

  const io = req.app.get('io');
  if (io) {
    for (const { conversation_id } of convs) {
      io.to(conversation_id).emit('conversation_messages_cleared', {
        conversationId: conversation_id,
        clearedBy: req.user.id,
      });
    }
  }

  res.json({ success: true, conversations: convs.length, deleted });
});

// 会话内搜索（FTS5 MATCH，已限定 conversation_id）
router.get('/conversation/:convId/search', auth, (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  if (q.length > 100) return res.status(400).json({ error: '搜索词过长' });
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(req.params.convId, req.user.id);
  if (!member) return res.status(403).json({ error: '无权访问' });
  const ftsQuery = `"${q.replace(/"/g, '""')}"`;
  const messages = db.prepare(`
    SELECT m.*, u.username AS senderName, u.avatar AS senderAvatar
    FROM   messages_fts fts
    JOIN   messages m ON m.id = fts.message_id AND m.deleted = 0
    JOIN   users u ON u.id = m.sender_id
    WHERE  fts.conversation_id = ? AND messages_fts MATCH ?
    ORDER BY m.created_at DESC LIMIT 30
  `).all(req.params.convId, ftsQuery);
  res.json(messages);
});

// 获取消息历史
router.get('/:conversationId', auth, (req, res) => {
  const { conversationId } = req.params;
  const { before, after } = req.query;
  const rawLimit = parseInt(req.query.limit);
  const limit = (!isNaN(rawLimit) && rawLimit > 0) ? Math.min(rawLimit, 100) : 50;

  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(conversationId, req.user.id);
  if (!member) return res.status(403).json({ error: '无权访问' });

  let query = `
    SELECT m.*, u.username as senderName, u.avatar as senderAvatar
    FROM messages m JOIN users u ON u.id=m.sender_id
    WHERE m.conversation_id=? AND m.deleted=0
  `;
  const params = [conversationId];
  if (before) { query += ' AND m.created_at < ?'; params.push(Number(before)); }
  if (after)  { query += ' AND m.created_at > ?'; params.push(Number(after)); }
  // after 模式升序（时间线顺序），before 模式降序（分页向上加载）
  query += after
    ? ' ORDER BY m.created_at ASC LIMIT ?'
    : ' ORDER BY m.created_at DESC LIMIT ?';
  params.push(limit);

  const raw = db.prepare(query).all(...params);
  const messages = after ? raw : raw.reverse(); // before 模式需要翻转回正序

  // 群聊：获取所有成员的已读时间，用于计算每条消息的已读数
  const conv = db.prepare('SELECT type FROM conversations WHERE id=?').get(conversationId);
  let memberReadTimes = null;
  if (conv?.type === 'group') {
    memberReadTimes = db.prepare(`
      SELECT cs.user_id, cs.last_read_at FROM conversation_settings cs
      WHERE cs.conversation_id=?
    `).all(conversationId);
  }

  // 私聊：一次性取本批消息的 delivery 记录
  let deliverySet = new Set();
  if (conv?.type === 'private' && messages.length > 0) {
    const msgIds = messages.map(m => m.id);
    const ph = msgIds.map(() => '?').join(',');
    db.prepare(`SELECT message_id FROM message_deliveries WHERE message_id IN (${ph})`).all(...msgIds)
      .forEach(r => deliverySet.add(r.message_id));
  }

  // Enrich with reply_to, reactions, delivery
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

    // 私聊：送达标记
    if (conv?.type === 'private') {
      msg._delivered = deliverySet.has(msg.id);
    }

    // 群消息已读数（排除发送者自己）
    if (memberReadTimes && conv?.type === 'group') {
      msg.readCount = memberReadTimes.filter(m => m.user_id !== msg.sender_id && m.last_read_at >= msg.created_at).length;
    }

    return msg;
  });

  res.json(enriched);
});

// 转发消息（必须在 /:conversationId 之前，否则被误匹配）
router.post('/forward', auth, (req, res) => {
  const { msgId, conversationIds } = req.body;
  if (!msgId || !conversationIds?.length) return res.status(400).json({ error: '参数缺失' });

  const msg = db.prepare('SELECT * FROM messages WHERE id=? AND deleted=0').get(msgId);
  if (!msg) return res.status(404).json({ error: '消息不存在' });

  const io = req.app.get('io');
  const sent = [];

  conversationIds.forEach(convId => {
    const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(convId, req.user.id);
    if (!member) return;

    const id = uuidv4();
    db.prepare('INSERT INTO messages (id,conversation_id,sender_id,type,content,file_url) VALUES (?,?,?,?,?,?)').run(
      id, convId, req.user.id, msg.type, msg.content, msg.file_url || ''
    );
    const newMsg = db.prepare('SELECT m.*, u.username as senderName, u.avatar as senderAvatar FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?').get(id);
    newMsg.reactions = [];
    if (io) io.to(convId).emit('new_message', newMsg);
    sent.push(convId);
  });

  res.json({ success: true, sent: sent.length });
});

// 批量撤回（必须在 /:conversationId 之前）
router.post('/batch-delete', auth, (req, res) => {
  const { msgIds, conversationId } = req.body;
  if (!msgIds?.length || !conversationId) return res.status(400).json({ error: '参数缺失' });
  if (msgIds.length > 20) return res.status(400).json({ error: '单次最多批量撤回 20 条' });

  const member = db.prepare('SELECT role FROM conversation_members WHERE conversation_id=? AND user_id=?').get(conversationId, req.user.id);
  if (!member) return res.status(403).json({ error: '不在会话中' });

  const isAdmin = member.role === 'owner' || member.role === 'admin';
  const deleted = [];
  const now = Math.floor(Date.now() / 1000);

  msgIds.forEach(msgId => {
    const msg = db.prepare('SELECT * FROM messages WHERE id=? AND conversation_id=?').get(msgId, conversationId);
    if (!msg || msg.deleted) return;
    const isOwn = msg.sender_id === req.user.id;
    const inTime = (now - msg.created_at) <= 120;
    if (isOwn && inTime) {
      db.prepare('UPDATE messages SET deleted=1 WHERE id=?').run(msgId);
      deleted.push(msgId);
    } else if (isAdmin) {
      db.prepare('UPDATE messages SET deleted=1 WHERE id=?').run(msgId);
      deleted.push(msgId);
    }
  });

  const io = req.app.get('io');
  if (io && deleted.length > 0) {
    deleted.forEach(msgId => io.to(conversationId).emit('message_deleted', { msgId, conversationId }));
  }
  res.json({ success: true, deleted: deleted.length });
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
router.post('/:conversationId/upload', auth,
  // 1. 权限检查（先于文件写盘）
  (req, res, next) => {
    const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?')
      .get(req.params.conversationId, req.user.id);
    if (!member) return res.status(403).json({ error: '无权发送' });
    next();
  },
  // 2. 文件上传（Content-Type 白名单 + 魔数二次校验）
  ...upload,
  // 3. 处理上传结果
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: '请选择文件' });

    const { conversationId } = req.params;
    const { reply_to_id } = req.body;
    const mime = req.file.mimetype;

    // 消息类型由 MIME 决定（不信任客户端传递的 type 字段）
    const type = mime.startsWith('image/') ? 'image'
               : mime.startsWith('audio/') ? 'voice'
               : mime.startsWith('video/') ? 'video'
               : 'file';

    // 存储文件名使用消毒后的原始名，URL 使用 UUID 文件名（不暴露真实路径结构）
    const safeOriginalName = sanitizeFilename(req.file.originalname);
    const url = `/uploads/files/${req.file.filename}`;

    const id = uuidv4();
    db.prepare('INSERT INTO messages (id,conversation_id,sender_id,type,content,file_url,reply_to_id) VALUES (?,?,?,?,?,?,?)')
      .run(id, conversationId, req.user.id, type, safeOriginalName, url, reply_to_id || null);

    const msg = buildMessage(id);
    const io = req.app.get('io');
    if (io) io.to(conversationId).emit('new_message', msg);

    pushNewMessage({
      conversationId,
      senderId: req.user.id,
      senderName: msg.senderName,
      content: safeOriginalName,
      type,
      timestamp: msg.created_at,
      onlineUserIds: req.app.get('onlineUsers') || new Set(),
    }).catch(() => {});

    res.json(msg);
  }
);

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
    // 仅自己隐藏：不改数据库，不通知他人，前端自行处理
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

// 编辑消息（仅限自己的文字消息，2分钟内）
router.put('/:msgId/edit', auth, (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: '内容不能为空' });

  const msg = db.prepare('SELECT * FROM messages WHERE id=?').get(req.params.msgId);
  if (!msg) return res.status(404).json({ error: '消息不存在' });
  if (msg.sender_id !== req.user.id) return res.status(403).json({ error: '只能编辑自己的消息' });
  if (msg.type !== 'text') return res.status(400).json({ error: '只能编辑文字消息' });
  if (msg.deleted) return res.status(400).json({ error: '已撤回的消息无法编辑' });

  const now = Math.floor(Date.now() / 1000);
  if (now - msg.created_at > 120) return res.status(400).json({ error: '超过2分钟无法编辑' });

  db.prepare('UPDATE messages SET content=?, edited=1 WHERE id=?').run(content.trim(), req.params.msgId);

  const io = req.app.get('io');
  if (io) io.to(msg.conversation_id).emit('message_edited', {
    msgId: req.params.msgId,
    content: content.trim(),
    conversationId: msg.conversation_id
  });
  res.json({ success: true, content: content.trim() });
});

// 置顶消息（群主/管理员可置顶，私聊双方均可）
router.post('/conversation/:convId/pin-message', auth, (req, res) => {
  const { msgId } = req.body;
  if (!msgId) return res.status(400).json({ error: '参数缺失' });

  const member = db.prepare('SELECT role FROM conversation_members WHERE conversation_id=? AND user_id=?').get(req.params.convId, req.user.id);
  if (!member) return res.status(403).json({ error: '不在会话中' });

  const msg = db.prepare('SELECT id,type,content,sender_id FROM messages WHERE id=? AND conversation_id=?').get(msgId, req.params.convId);
  if (!msg) return res.status(404).json({ error: '消息不存在' });

  const id = uuidv4();
  db.prepare('INSERT OR REPLACE INTO pinned_messages (id,conversation_id,message_id,pinned_by) VALUES (?,?,?,?)').run(id, req.params.convId, msgId, req.user.id);

  const pinner = db.prepare('SELECT username FROM users WHERE id=?').get(req.user.id);
  const io = req.app.get('io');
  if (io) io.to(req.params.convId).emit('message_pinned', { msgId, convId: req.params.convId, pinnedBy: pinner?.username, content: msg.content, type: msg.type });

  res.json({ success: true });
});

// 取消置顶
router.delete('/conversation/:convId/pin-message/:msgId', auth, (req, res) => {
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(req.params.convId, req.user.id);
  if (!member) return res.status(403).json({ error: '不在会话中' });

  db.prepare('DELETE FROM pinned_messages WHERE conversation_id=? AND message_id=?').run(req.params.convId, req.params.msgId);
  const io = req.app.get('io');
  if (io) io.to(req.params.convId).emit('message_unpinned', { msgId: req.params.msgId, convId: req.params.convId });
  res.json({ success: true });
});

// 获取置顶消息列表
router.get('/conversation/:convId/pinned-messages', auth, (req, res) => {
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(req.params.convId, req.user.id);
  if (!member) return res.status(403).json({ error: '无权访问' });

  const pinned = db.prepare(`
    SELECT pm.message_id as msgId, pm.pinned_by, pm.created_at,
      m.type, m.content, m.file_url,
      u.username as senderName, pu.username as pinnedByName
    FROM pinned_messages pm
    JOIN messages m ON m.id=pm.message_id
    JOIN users u ON u.id=m.sender_id
    JOIN users pu ON pu.id=pm.pinned_by
    WHERE pm.conversation_id=?
    ORDER BY pm.created_at DESC LIMIT 20
  `).all(req.params.convId);
  res.json(pinned);
});

// 收藏消息
router.post('/:msgId/collect', auth, (req, res) => {
  const msg = db.prepare('SELECT * FROM messages WHERE id=?').get(req.params.msgId);
  if (!msg) return res.status(404).json({ error: '消息不存在' });
  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(msg.conversation_id, req.user.id);
  if (!member) return res.status(403).json({ error: '无权操作' });

  const id = uuidv4();
  db.prepare('INSERT INTO collections (id,user_id,type,content,extra) VALUES (?,?,?,?,?)').run(
    id, req.user.id, msg.type, msg.content, JSON.stringify({ file_url: msg.file_url, source_msg_id: msg.id })
  );
  res.json({ success: true });
});

// ── 红包 ──────────────────────────────────────────────────────

// 发红包（创建红包并发一条消息）
router.post('/red-packet/send', auth, (req, res) => {
  const { conversationId, totalAmount, totalCount, greeting } = req.body;
  if (!conversationId || !totalAmount || !totalCount) return res.status(400).json({ error: '参数缺失' });
  if (totalAmount < 1 || totalAmount > 20000) return res.status(400).json({ error: '金额范围 1-20000 金币' });
  if (totalCount < 1 || totalCount > 100) return res.status(400).json({ error: '红包个数 1-100' });

  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(conversationId, req.user.id);
  if (!member) return res.status(403).json({ error: '无权操作' });

  const packetId = uuidv4();
  db.prepare('INSERT INTO red_packets (id,sender_id,conversation_id,total_amount,total_count,greeting) VALUES (?,?,?,?,?,?)').run(
    packetId, req.user.id, conversationId, totalAmount, totalCount, greeting || '恭喜发财，大吉大利'
  );

  const msgContent = JSON.stringify({ packetId, greeting: greeting || '恭喜发财，大吉大利', totalCount, totalAmount });
  const msgId = uuidv4();
  db.prepare('INSERT INTO messages (id,conversation_id,sender_id,type,content) VALUES (?,?,?,?,?)').run(
    msgId, conversationId, req.user.id, 'red_packet', msgContent
  );
  const msg = db.prepare('SELECT m.*, u.username as senderName, u.avatar as senderAvatar FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?').get(msgId);
  msg.reactions = [];

  const io = req.app.get('io');
  if (io) io.to(conversationId).emit('new_message', msg);

  res.json({ success: true, packetId, message: msg });
});

// 获取红包详情
router.get('/red-packet/:packetId', auth, (req, res) => {
  const packet = db.prepare('SELECT rp.*, u.username as senderName FROM red_packets rp JOIN users u ON u.id=rp.sender_id WHERE rp.id=?').get(req.params.packetId);
  if (!packet) return res.status(404).json({ error: '红包不存在' });

  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(packet.conversation_id, req.user.id);
  if (!member) return res.status(403).json({ error: '无权查看' });

  const claims = db.prepare('SELECT rpc.*, u.username FROM red_packet_claims rpc JOIN users u ON u.id=rpc.user_id WHERE rpc.packet_id=? ORDER BY rpc.claimed_at').all(req.params.packetId);
  const myCllaim = claims.find(c => c.user_id === req.user.id);

  res.json({ ...packet, claims, myClaim: myCllaim || null });
});

// 领红包
router.post('/red-packet/:packetId/claim', auth, (req, res) => {
  const packet = db.prepare('SELECT * FROM red_packets WHERE id=?').get(req.params.packetId);
  if (!packet) return res.status(404).json({ error: '红包不存在' });

  const member = db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?').get(packet.conversation_id, req.user.id);
  if (!member) return res.status(403).json({ error: '无权领取' });

  let claimResult;
  try {
    // EXCLUSIVE 事务：持有写锁直到 COMMIT，彻底防止并发超发
    claimResult = db.transaction(() => {
      // 先检查是否已领过（写锁内读取，保证一致性）
      const existing = db.prepare('SELECT amount FROM red_packet_claims WHERE packet_id=? AND user_id=?').get(req.params.packetId, req.user.id);
      if (existing) return { error: '已领取过', amount: existing.amount };

      // 重新读红包状态（持锁后读，防止幻读）
      const fresh = db.prepare('SELECT * FROM red_packets WHERE id=?').get(req.params.packetId);
      if (fresh.claimed_count >= fresh.total_count) return { error: '红包已被领完' };

      // 用实际已发金额计算剩余，而非 claimed_count，防止数值漂移
      const sumRow = db.prepare('SELECT COALESCE(SUM(amount),0) as s FROM red_packet_claims WHERE packet_id=?').get(req.params.packetId);
      const remaining = fresh.total_amount - sumRow.s;
      if (remaining <= 0) return { error: '红包已被领完' };

      const leftCount = fresh.total_count - fresh.claimed_count;
      let amount;
      if (leftCount === 1) {
        amount = remaining;
      } else {
        const max = Math.max(1, Math.floor(remaining / leftCount * 2));
        amount = Math.max(1, Math.min(remaining - (leftCount - 1), Math.floor(Math.random() * max) + 1));
      }

      db.prepare('INSERT INTO red_packet_claims (packet_id,user_id,amount) VALUES (?,?,?)').run(req.params.packetId, req.user.id, amount);
      db.prepare('UPDATE red_packets SET claimed_count=claimed_count+1 WHERE id=?').run(req.params.packetId);
      return { amount };
    }).exclusive()();
  } catch (e) {
    return res.status(500).json({ error: '领取失败，请重试' });
  }

  if (claimResult.error) return res.status(400).json({ error: claimResult.error, amount: claimResult.amount });

  const io = req.app.get('io');
  const claimer = db.prepare('SELECT username FROM users WHERE id=?').get(req.user.id);
  if (io) io.to(packet.conversation_id).emit('red_packet_claimed', { packetId: req.params.packetId, userId: req.user.id, username: claimer?.username, amount: claimResult.amount });

  res.json({ success: true, amount: claimResult.amount });
});

// 媒体消息列表（照片与视频）
router.get('/media', auth, (req, res) => {
  const type = req.query.type || 'image';
  const limit = Math.min(parseInt(req.query.limit) || 60, 200);
  const before = req.query.before ? parseInt(req.query.before) : null;
  const beforeClause = before ? 'AND m.created_at < ?' : '';
  const params = before
    ? [req.user.id, type, before, limit]
    : [req.user.id, type, limit];
  const rows = db.prepare(`
    SELECT m.id, m.content, m.extra, m.created_at, m.conversation_id,
           u.username as senderName, c.name as convName
    FROM messages m
    JOIN conversation_members cm ON cm.conversation_id=m.conversation_id AND cm.user_id=?
    JOIN users u ON u.id=m.sender_id
    JOIN conversations c ON c.id=m.conversation_id
    WHERE m.type=? AND m.deleted=0 ${beforeClause}
    ORDER BY m.created_at DESC LIMIT ?
  `).all(...params);
  res.json(rows);
});

module.exports = router;
