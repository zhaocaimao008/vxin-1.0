'use strict';
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { db } = require('../../db/connection');
const config = require('../../config');
const { badRequest, forbidden, notFound } = require('../../utils/http');
const { isMember, requireMember, memberRole, purgeConversation } = require('../messages/shared');

// ── 群昵称 ──────────────────────────────────────────────────────
function setNickname(io, convId, userId, nickname) {
  if (nickname && nickname.length > 30) throw badRequest('群昵称最长30字');
  requireMember(convId, userId, '不在群内');
  db.prepare('UPDATE conversation_members SET nickname=? WHERE conversation_id=? AND user_id=?')
    .run(nickname || null, convId, userId);
  if (io) io.to(convId).emit('group_updated', { id: convId });
  return nickname || null;
}

// ── 邀请链接 / 二维码 / 扫码进群 ────────────────────────────────
function createInviteLink(convId, userId) {
  requireMember(convId, userId, '不在群内');
  const token = uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase();
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
  db.prepare('INSERT OR REPLACE INTO group_invite_tokens (token, conversation_id, created_by, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, convId, userId, expiresAt);
  return { token, url: `${config.appUrl}/join/${token}`, expiresAt };
}

async function getQrCode(convId, userId) {
  requireMember(convId, userId, '不在群内');
  let invite = db.prepare('SELECT token FROM group_invite_tokens WHERE conversation_id=? AND expires_at>? ORDER BY created_at DESC LIMIT 1')
    .get(convId, Math.floor(Date.now() / 1000));
  if (!invite) {
    const token = uuidv4().replace(/-/g, '').slice(0, 16).toUpperCase();
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    db.prepare('INSERT INTO group_invite_tokens (token,conversation_id,created_by,expires_at) VALUES (?,?,?,?)')
      .run(token, convId, userId, expiresAt);
    invite = { token };
  }
  const url = `${config.appUrl}/join/${invite.token}`;
  const qrCode = await QRCode.toDataURL(url, { width: 240, margin: 2, color: { dark: '#191919', light: '#ffffff' } });
  return { qrCode, url, token: invite.token };
}

function joinByToken(io, userId, token) {
  const invite = db.prepare('SELECT * FROM group_invite_tokens WHERE token=? AND expires_at>?')
    .get(token, Math.floor(Date.now() / 1000));
  if (!invite) throw notFound('邀请链接无效或已过期');

  if (isMember(invite.conversation_id, userId)) {
    return { success: true, conversationId: invite.conversation_id, alreadyMember: true };
  }
  db.prepare('INSERT OR IGNORE INTO conversation_members (conversation_id,user_id,role) VALUES (?,?,?)')
    .run(invite.conversation_id, userId, 'member');
  const conv = db.prepare('SELECT id,type,name,avatar FROM conversations WHERE id=?').get(invite.conversation_id);
  if (io) {
    io.to(`user_${userId}`).emit('new_conversation', conv);
    io.to(invite.conversation_id).emit('group_updated', { id: invite.conversation_id });
  }
  return { success: true, conversationId: invite.conversation_id, conversation: conv };
}

// ── 群信息修改（群主/管理员）────────────────────────────────────
function updateInfo(io, convId, userId, { name, announcement }) {
  const conv = db.prepare('SELECT * FROM conversations WHERE id=? AND type=?').get(convId, 'group');
  if (!conv) throw notFound('群不存在');
  const role = memberRole(convId, userId);
  if (!role) throw forbidden('不在群内');
  if (role === 'member') throw forbidden('仅群主和管理员可修改群信息');

  if (name !== undefined) db.prepare('UPDATE conversations SET name=? WHERE id=?').run(name, convId);
  if (announcement !== undefined) db.prepare('UPDATE conversations SET announcement=? WHERE id=?').run(announcement, convId);
  const updated = db.prepare('SELECT id, name, announcement, owner_id FROM conversations WHERE id=?').get(convId);
  if (io) io.to(convId).emit('group_updated', updated);
  return updated;
}

function setAvatar(io, convId, userId, url) {
  const role = memberRole(convId, userId);
  if (!role) throw forbidden('不在群内');
  if (role === 'member') throw forbidden('仅群主和管理员可修改群头像');
  db.prepare('UPDATE conversations SET avatar=? WHERE id=?').run(url, convId);
  if (io) io.to(convId).emit('group_updated', { id: convId, avatar: url });
  return url;
}

// ── 邀请成员 ────────────────────────────────────────────────────
function invite(io, convId, userId, userIds) {
  if (!userIds?.length) throw badRequest('参数缺失');
  requireMember(convId, userId, '不在群内');
  const add = db.prepare('INSERT OR IGNORE INTO conversation_members (conversation_id,user_id) VALUES (?,?)');
  const added = [];
  userIds.forEach(uid => {
    if (!db.prepare('SELECT 1 FROM users WHERE id=?').get(uid)) return;
    if (add.run(convId, uid).changes > 0) added.push(uid);
  });
  if (io && added.length > 0) {
    const conv = db.prepare('SELECT id,type,name,avatar FROM conversations WHERE id=?').get(convId);
    added.forEach(uid => {
      io.to(`user_${uid}`).emit('new_conversation', conv);
      io.to(`user_${uid}`).emit('group_member_added', { conversationId: convId, userId: uid });
    });
    io.to(convId).emit('group_updated', { id: convId });
  }
  return added.length;
}

// ── 移除成员（仅群主）—— R2 修复：强制被踢者全端离开房间 ──────────
function kick(io, convId, ownerId, uid) {
  const conv = db.prepare('SELECT owner_id FROM conversations WHERE id=?').get(convId);
  if (!conv) throw notFound('群不存在');
  if (conv.owner_id !== ownerId) throw forbidden('仅群主可操作');
  if (uid === ownerId) throw badRequest('不能移除自己');

  db.prepare('DELETE FROM conversation_members WHERE conversation_id=? AND user_id=?').run(convId, uid);
  if (io) {
    io.in(`user_${uid}`).socketsLeave(convId);
    io.to(convId).emit('group_updated', { id: convId });
    io.to(`user_${uid}`).emit('group_kicked', { conversationId: convId });
  }
}

// ── 退群 / 群主解散 ─────────────────────────────────────────────
function leave(io, convId, userId) {
  const conv = db.prepare('SELECT owner_id FROM conversations WHERE id=?').get(convId);
  if (!conv) throw notFound('群不存在');
  if (conv.owner_id === userId) {
    purgeConversation(convId); // 完整级联清理，含消息（修复外键约束 500）
    if (io) io.to(convId).emit('group_dismissed', { conversationId: convId });
  } else {
    db.prepare('DELETE FROM conversation_members WHERE conversation_id=? AND user_id=?').run(convId, userId);
    if (io) io.to(convId).emit('group_updated', { id: convId });
  }
}

// ── 群详情 ──────────────────────────────────────────────────────
function info(convId, userId) {
  const myRole = memberRole(convId, userId);
  if (!myRole) throw forbidden('不在群内');
  const conv = db.prepare('SELECT * FROM conversations WHERE id=?').get(convId);
  if (!conv) throw notFound('群不存在');
  const members = db.prepare(`
    SELECT u.id, u.username, u.avatar, u.bio, cm.role, cm.nickname
    FROM users u JOIN conversation_members cm ON cm.user_id=u.id
    WHERE cm.conversation_id=?
    ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.username
  `).all(convId);
  return { ...conv, members, myRole };
}

// ── 群管理设置（禁止私聊/全员禁言/禁止互加）──────────────────────
function manage(io, convId, userId, body) {
  const conv = db.prepare('SELECT * FROM conversations WHERE id=? AND type=?').get(convId, 'group');
  if (!conv) throw notFound('群不存在');
  const role = memberRole(convId, userId);
  if (!role || role === 'member') throw forbidden('无权操作，仅群主或管理员可修改');

  const updates = [], params = [];
  const { no_private_chat, mute_all, no_add_friend } = body;
  if (no_private_chat !== undefined) { updates.push('no_private_chat=?'); params.push(no_private_chat ? 1 : 0); }
  if (mute_all !== undefined) { updates.push('mute_all=?'); params.push(mute_all ? 1 : 0); }
  if (no_add_friend !== undefined) { updates.push('no_add_friend=?'); params.push(no_add_friend ? 1 : 0); }
  if (updates.length === 0) throw badRequest('无有效参数');

  params.push(convId);
  db.prepare(`UPDATE conversations SET ${updates.join(',')} WHERE id=?`).run(...params);
  const updated = db.prepare('SELECT id, no_private_chat, mute_all, no_add_friend FROM conversations WHERE id=?').get(convId);
  if (io) io.to(convId).emit('group_settings_updated', updated);
  return updated;
}

// ── 设置/取消管理员（仅群主）────────────────────────────────────
function setRole(io, convId, ownerId, uid, role) {
  if (!['admin', 'member'].includes(role)) throw badRequest('无效角色');
  const conv = db.prepare('SELECT owner_id FROM conversations WHERE id=?').get(convId);
  if (!conv) throw notFound('群不存在');
  if (conv.owner_id !== ownerId) throw forbidden('仅群主可设置管理员');
  if (uid === ownerId) throw badRequest('不能修改自己的角色');
  const target = db.prepare('SELECT role FROM conversation_members WHERE conversation_id=? AND user_id=?').get(convId, uid);
  if (!target) throw notFound('成员不存在');
  if (target.role === 'owner') throw badRequest('不能修改群主角色');

  db.prepare('UPDATE conversation_members SET role=? WHERE conversation_id=? AND user_id=?').run(role, convId, uid);
  if (io) {
    io.to(convId).emit('group_updated', { id: convId });
    io.to(`user_${uid}`).emit('role_changed', { conversationId: convId, role });
  }
}

// ── 置顶消息 ────────────────────────────────────────────────────
function pinMessage(io, convId, userId, msgId) {
  if (!msgId) throw badRequest('参数缺失');
  requireMember(convId, userId, '不在会话中');
  const msg = db.prepare('SELECT id,type,content,sender_id FROM messages WHERE id=? AND conversation_id=?').get(msgId, convId);
  if (!msg) throw notFound('消息不存在');
  db.prepare('INSERT OR REPLACE INTO pinned_messages (id,conversation_id,message_id,pinned_by) VALUES (?,?,?,?)')
    .run(uuidv4(), convId, msgId, userId);
  const pinner = db.prepare('SELECT username FROM users WHERE id=?').get(userId);
  if (io) io.to(convId).emit('message_pinned', { msgId, convId, pinnedBy: pinner?.username, content: msg.content, type: msg.type });
}

function unpinMessage(io, convId, userId, msgId) {
  requireMember(convId, userId, '不在会话中');
  db.prepare('DELETE FROM pinned_messages WHERE conversation_id=? AND message_id=?').run(convId, msgId);
  if (io) io.to(convId).emit('message_unpinned', { msgId, convId });
}

function listPinned(convId, userId) {
  requireMember(convId, userId);
  return db.prepare(`
    SELECT pm.message_id as msgId, pm.pinned_by, pm.created_at,
      m.type, m.content, m.file_url, u.username as senderName, pu.username as pinnedByName
    FROM pinned_messages pm
    JOIN messages m ON m.id=pm.message_id
    JOIN users u ON u.id=m.sender_id
    JOIN users pu ON pu.id=pm.pinned_by
    WHERE pm.conversation_id=? ORDER BY pm.created_at DESC LIMIT 20
  `).all(convId);
}

module.exports = {
  setNickname, createInviteLink, getQrCode, joinByToken,
  updateInfo, setAvatar, invite, kick, leave, info, manage, setRole,
  pinMessage, unpinMessage, listPinned,
};
