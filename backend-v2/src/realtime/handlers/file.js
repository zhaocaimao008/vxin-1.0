'use strict';
const { v4: uuidv4 } = require('uuid');
const { readDb } = require('../../db/connection');
const { write, writeAsync } = require('../../db/writer');
const { pushNewMessage } = require('../../utils/push');
const { getPublicBase } = require('../../utils/cloudStorage');
const presence = require('../presence');

const TYPE_FALLBACK = { image: '[图片]', voice: '[语音]', video: '[视频]', file: '[文件]' };

module.exports = function registerFileHandler(io, socket) {
  const userId = socket.user.id;

  socket.on('send_file_message', async (data, ack) => {
    const { conversationId, type, file_url, content, reply_to_id } = data;
    const ALLOWED = new Set(['image', 'voice', 'video', 'file']);

    if (!conversationId || !file_url || !ALLOWED.has(type)) { ack?.({ success: false, error: '参数无效' }); return; }
    if (!presence.checkMsgRate(userId)) { ack?.({ success: false, error: '发送频率过高，请稍后再试' }); return; }

    // URL 必须来自已配置的云存储域名，防注入任意链接
    const publicBase = getPublicBase();
    if (!publicBase || !file_url.startsWith(publicBase + '/')) {
      ack?.({ success: false, error: '文件 URL 非法：不属于已配置的云存储域名' }); return;
    }

    const member = readDb.prepare('SELECT role FROM conversation_members WHERE conversation_id=? AND user_id=?').get(conversationId, userId);
    if (!member) { ack?.({ success: false, error: '非群成员' }); return; }

    const conv = readDb.prepare('SELECT mute_all FROM conversations WHERE id=?').get(conversationId);
    if (conv?.mute_all && member.role === 'member') { ack?.({ success: false, error: '全员禁言中，您没有发言权限' }); return; }

    const id = uuidv4();
    const created_at = Math.floor(Date.now() / 1000);
    const profile = presence.getProfile(userId);
    const safeContent = typeof content === 'string' ? content.slice(0, 200) : '';

    const msg = {
      id, conversation_id: conversationId, sender_id: userId, type, content: safeContent, file_url,
      reply_to_id: reply_to_id || null, deleted: 0, edited: 0, created_at,
      senderName: profile.username || '', senderAvatar: profile.avatar || '',
      reactions: [], replyTo: null,
    };

    if (reply_to_id) {
      await writeAsync(
        'INSERT INTO messages (id,conversation_id,sender_id,type,content,file_url,reply_to_id,created_at) VALUES (?,?,?,?,?,?,?,?)',
        [id, conversationId, userId, type, safeContent, file_url, reply_to_id, created_at]
      );
      msg.replyTo = readDb.prepare(`
        SELECT m.id, m.type, m.content, m.file_url, u.username AS senderName
        FROM messages m JOIN users u ON u.id = m.sender_id
        WHERE m.id = ? AND m.conversation_id = ?
      `).get(reply_to_id, conversationId) || null;
    } else {
      write(
        'INSERT INTO messages (id,conversation_id,sender_id,type,content,file_url,reply_to_id,created_at) VALUES (?,?,?,?,?,?,?,?)',
        [id, conversationId, userId, type, safeContent, file_url, null, created_at]
      );
    }

    // io.to(含发送者本人)：文件/图片发送方没有乐观消息，需靠广播回显自己的消息，
    // 否则发图后不刷新页面看不到(socket.to 会排除发送者)。onMsg 按 id 去重，无重复。
    io.to(conversationId).emit('new_message', msg);
    ack?.({ success: true, message: msg });

    setImmediate(() => {
      const members = readDb.prepare('SELECT user_id FROM conversation_members WHERE conversation_id=?').all(conversationId);
      const onlineRecipients = members.map(m => m.user_id).filter(uid => uid !== userId && presence.isOnline(uid));
      if (onlineRecipients.length > 0) {
        presence.recordDeliveries(id, onlineRecipients);
        io.to(`user_${userId}`).emit('message_delivered', { messageId: id, conversationId, deliveredCount: onlineRecipients.length });
      }
      pushNewMessage({
        conversationId, senderId: userId, senderName: msg.senderName,
        content: safeContent || TYPE_FALLBACK[type] || '[文件]', type,
        timestamp: created_at, onlineUserIds: presence.onlineUserIdSet(), members,
      }).catch(() => {});
    });
  });
};
