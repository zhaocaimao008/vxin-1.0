'use strict';
/** One-to-one signaling. A call belongs to the caller socket and the first
 * callee socket that accepts. Other devices must not control its media. */
const { v4: uuidv4 } = require('uuid');
const { privateSendGuard } = require('../../modules/messages/shared');
const { db } = require('../../db/connection');
const { pushCallInvite } = require('../../utils/push');
const sessions = require('../callSessions');
const CALL_TIMEOUT_MS = 120_000;
const CALL_COOLDOWN_MS = 5_000;
const activeCalls = new Map();
const callRateMap = new Map();
const nowSec = () => Math.floor(Date.now() / 1000);
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const id = v => typeof v === 'string' && v.length > 0 && v.length <= 128;
const target = (io, uid, socketId) => io.to(socketId || `user_${uid}`);

function finish(io, key, c, status, reason, from) {
  if (activeCalls.get(key) !== c) return;
  clearTimeout(c.timer);
  activeCalls.delete(key);
  sessions.release(c.caller, c.id);
  sessions.release(c.callee, c.id);
  const end = nowSec();
  try {
    db.prepare('UPDATE call_logs SET status=?, ended_at=?, duration=? WHERE id=?')
      .run(status, end, c.answeredAt ? Math.max(0, end - c.answeredAt) : 0, c.id);
  } catch (e) { console.warn('[call] end log:', e.message); }
  // End every ringing device too; established media is sent only to its owner.
  if (from !== c.caller) target(io, c.caller, c.callerSocket).emit('call:end', { from: c.callee, reason, callId: c.id });
  if (from !== c.callee) io.to(`user_${c.callee}`).emit('call:end', { from: c.caller, reason, callId: c.id });
  // A callee ending/rejecting also dismisses its other ringing devices.
  if (from === c.callee) io.to(`user_${c.callee}`).emit('call:end', { from: c.caller, reason, callId: c.id });
}

module.exports = function registerCallHandler(io, socket) {
  const userId = socket.user.id;
  const invalid = () => socket.emit('call:error', { reason: 'invalid_payload' });
  const valid = payload => object(payload) && id(payload.to) &&
    (payload.callId == null || id(payload.callId));
  function find(payload) {
    if (!valid(payload)) { invalid(); return null; }
    const k1 = `${userId}>${payload.to}`, k2 = `${payload.to}>${userId}`;
    const key = activeCalls.has(k1) ? k1 : k2;
    const c = activeCalls.get(key);
    if (!c || (payload.callId && payload.callId !== c.id)) return null;
    return { key, c };
  }
  function owns(c) {
    const owner = userId === c.caller ? c.callerSocket : c.calleeSocket;
    return !owner || owner === socket.id;
  }

  socket.on('call:request', payload => {
    if (!valid(payload) || (payload.type != null && !['audio', 'video'].includes(payload.type))) { invalid(); return; }
    const { to, type } = payload;
    if (to === userId) return;
    const now = Date.now();
    const retryAfterMs = CALL_COOLDOWN_MS - (now - (callRateMap.get(userId) || 0));
    if (retryAfterMs > 0) {
      socket.emit('call:response', { from: to, accepted: false, reason: 'rate_limited', retryAfterMs });
      return;
    }
    callRateMap.set(userId, now);
    setTimeout(() => callRateMap.delete(userId), CALL_COOLDOWN_MS).unref?.();
    const shareConv = db.prepare(`SELECT cm1.conversation_id AS id FROM conversation_members cm1
      JOIN conversation_members cm2 ON cm1.conversation_id=cm2.conversation_id
      JOIN conversations c ON c.id=cm1.conversation_id AND c.type='private'
      WHERE cm1.user_id=? AND cm2.user_id=? LIMIT 1`).get(userId, to);
    if (!shareConv || privateSendGuard(shareConv.id, userId)) {
      socket.emit('call:response', { from: to, accepted: false });
      return;
    }
    if (sessions.isBusy(userId) || sessions.isBusy(to)) {
      socket.emit('call:response', { from: to, accepted: false, busy: true });
      return;
    }
    const key = `${userId}>${to}`;
    const c = { id: uuidv4(), caller: userId, callee: to, callerSocket: socket.id,
      calleeSocket: null, answeredAt: null, timer: null };
    activeCalls.set(key, c);
    sessions.claim(userId, c.id);
    sessions.claim(to, c.id);
    c.timer = setTimeout(() => finish(io, key, c, 'missed', 'timeout'), CALL_TIMEOUT_MS);
    c.timer.unref?.();
    const t = type === 'video' ? 'video' : 'audio';
    try {
      db.prepare('INSERT INTO call_logs (id,caller_id,callee_id,type,status,started_at) VALUES (?,?,?,?,?,?)')
        .run(c.id, userId, to, t, 'missed', nowSec());
    } catch (e) { console.warn('[call] insert log:', e.message); }
    const caller = db.prepare('SELECT username, avatar FROM users WHERE id=?').get(userId);
    socket.emit('call:created', { to, callId: c.id });
    io.to(`user_${to}`).emit('call:incoming', { from: userId, type: t, callId: c.id,
      caller: { id: userId, name: caller?.username, avatar: caller?.avatar } });
    pushCallInvite({ toUserId: to, fromUserId: userId, callerName: caller?.username || '', callType: t, callId: c.id })
      .catch(e => console.warn('[call] push:', e.message));
  });

  socket.on('call:response', payload => {
    if (!valid(payload) || typeof payload.accepted !== 'boolean') { invalid(); return; }
    const found = find(payload);
    if (!found) return;
    const { key, c } = found;
    // First answer wins. Delayed answers/rejections from any device are stale.
    if (userId !== c.callee || c.answeredAt) return;
    const { accepted } = payload;
    if (accepted) {
      clearTimeout(c.timer);
      c.calleeSocket = socket.id;
      c.answeredAt = nowSec();
      db.prepare("UPDATE call_logs SET status='ongoing' WHERE id=?").run(c.id);
      const others = io.to(`user_${userId}`);
      if (socket.id && others.except) others.except(socket.id).emit('call:end', {
        from: c.caller, reason: 'answered_elsewhere', callId: c.id,
      });
    }
    target(io, c.caller, c.callerSocket).emit('call:response', {
      from: userId, accepted, busy: payload.busy === true,
      reason: accepted ? undefined : (payload.busy ? 'busy' : 'rejected'), callId: c.id,
    });
    if (!accepted) finish(io, key, c, 'rejected', 'rejected', userId);
  });

  for (const [event, field] of [['call:offer', 'offer'], ['call:answer', 'answer'], ['call:ice', 'candidate']]) {
    socket.on(event, payload => {
      const value = payload?.[field];
      const contentValid = object(value) && (field === 'candidate'
        ? typeof value.candidate === 'string' && value.candidate.length <= 16384
        : value.type === field && typeof value.sdp === 'string' && value.sdp.length <= 1_000_000);
      if (!valid(payload) || !contentValid) { invalid(); return; }
      const found = find(payload);
      if (!found) return;
      const { c } = found;
      if (!c.answeredAt || !owns(c)) return;
      if ((field === 'offer' && userId !== c.caller) || (field === 'answer' && userId !== c.callee)) return;
      const peerSocket = userId === c.caller ? c.calleeSocket : c.callerSocket;
      target(io, payload.to, peerSocket).emit(event, { from: userId, [field]: value, callId: c.id });
    });
  }

  socket.on('call:end', payload => {
    const found = find(payload);
    if (!found || !owns(found.c)) return;
    const { key, c } = found;
    const reason = ['timeout', 'network', 'error', 'media_error', 'connection_timeout'].includes(payload.reason) ? payload.reason : '';
    const status = c.answeredAt ? 'completed' : (reason === 'timeout' ? 'missed' : 'canceled');
    finish(io, key, c, status, reason, userId);
  });

  socket.on('disconnect', () => {
    for (const [key, c] of activeCalls) {
      if (c.callerSocket === socket.id && c.caller === userId ||
          c.answeredAt && c.calleeSocket === socket.id && c.callee === userId) {
        finish(io, key, c, c.answeredAt ? 'completed' : 'canceled', 'disconnected', userId);
      }
    }
  });
};
