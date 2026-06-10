'use strict';
/**
 * WebRTC 1对1 通话信令转发（纯转发，服务端不参与媒体）。
 * 额外：把每通电话落库到 call_logs，生成通话历史 / 未接来电。
 *
 * 状态机（零前端改动，服务端用内存 Map 按 caller>callee 关联）：
 *   call:request           → 建记录 status=missed，记 started_at
 *   call:response accepted → status=ongoing（answered=true）
 *   call:response rejected → status=rejected, ended
 *   call:end (已接通)       → status=completed, duration=结束-接通
 *   call:end (未接通)       → status=canceled（主叫挂断/被叫未接）
 */
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../db/connection');

// 模块级共享（单进程 fork 实例）：key = `${callerId}>${calleeId}`
const activeCalls = new Map();

const nowSec = () => Math.floor(Date.now() / 1000);

module.exports = function registerCallHandler(io, socket) {
  const userId = socket.user.id;

  socket.on('call:request', ({ to, type, caller }) => {
    if (!to) return;
    const id = uuidv4();
    const t = type === 'video' ? 'video' : 'audio';
    activeCalls.set(`${userId}>${to}`, { id, answeredAt: null });
    try {
      db.prepare('INSERT INTO call_logs (id,caller_id,callee_id,type,status,started_at) VALUES (?,?,?,?,?,?)')
        .run(id, userId, to, t, 'missed', nowSec());
    } catch (e) { console.warn('[call] log insert 失败:', e.message); }
    io.to(`user_${to}`).emit('call:incoming', { from: userId, type, caller });
  });

  socket.on('call:response', ({ to, accepted }) => {
    // 被叫(userId)回应主叫(to)：key 方向为 主叫>被叫 = to>userId
    const c = activeCalls.get(`${to}>${userId}`);
    if (c) {
      try {
        if (accepted) {
          c.answeredAt = nowSec();
          db.prepare("UPDATE call_logs SET status='ongoing' WHERE id=?").run(c.id);
        } else {
          db.prepare("UPDATE call_logs SET status='rejected', ended_at=? WHERE id=?").run(nowSec(), c.id);
          activeCalls.delete(`${to}>${userId}`);
        }
      } catch (e) { console.warn('[call] response 落库失败:', e.message); }
    }
    io.to(`user_${to}`).emit('call:response', { from: userId, accepted });
  });

  socket.on('call:offer',  ({ to, offer })     => io.to(`user_${to}`).emit('call:offer',  { from: userId, offer }));
  socket.on('call:answer', ({ to, answer })    => io.to(`user_${to}`).emit('call:answer', { from: userId, answer }));
  socket.on('call:ice',    ({ to, candidate }) => io.to(`user_${to}`).emit('call:ice',    { from: userId, candidate }));

  socket.on('call:end', ({ to }) => {
    // 挂断可能来自任一方，两个方向都查
    const k1 = `${userId}>${to}`;
    const k2 = `${to}>${userId}`;
    const c = activeCalls.get(k1) || activeCalls.get(k2);
    if (c) {
      try {
        const end = nowSec();
        if (c.answeredAt) {
          db.prepare("UPDATE call_logs SET status='completed', ended_at=?, duration=? WHERE id=?")
            .run(end, Math.max(0, end - c.answeredAt), c.id);
        } else {
          db.prepare("UPDATE call_logs SET status='canceled', ended_at=? WHERE id=?").run(end, c.id);
        }
      } catch (e) { console.warn('[call] end 落库失败:', e.message); }
      activeCalls.delete(k1);
      activeCalls.delete(k2);
    }
    io.to(`user_${to}`).emit('call:end', { from: userId });
  });
};
