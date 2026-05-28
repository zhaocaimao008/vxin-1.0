const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');

const onlineUsers = new Map(); // userId -> socketId

module.exports = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('未授权'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Token无效'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    onlineUsers.set(userId, socket.id);
    db.prepare('UPDATE users SET status=? WHERE id=?').run('online', userId);

    socket.join(`user_${userId}`);

    const convs = db.prepare('SELECT conversation_id FROM conversation_members WHERE user_id=?').all(userId);
    convs.forEach(c => socket.join(c.conversation_id));

    const contacts = db.prepare('SELECT contact_id FROM contacts WHERE user_id=?').all(userId);
    contacts.forEach(c => {
      io.to(`user_${c.contact_id}`).emit('user_online', { userId });
    });

    // 发消息
    socket.on('send_message', (data, ack) => {
      const { conversationId, content, type = 'text', reply_to_id } = data;
      if (!conversationId || !content) return;

      const member = db.prepare('SELECT role FROM conversation_members WHERE conversation_id=? AND user_id=?').get(conversationId, userId);
      if (!member) return;

      // 全群禁言校验：普通成员不能发消息
      const conv = db.prepare('SELECT mute_all FROM conversations WHERE id=?').get(conversationId);
      if (conv?.mute_all && member.role === 'member') {
        if (ack) ack({ success: false, error: '全员禁言中，您没有发言权限' });
        return;
      }

      const id = uuidv4();
      db.prepare('INSERT INTO messages (id,conversation_id,sender_id,type,content,reply_to_id) VALUES (?,?,?,?,?,?)').run(id, conversationId, userId, type, content, reply_to_id || null);

      const msg = db.prepare('SELECT m.*, u.username as senderName, u.avatar as senderAvatar FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?').get(id);

      if (reply_to_id) {
        const replied = db.prepare('SELECT m.id,m.type,m.content,m.file_url,u.username as senderName FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?').get(reply_to_id);
        msg.replyTo = replied || null;
      }
      msg.reactions = [];

      io.to(conversationId).emit('new_message', msg);
      if (ack) ack({ success: true, message: msg });
    });

    socket.on('typing', ({ conversationId }) => {
      socket.to(conversationId).emit('typing', { userId, conversationId });
    });

    socket.on('stop_typing', ({ conversationId }) => {
      socket.to(conversationId).emit('stop_typing', { userId, conversationId });
    });

    socket.on('join_conversation', ({ conversationId }) => {
      socket.join(conversationId);
    });

    // 加入新群（被邀请后客户端调用）
    socket.on('join_group', ({ conversationId }) => {
      socket.join(conversationId);
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      db.prepare('UPDATE users SET status=? WHERE id=?').run('offline', userId);
      const contacts = db.prepare('SELECT contact_id FROM contacts WHERE user_id=?').all(userId);
      contacts.forEach(c => {
        io.to(`user_${c.contact_id}`).emit('user_offline', { userId });
      });
    });
  });
};
