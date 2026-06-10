'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const { db, generateVxinId } = require('../../db/connection');
const { badRequest, notFound, forbidden } = require('../../utils/http');

// 运行时邀请码：支持多个逗号分隔（后台可改）
function currentInviteCode() {
  const row = db.prepare("SELECT value FROM admin_settings WHERE key='invite_code'").get();
  return row?.value ?? config.inviteCode;
}

function isValidInviteCode(code) {
  const raw = currentInviteCode();
  return raw.split(',').map(s => s.trim()).includes(code);
}

// ── 工具 ────────────────────────────────────────────────────────
function detectDevice(ua = '') {
  if (/Windows/i.test(ua))        return { device: 'Windows PC', platform: 'Windows' };
  if (/Macintosh|Mac OS/i.test(ua)) return { device: 'Mac', platform: 'Mac' };
  if (/iPhone/i.test(ua))         return { device: 'iPhone', platform: 'iPhone' };
  if (/iPad/i.test(ua))           return { device: 'iPad', platform: 'iPad' };
  if (/Android/i.test(ua))        return { device: 'Android 手机', platform: 'Android' };
  if (/Linux/i.test(ua))          return { device: 'Linux PC', platform: 'Linux' };
  return { device: '浏览器', platform: 'Web' };
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '';
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, csrf: uuidv4() },
    config.jwtSecret,
    { expiresIn: `${config.tokenMaxAge}s` }
  );
}

function serializeUser(u) {
  return {
    id: u.id, username: u.username, phone: u.phone,
    avatar: u.avatar || '', bio: u.bio || '',
    wechat_id: u.wechat_id || '', cover_photo: u.cover_photo || '',
  };
}

function upsertSession(userId, req) {
  const { device, platform } = detectDevice(req.headers['user-agent']);
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO user_sessions (id, user_id, device, platform, ip, created_at, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, device, platform) DO UPDATE SET ip=excluded.ip, last_seen=excluded.last_seen
  `).run(uuidv4(), userId, device, platform, getClientIp(req), now, now);
}

// ── 业务 ────────────────────────────────────────────────────────
async function register({ username, phone, password, inviteCode }) {
  if (!username || !phone || !password) throw badRequest('请填写所有字段');
  if (!inviteCode || !/^\d{6}$/.test(inviteCode)) throw badRequest('邀请码必须是6位数字');
  if (!isValidInviteCode(inviteCode)) throw badRequest('邀请码不正确');
  if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(password))
    throw badRequest('密码必须至少8位，且至少包含1个字母和1个数字');

  if (db.prepare('SELECT id FROM users WHERE phone=? OR username=?').get(phone, username))
    throw badRequest('用户名或手机号已存在');

  const hash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  const wechatId = generateVxinId();
  db.prepare('INSERT INTO users (id,username,phone,password,wechat_id) VALUES (?,?,?,?,?)')
    .run(id, username, phone, hash, wechatId);

  const user = { id, username, phone, avatar: '', bio: '', wechat_id: wechatId, cover_photo: '' };
  return { token: signToken({ id, username }), user };
}

async function login({ phone, password }) {
  if (!phone || !password) throw badRequest('请填写手机号和密码');
  const user = db.prepare('SELECT * FROM users WHERE phone=?').get(phone);
  if (!user) throw badRequest('用户不存在');
  if (!await bcrypt.compare(password, user.password)) throw badRequest('密码错误');
  if (user.banned) throw forbidden('账号已被封禁，请联系管理员');
  return { token: signToken(user), user: serializeUser(user) };
}

function getMe(userId) {
  const user = db.prepare('SELECT id,username,phone,avatar,bio,wechat_id,cover_photo FROM users WHERE id=?').get(userId);
  return user ? serializeUser(user) : null;
}

function refreshToken(payload) {
  return signToken({ id: payload.id, username: payload.username });
}

function listSessions(userId, req) {
  const { device, platform } = detectDevice(req.headers['user-agent']);
  const sessions = db.prepare('SELECT * FROM user_sessions WHERE user_id=? ORDER BY last_seen DESC').all(userId);
  db.prepare('UPDATE user_sessions SET last_seen=? WHERE user_id=? AND device=? AND platform=?')
    .run(Math.floor(Date.now() / 1000), userId, device, platform);
  return sessions.map(s => ({ ...s, current: s.device === device && s.platform === platform }));
}

function deleteSession(userId, sessionId) {
  db.prepare('DELETE FROM user_sessions WHERE id=? AND user_id=?').run(sessionId, userId);
}

async function changePassword(userId, { oldPassword, newPassword }) {
  if (!oldPassword || !newPassword) throw badRequest('请填写完整');
  if (newPassword.length < 6) throw badRequest('新密码至少6位');
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  if (!user) throw notFound('用户不存在');
  if (!await bcrypt.compare(oldPassword, user.password)) throw badRequest('当前密码错误');
  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password=? WHERE id=?').run(hash, userId);
  return signToken(user);
}

module.exports = {
  register, login, getMe, refreshToken, upsertSession,
  listSessions, deleteSession, changePassword,
};
