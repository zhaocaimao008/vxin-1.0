'use strict';
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const { readDb } = require('../../db/connection');
const { write, writeAsync } = require('../../db/writer');
const { pushNewMessage } = require('../../utils/push');
const presence = require('../presence');

const MAX = config.limits.maxMsgLength;

// @提及检测：解析 content 中的 @用户名，向群内匹配成员推送
function handleMentions(io, userId, conversationId, content) {
  if (typeof content !== 'string') return;
  const mentionRe = /@([^\s,，。！？]+)/g;
  const mentioned = [];
  let m;
  while ((m = mentionRe.exec(content)) !== null) mentioned.push(m[1]);
  if (mentioned.length === 0) return;

  const uniqueNames = [...new Set(mentioned)];
  const memberIds = readDb.prepare('SELECT user_id FROM conversation_members WHERE conversation_id=?')
    .all(conversationId).map(m => m.user_id);
  if (memberIds.length === 0) return;

  const matched = readDb.prepare(
    `SELECT id, username FROM users
     WHERE username IN (${uniqueNames.map(() => '?').join(',')})
       AND id IN (${memberIds.map(() => '?').join(',')})`
  ).all(...uniqueNames, ...memberIds);

  const groupName = readDb.prepare('SELECT name FROM conversations WHERE id=?').get(conversationId)?.name || '群聊';
  const preview = content.length > 50 ? content.slice(0, 50) + '…' : content;
  const senderName = presence.getProfile(userId).username || '';

  for (const u of matched) {
    if (u.id !== userId) {
      io.to(`user_${u.id}`).emit('@mention', {
        fromUserId: userId, fromUserName: senderName, groupName,
        messagePreview: preview, conversationId,
      });
    }
  }
}

module.exports = function registerMessageHandler(io, socket) {
  const userId = socket.user.id;

  socket.on('send_message', async (data, ack) => {
    const { conversationId, content, reply_to_id } = data;
    // 允许文本与名片(contact_card)；名片的 content 是被分享用户的 JSON 快照
    const type = ['text', 'contact_card'].includes(data.type) ? data.type : 'text';

    if (!conversationId || !content) return;
    if (!presence.checkMsgRate(userId)) { ack?.({ success: false, error: '发送频率过高，请稍后再试' }); return; }
    if (typeof content === 'string' && content.length > MAX) {
      ack?.({ success: false, error: `消息内容不能超过 ${MAX} 个字符` }); return;
    }

    const member = readDb.prepare('SELECT role FROM conversation_members WHERE conversation_id=? AND user_id=?').get(conversationId, userId);
    if (!member) { ack?.({ success: false, error: '非群成员' }); return; }

    const conv = readDb.prepare('SELECT mute_all FROM conversations WHERE id=?').get(conversationId);
    if (conv?.mute_all && member.role === 'member') {
      ack?.({ success: false, error: '全员禁言中，您没有发言权限' }); return;
    }

    const id = uuidv4();
    const created_at = Math.floor(Date.now() / 1000);
    const profile = presence.getProfile(userId);

    const msg = {
      id, conversation_id: conversationId, sender_id: userId, type, content,
      file_url: '', reply_to_id: reply_to_id || null, deleted: 0, edited: 0, created_at,
      senderName: profile.username || '', senderAvatar: profile.avatar || '',
      reactions: [], replyTo: null,
    };

    // 有 reply 时等 worker commit 后再装配 replyTo（消除竞态）；否则 fire-and-forget
    if (reply_to_id) {
      await writeAsync(
        'INSERT INTO messages (id,conversation_id,sender_id,type,content,reply_to_id,created_at) VALUES (?,?,?,?,?,?,?)',
        [id, conversationId, userId, type, content, reply_to_id, created_at]
      );
      msg.replyTo = readDb.prepare(`
        SELECT m.id, m.type, m.content, m.file_url, u.username AS senderName
        FROM messages m JOIN users u ON u.id = m.sender_id
        WHERE m.id = ? AND m.conversation_id = ?
      `).get(reply_to_id, conversationId) || null;
    } else {
      write(
        'INSERT INTO messages (id,conversation_id,sender_id,type,content,reply_to_id,created_at) VALUES (?,?,?,?,?,?,?)',
        [id, conversationId, userId, type, content, null, created_at]
      );
    }

    socket.to(conversationId).emit('new_message', msg);
    ack?.({ success: true, message: msg });

    if (type === 'text') handleMentions(io, userId, conversationId, content);

    setImmediate(() => {
      const members = readDb.prepare('SELECT user_id FROM conversation_members WHERE conversation_id=?').all(conversationId);
      const onlineRecipients = members.map(m => m.user_id).filter(uid => uid !== userId && presence.isOnline(uid));
      if (onlineRecipients.length > 0) {
        presence.recordDeliveries(id, onlineRecipients);
        io.to(`user_${userId}`).emit('message_delivered', { messageId: id, conversationId, deliveredCount: onlineRecipients.length });
      }
      pushNewMessage({
        conversationId, senderId: userId, senderName: msg.senderName, content, type,
        timestamp: created_at, onlineUserIds: presence.onlineUserIdSet(), members,
      }).catch(() => {});
    });
  });
};
