'use strict';
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db               = require('../models/db');
const { readDb }       = require('../models/db');
const { write, writeAsync } = require('../utils/dbWriter');
const { pushNewMessage } = require('../services/push');
const { getPublicBase }  = require('../utils/cloudStorage');

const onlineUsers  = new Map();
const userProfiles = new Map();

function addSocket(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
}
function removeSocket(userId, socketId) {
  const s = onlineUsers.get(userId);
  if (!s) return true;
  s.delete(socketId);
  if (s.size === 0) { onlineUsers.delete(userId); return true; }
  return false;
}
function isOnline(uid)     { return (onlineUsers.get(uid)?.size || 0) > 0; }
function onlineUserIdSet() { return new Set(onlineUsers.keys()); }

function recordDeliveries(messageId, userIds) {
  const sql = 'INSERT OR IGNORE INTO message_deliveries (message_id, user_id) VALUES (?,?)';
  for (const uid of userIds) write(sql, [messageId, uid]);
}

module.exports = (io, app) => {
  io.use((socket, next) => {
    let token = socket.handshake.auth.token;
    if (!token) {
      const cookieHeader = socket.handshake.headers.cookie || '';
      const match = cookieHeader.match(/vxin_token=([^;]+)/);
      token = match ? decodeURIComponent(match[1]) : null;
    }
    if (!token) return next(new Error('未授权'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Token无效'));
    }
  });

  io.on('connection', (socket) => {
    const userId        = socket.user.id;
    const isFirstDevice = !isOnline(userId);

    addSocket(userId, socket.id);
    if (app) app.set('onlineUsers', onlineUserIdSet());

    // 立即加入 user 房间，会话房间延迟到下一 tick
    socket.join(`user_${userId}`);
    setImmediate(() => {
      const convIds = readDb
        .prepare('SELECT conversation_id FROM conversation_members WHERE user_id=?')
        .all(userId).map(c => c.conversation_id);
      if (convIds.length) socket.join(convIds);
    });

    // 用户资料缓存（send_message 免 SELECT）
    if (!userProfiles.has(userId)) {
      const p = readDb.prepare('SELECT username, avatar FROM users WHERE id=?').get(userId);
      if (p) userProfiles.set(userId, { username: p.username, avatar: p.avatar || '' });
    }

    if (isFirstDevice) {
      db.prepare('UPDATE users SET status=? WHERE id=?').run('online', userId);
      const contacts = readDb.prepare('SELECT contact_id FROM contacts WHERE user_id=?').all(userId);
      if (contacts.length) {
        io.to(contacts.map(c => `user_${c.contact_id}`)).emit('user_online', { userId });
      }
    } else {
      socket.to(`user_${userId}`).emit('sync:device_connected', { socketId: socket.id });
    }

    // ── 发消息（async：reply_to 需等 worker flush） ───────────────
    socket.on('send_message', async (data, ack) => {
      const { conversationId, content, reply_to_id } = data;
      const ALLOWED = ['text'];
      const type    = ALLOWED.includes(data.type) ? data.type : 'text';

      if (!conversationId || !content) return;
      if (typeof content === 'string' && content.length > 10000) {
        if (ack) ack({ success: false, error: '消息内容过长' });
        return;
      }

      const member = readDb
        .prepare('SELECT role FROM conversation_members WHERE conversation_id=? AND user_id=?')
        .get(conversationId, userId);
      if (!member) { if (ack) ack({ success: false, error: '非群成员' }); return; }

      const conv = readDb.prepare('SELECT mute_all FROM conversations WHERE id=?').get(conversationId);
      if (conv?.mute_all && member.role === 'member') {
        if (ack) ack({ success: false, error: '全员禁言中，您没有发言权限' });
        return;
      }

      const id         = uuidv4();
      const created_at = Math.floor(Date.now() / 1000);
      const profile    = userProfiles.get(userId) || {};

      const msg = {
        id,
        conversation_id: conversationId,
        sender_id:       userId,
        type,
        content,
        file_url:        '',
        reply_to_id:     reply_to_id || null,
        deleted:         0,
        edited:          0,
        created_at,
        senderName:      profile.username || '',
        senderAvatar:    profile.avatar   || '',
        reactions:       [],
        replyTo:         null,
      };

      // Worker 写入
      // fire-and-forget（无 reply）：ACK 立即返回，吞吐量最高
      // writeAsync（有 reply）：等 worker commit 后再 ACK
      //   确保后续 replyTo 查询可见该消息（消除竞态）
      if (reply_to_id) {
        await writeAsync(
          'INSERT INTO messages (id,conversation_id,sender_id,type,content,reply_to_id,created_at) VALUES (?,?,?,?,?,?,?)',
          [id, conversationId, userId, type, content, reply_to_id, created_at]
        );
        msg.replyTo = readDb.prepare(`
          SELECT m.id, m.type, m.content, m.file_url, u.username AS senderName
          FROM   messages m JOIN users u ON u.id = m.sender_id
          WHERE  m.id = ? AND m.conversation_id = ?
        `).get(reply_to_id, conversationId) || null;
      } else {
        write(
          'INSERT INTO messages (id,conversation_id,sender_id,type,content,reply_to_id,created_at) VALUES (?,?,?,?,?,?,?)',
          [id, conversationId, userId, type, content, null, created_at]
        );
      }

      // socket.to 排除发送者本人，避免 ack + broadcast 双写
      socket.to(conversationId).emit('new_message', msg);
      if (ack) ack({ success: true, message: msg });

      // ── @mention 检测 ──
      if (type === 'text' && typeof content === 'string') {
        const mentionRe = /@([^\s,，。！？]+)/g;
        let match;
        const mentioned = [];
        while ((match = mentionRe.exec(content)) !== null) {
          mentioned.push(match[1]);
        }
        if (mentioned.length > 0) {
          const uniqueNames = [...new Set(mentioned)];
          const members = readDb
            .prepare('SELECT user_id FROM conversation_members WHERE conversation_id=?')
            .all(conversationId);
          const memberIds = members.map(m => m.user_id);
          const matchedUsers = readDb
            .prepare(`SELECT id, username FROM users WHERE username IN (${uniqueNames.map(() => '?').join(',')}) AND id IN (${memberIds.map(() => '?').join(',')})`)
            .all(...uniqueNames, ...memberIds);
          const convName = readDb.prepare('SELECT name FROM conversations WHERE id=?').get(conversationId);
          const groupName = convName?.name || '群聊';
          const preview = content.length > 50 ? content.slice(0, 50) + '…' : content;
          const senderProfile = userProfiles.get(userId) || {};
          for (const u of matchedUsers) {
            if (u.id !== userId) {
              io.to(`user_${u.id}`).emit('@mention', {
                fromUserId:      userId,
                fromUserName:    senderProfile.username || '',
                groupName,
                messagePreview:  preview,
                conversationId,
              });
            }
          }
        }
      }

      // 送达记录 + push：推到下一 tick
      setImmediate(() => {
        const members = readDb
          .prepare('SELECT user_id FROM conversation_members WHERE conversation_id=?')
          .all(conversationId);
        const onlineRecipients = members.map(m => m.user_id).filter(uid => uid !== userId && isOnline(uid));

        if (onlineRecipients.length > 0) {
          recordDeliveries(id, onlineRecipients);
          io.to(`user_${userId}`).emit('message_delivered', {
            messageId:      id,
            conversationId,
            deliveredCount: onlineRecipients.length,
          });
        }

        pushNewMessage({
          conversationId,
          senderId:     userId,
          senderName:   msg.senderName,
          content,
          type,
          timestamp:    created_at,
          onlineUserIds: onlineUserIdSet(),
          members,
        }).catch(() => {});
      });
    });

    // ── 文件/图片/语音/视频消息（客户端已直传云存储，仅转发 URL）────
    socket.on('send_file_message', async (data, ack) => {
      const { conversationId, type, file_url, content, reply_to_id } = data;
      const ALLOWED_TYPES = new Set(['image', 'voice', 'video', 'file']);

      if (!conversationId || !file_url || !ALLOWED_TYPES.has(type)) {
        if (ack) ack({ success: false, error: '参数无效' });
        return;
      }

      // 校验 URL 必须来自本服务配置的云存储域名，防止注入任意链接
      const publicBase = getPublicBase();
      if (!publicBase || !file_url.startsWith(publicBase + '/')) {
        if (ack) ack({ success: false, error: '文件 URL 非法：不属于已配置的云存储域名' });
        return;
      }

      const member = readDb
        .prepare('SELECT role FROM conversation_members WHERE conversation_id=? AND user_id=?')
        .get(conversationId, userId);
      if (!member) { if (ack) ack({ success: false, error: '非群成员' }); return; }

      const conv = readDb.prepare('SELECT mute_all FROM conversations WHERE id=?').get(conversationId);
      if (conv?.mute_all && member.role === 'member') {
        if (ack) ack({ success: false, error: '全员禁言中，您没有发言权限' });
        return;
      }

      const id         = uuidv4();
      const created_at = Math.floor(Date.now() / 1000);
      const profile    = userProfiles.get(userId) || {};
      const safeContent = typeof content === 'string' ? content.slice(0, 200) : '';

      const msg = {
        id,
        conversation_id: conversationId,
        sender_id:       userId,
        type,
        content:         safeContent,
        file_url,
        reply_to_id:     reply_to_id || null,
        deleted:         0,
        edited:          0,
        created_at,
        senderName:      profile.username || '',
        senderAvatar:    profile.avatar   || '',
        reactions:       [],
        replyTo:         null,
      };

      if (reply_to_id) {
        await writeAsync(
          'INSERT INTO messages (id,conversation_id,sender_id,type,content,file_url,reply_to_id,created_at) VALUES (?,?,?,?,?,?,?,?)',
          [id, conversationId, userId, type, safeContent, file_url, reply_to_id, created_at]
        );
        msg.replyTo = readDb.prepare(`
          SELECT m.id, m.type, m.content, m.file_url, u.username AS senderName
          FROM   messages m JOIN users u ON u.id = m.sender_id
          WHERE  m.id = ? AND m.conversation_id = ?
        `).get(reply_to_id, conversationId) || null;
      } else {
        write(
          'INSERT INTO messages (id,conversation_id,sender_id,type,content,file_url,reply_to_id,created_at) VALUES (?,?,?,?,?,?,?,?)',
          [id, conversationId, userId, type, safeContent, file_url, null, created_at]
        );
      }

      // socket.to 排除发送者本人，避免 ack + broadcast 双写
      socket.to(conversationId).emit('new_message', msg);
      if (ack) ack({ success: true, message: msg });

      setImmediate(() => {
        const members = readDb
          .prepare('SELECT user_id FROM conversation_members WHERE conversation_id=?')
          .all(conversationId);
        const onlineRecipients = members.map(m => m.user_id).filter(uid => uid !== userId && isOnline(uid));

        if (onlineRecipients.length > 0) {
          recordDeliveries(id, onlineRecipients);
          io.to(`user_${userId}`).emit('message_delivered', {
            messageId:      id,
            conversationId,
            deliveredCount: onlineRecipients.length,
          });
        }

        const pushContent = safeContent ||
          (type === 'image' ? '[图片]' : type === 'voice' ? '[语音]' : type === 'video' ? '[视频]' : '[文件]');
        pushNewMessage({
          conversationId,
          senderId:     userId,
          senderName:   msg.senderName,
          content:      pushContent,
          type,
          timestamp:    created_at,
          onlineUserIds: onlineUserIdSet(),
          members,
        }).catch(() => {});
      });
    });

    // ── typing 状态管理（30s 无更新自动发 stop_typing，防幽灵状态）
    const typingTimers = new Map(); // conversationId → timeoutId
    function clearTyping(conversationId) {
      const t = typingTimers.get(conversationId);
      if (t) { clearTimeout(t); typingTimers.delete(conversationId); }
    }

    socket.on('typing', ({ conversationId }) => {
      clearTyping(conversationId);
      socket.to(conversationId).emit('typing', { userId, conversationId });
      typingTimers.set(conversationId, setTimeout(() => {
        socket.to(conversationId).emit('stop_typing', { userId, conversationId });
        typingTimers.delete(conversationId);
      }, 30000));
    });

    socket.on('stop_typing', ({ conversationId }) => {
      clearTyping(conversationId);
      socket.to(conversationId).emit('stop_typing', { userId, conversationId });
    });
    socket.on('join_conversation', ({ conversationId }) => socket.join(conversationId));
    socket.on('join_group',        ({ conversationId }) => socket.join(conversationId));

    socket.on('call:request',  ({ to, type, caller }) => io.to(`user_${to}`).emit('call:incoming', { from: userId, type, caller }));
    socket.on('call:response', ({ to, accepted })     => io.to(`user_${to}`).emit('call:response', { from: userId, accepted }));
    socket.on('call:offer',    ({ to, offer })         => io.to(`user_${to}`).emit('call:offer',    { from: userId, offer }));
    socket.on('call:answer',   ({ to, answer })        => io.to(`user_${to}`).emit('call:answer',   { from: userId, answer }));
    socket.on('call:ice',      ({ to, candidate })     => io.to(`user_${to}`).emit('call:ice',      { from: userId, candidate }));
    socket.on('call:end',      ({ to })                => io.to(`user_${to}`).emit('call:end',      { from: userId }));

    socket.on('disconnect', () => {
      // 清理所有 typing 定时器，防止幽灵"正在输入"状态
      for (const [convId, t] of typingTimers) {
        clearTimeout(t);
        socket.to(convId).emit('stop_typing', { userId, conversationId: convId });
      }
      typingTimers.clear();

      const isLastDevice = removeSocket(userId, socket.id);
      if (app) app.set('onlineUsers', onlineUserIdSet());
      if (isLastDevice) {
        db.prepare('UPDATE users SET status=? WHERE id=?').run('offline', userId);
        userProfiles.delete(userId);
        const contacts = readDb.prepare('SELECT contact_id FROM contacts WHERE user_id=?').all(userId);
        if (contacts.length) {
          io.to(contacts.map(c => `user_${c.contact_id}`)).emit('user_offline', { userId });
        }
      }
    });
  });
};
