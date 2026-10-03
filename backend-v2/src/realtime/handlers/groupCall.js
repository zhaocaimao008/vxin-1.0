'use strict';
/**
 * 群音视频通话信令（mesh 网状，纯转发，服务端不参与媒体）。
 *
 * mesh 拓扑：N 个参与者两两建立 PeerConnection，无媒体服务器，零额外基建。
 * 适合小群（上限 MAX_PARTICIPANTS=9，再多带宽吃不消，需上 SFU 另议）。
 *
 * 防 glare（双方同时 offer）约定：
 *   新加入者 N 作为 answerer；房间内每个既有成员各自向 N 发 offer，N 逐个 answer。
 *   既有成员之间的连接在各自加入时已建好，无需重连。
 *
 * 事件（client → server → 定向 client）：
 *   group_call:start  {conversationId, type}        发起 → 服务端建 callId，向群成员广播 group_call:invite
 *   group_call:join   {callId}                       加入 → 回 group_call:peers(既有成员)，并通知既有成员 group_call:peer_joined
 *   group_call:offer  {callId, to, offer}            既有成员 → 新成员
 *   group_call:answer {callId, to, answer}           新成员 → 既有成员
 *   group_call:ice    {callId, to, candidate}        双向 ICE
 *   group_call:leave  {callId}                        离开 → 通知其余成员 group_call:peer_left；空了则结束
 *   （断线自动按 leave 处理）
 */
const { v4: uuidv4 } = require('uuid');
const { db } = require('../../db/connection');
const { isMember } = require('../../modules/messages/shared');
const sessions = require('../callSessions');
const { pushCallInvite } = require('../../utils/push');

const MAX_PARTICIPANTS = 9;
const MAX_CALL_DURATION_MS = 4 * 60 * 60 * 1000; // 4小时强制结束，防单用户永久独占
const nowSec = () => Math.floor(Date.now() / 1000);

// 后台功能开关：群语音 / 群视频是否允许发起（默认开启，缺省或非 'off' 即开）。
// 直接读 admin_settings 表，避免引入 admin.service 造成循环依赖；每次发起时读，实时生效。
function groupCallAllowed(type) {
  const key = type === 'video' ? 'feature_group_video_call' : 'feature_group_voice_call';
  const v = db.prepare('SELECT value FROM admin_settings WHERE key=?').get(key)?.value;
  return v !== 'off';
}

// 模块级共享（单进程 fork）：callId -> { conversationId, type, startedBy, members:Set, peak, startedAt }
const groupCalls = new Map();
// userId -> callId：一个用户同一时刻只在一个群通话内，便于断线清理与忙线判断
const userCall = new Map();
const lastStart = new Map();
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 128;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const target = (io, call, userId) => io.to(call.owners.get(userId));

function endCall(io, callId) {
  const call = groupCalls.get(callId);
  if (!call) return;
  if (call.timer) clearTimeout(call.timer);
  for (const uid of call.members) {
    if (userCall.get(uid) === callId) userCall.delete(uid);
    sessions.release(uid, callId);
  }
  io?.to(call.conversationId).emit('group_call:ended', { callId, reason: 'ended' });
  groupCalls.delete(callId);
  try {
    db.prepare("UPDATE group_call_logs SET status='ended', ended_at=?, participant_count=? WHERE id=?")
      .run(nowSec(), call.peak, callId);
  } catch (e) { console.warn('[groupCall] end 落库失败:', e.message); }
}

function removeMember(io, callId, userId) {
  const call = groupCalls.get(callId);
  if (!call || !call.members.has(userId)) return;
  call.members.delete(userId);
  call.owners.delete(userId);
  sessions.release(userId, callId);
  if (userCall.get(userId) === callId) userCall.delete(userId);
  // 通知其余成员该 peer 离开（关闭对应 PeerConnection / 移除画面）
  for (const uid of call.members) (io && target(io, call, uid))?.emit('group_call:peer_left', { callId, userId });
  if (call.members.size === 0) endCall(io, callId);
}

module.exports = function registerGroupCallHandler(io, socket) {
  const userId = socket.user.id;

  const fail = (reason, payload = {}) => socket.emit('group_call:error', {
    reason, ...(validId(payload.callId) ? { callId: payload.callId } : {}),
    ...(validId(payload.conversationId) ? { conversationId: payload.conversationId } : {}),
    ...(validId(payload.requestId) ? { requestId: payload.requestId } : {}),
  });
  const owns = call => call && call.members.has(userId) &&
    call.owners.get(userId) === socket.id;
  const on = (event, validate, handler) => socket.on(event, payload => {
    if (!object(payload) || !validate(payload)) { fail('invalid_payload', payload || {}); return; }
    handler(payload);
  });

  on('group_call:start', p => validId(p.conversationId) &&
    (p.requestId == null || validId(p.requestId)) && (p.type == null || ['audio', 'video'].includes(p.type)),
    ({ conversationId, type, requestId }) => {
    if (!conversationId || !isMember(conversationId, userId)) return;
    if (sessions.isBusy(userId)) { fail('busy', { conversationId, requestId }); return; }
    const activeInConv = [...groupCalls.values()].find(c => c.conversationId === conversationId);
    if (activeInConv) { fail('active_call', { conversationId, requestId }); return; }
    const conv = db.prepare("SELECT type FROM conversations WHERE id=?").get(conversationId);
    if (!conv || conv.type !== 'group') { fail('not_group', { conversationId, requestId }); return; }

    const t = type === 'video' ? 'video' : 'audio';
    // 后台开关拦截：被关闭的通话类型直接拒绝发起（实时生效，无需重启/重连）
    if (!groupCallAllowed(t)) {
      fail(t === 'video' ? 'video_disabled' : 'voice_disabled', { conversationId, requestId });
      return;
    }

    if (Date.now() - (lastStart.get(userId) || 0) < 5000) {
      fail('rate_limited', { conversationId, requestId }); return;
    }
    lastStart.set(userId, Date.now());
    setTimeout(() => lastStart.delete(userId), 5000).unref?.();
    const callId = uuidv4();
    const call = { conversationId, requestId, type: t, startedBy: userId, owners: new Map([[userId, socket.id]]), members: new Set([userId]), peak: 1, startedAt: nowSec(), timer: null };
    call.timer = setTimeout(() => {
      const c = groupCalls.get(callId);
      if (!c) return;
      console.warn(`[groupCall] 通话 ${callId} 超过4小时，强制结束`);
      for (const uid of [...c.members]) target(io, c, uid).emit('group_call:ended', { callId, reason: 'timeout' });
      endCall(io, callId);
    }, MAX_CALL_DURATION_MS);
    call.timer.unref?.();
    groupCalls.set(callId, call);
    sessions.claim(userId, callId);
    userCall.set(userId, callId);
    try {
      db.prepare('INSERT INTO group_call_logs (id,conversation_id,started_by,type,participant_count) VALUES (?,?,?,?,1)')
        .run(callId, conversationId, userId, t);
    } catch (e) { console.warn('[groupCall] start 落库失败:', e.message); }

    const starter = db.prepare('SELECT username, avatar FROM users WHERE id=?').get(userId);
    // 通知会话内其他成员有群通话邀请（conversationId 房间已在连接时 join）
    socket.to(conversationId).emit('group_call:invite', {
      callId, conversationId, type: t, from: userId,
      fromName: starter?.username, fromAvatar: starter?.avatar,
    });
    socket.emit('group_call:started', { callId, conversationId, type: t, requestId });

    // push 兜底（同 1对1 call.js）：群成员的 socket 可能后台/断线收不到上面的实时广播，
    // 逐个补推来电通知；不发给发起者自己。
    const members = db.prepare('SELECT user_id FROM conversation_members WHERE conversation_id=?').all(conversationId);
    for (const { user_id: toUserId } of members) {
      if (toUserId === userId) continue;
      pushCallInvite({ toUserId, fromUserId: userId, callerName: starter?.username || '', callType: t, callId, conversationId })
        .catch(e => console.warn(`[groupCall] 来电推送失败 callId=${callId} to=${toUserId}:`, e.message));
    }
  });

  on('group_call:join', p => validId(p.callId), ({ callId }) => {
    const call = groupCalls.get(callId);
    if (!call) { socket.emit('group_call:error', { reason: 'not_found', callId }); return; }
    if (!isMember(call.conversationId, userId)) return;
    if (call.members.has(userId)) {
      if (!owns(call)) fail('busy', { callId });
      return;
    }
    if (call.members.size >= MAX_PARTICIPANTS) { socket.emit('group_call:error', { reason: 'full', callId }); return; }
    if (sessions.isBusy(userId)) { fail('busy', { callId }); return; }

    const peers = [...call.members];                            // 既有成员（加入前）
    call.members.add(userId);
    call.owners.set(userId, socket.id);
    sessions.claim(userId, callId);
    call.peak = Math.max(call.peak, call.members.size);
    userCall.set(userId, callId);

    // 回给加入者：当前已有成员列表（它将作为 answerer 等待这些人的 offer）
    socket.emit('group_call:peers', { callId, conversationId: call.conversationId, type: call.type, peers });
    // 通知既有成员：新 peer 加入 → 各自向其发起 offer（mesh，避免 glare）
    for (const uid of peers) target(io, call, uid).emit('group_call:peer_joined', { callId, userId });
  });

  for (const [event, field] of [['group_call:offer', 'offer'], ['group_call:answer', 'answer'], ['group_call:ice', 'candidate']]) {
    on(event, p => validId(p.callId) && validId(p.to) && object(p[field]) &&
      (field === 'candidate' ? typeof p[field].candidate === 'string' && p[field].candidate.length <= 16384
        : p[field].type === field && typeof p[field].sdp === 'string' && p[field].sdp.length <= 1_000_000),
      p => fwd(event, { callId: p.callId, from: userId, [field]: p[field] }, p.to, p.callId));
  }

  function fwd(event, payload, to, callId) {
    if (!to) return;
    const call = groupCalls.get(callId);
    if (!owns(call) || !call.members.has(to)) return; // 只在同一通话成员间转发
    for (const uid of [userId, to]) {
      if (!isMember(call.conversationId, uid)) removeMember(io, callId, uid);
    }
    if (!call.members.has(userId) || !call.members.has(to)) return;
    target(io, call, to).emit(event, payload);
  }

  on('group_call:leave', p => validId(p.callId) || validId(p.requestId), ({ callId, requestId }) => {
    const id = callId || userCall.get(userId);
    const call = groupCalls.get(id);
    if (owns(call) && (callId || requestId === call.requestId)) removeMember(io, id, userId);
  });

  socket.on('disconnect', () => {
    const callId = userCall.get(userId);
    if (owns(groupCalls.get(callId))) removeMember(io, callId, userId);
  });
};

module.exports.revokeMembership = function (io, conversationId, userId) {
  for (const [callId, call] of groupCalls) {
    if (call.conversationId !== conversationId) continue;
    for (const uid of [...call.members]) {
      if (userId && uid !== userId) continue;
      io?.to(`user_${uid}`).emit('group_call:ended', { callId, reason: 'membership_revoked' });
      removeMember(io, callId, uid);
    }
  }
};

module.exports._state = { groupCalls, userCall, MAX_PARTICIPANTS }; // 供测试/监控
