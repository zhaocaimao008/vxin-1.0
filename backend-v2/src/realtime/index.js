'use strict';
/**
 * Socket.io 装配：
 *   - io.use 鉴权：仅从 Cookie 提取 JWT（不接受 handshake.auth.token，S1 修复）
 *   - connection：入 user 房间、延迟入会话房间、上线广播、注册各域 handler
 *   - disconnect：清理 typing、下线广播
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { db, readDb } = require('../db/connection');
const presence = require('./presence');

const registerMessage = require('./handlers/message');
const registerFile    = require('./handlers/file');
const registerTyping  = require('./handlers/typing');
const registerCall    = require('./handlers/call');

module.exports = function setupRealtime(io, app) {
  // ── 握手鉴权（Cookie-only）──────────────────────────────────
  io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie || '';
    const match = cookieHeader.match(new RegExp(`${config.cookieName}=([^;]+)`));
    const token = match ? decodeURIComponent(match[1]) : null;
    if (!token) return next(new Error('未授权'));
    try {
      socket.user = jwt.verify(token, config.jwtSecret);
      next();
    } catch {
      next(new Error('Token无效'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const isFirstDevice = !presence.isOnline(userId);

    presence.addSocket(userId, socket.id);
    if (app) app.set('onlineUsers', presence.onlineUserIdSet());

    // 立即入 user 房间，会话房间延迟到下一 tick
    socket.join(`user_${userId}`);
    setImmediate(() => {
      const convIds = readDb.prepare('SELECT conversation_id FROM conversation_members WHERE user_id=?')
        .all(userId).map(c => c.conversation_id);
      if (convIds.length) socket.join(convIds);
    });

    presence.cacheProfile(userId);

    // 上线广播 / 多端同步
    if (isFirstDevice) {
      db.prepare('UPDATE users SET status=? WHERE id=?').run('online', userId);
      const contacts = readDb.prepare('SELECT contact_id FROM contacts WHERE user_id=?').all(userId);
      if (contacts.length) io.to(contacts.map(c => `user_${c.contact_id}`)).emit('user_online', { userId });
    } else {
      socket.to(`user_${userId}`).emit('sync:device_connected', { socketId: socket.id });
    }

    // 注册各域 handler
    registerMessage(io, socket);
    registerFile(io, socket);
    const typing = registerTyping(io, socket);
    registerCall(io, socket);

    // ── 断线 ──────────────────────────────────────────────────
    socket.on('disconnect', () => {
      typing.cleanup();
      const isLastDevice = presence.removeSocket(userId, socket.id);
      if (app) app.set('onlineUsers', presence.onlineUserIdSet());
      if (isLastDevice) {
        db.prepare('UPDATE users SET status=? WHERE id=?').run('offline', userId);
        presence.dropProfile(userId);
        const contacts = readDb.prepare('SELECT contact_id FROM contacts WHERE user_id=?').all(userId);
        if (contacts.length) io.to(contacts.map(c => `user_${c.contact_id}`)).emit('user_offline', { userId });
      }
    });
  });
};
