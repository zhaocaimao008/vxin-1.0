const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const db = require('../models/db');
const auth = require('../middleware/auth');

const router = express.Router();

function detectDevice(ua = '') {
  if (/Windows/i.test(ua)) return { device: 'Windows PC', platform: 'Windows' };
  if (/Macintosh|Mac OS/i.test(ua)) return { device: 'Mac', platform: 'Mac' };
  if (/iPhone/i.test(ua)) return { device: 'iPhone', platform: 'iPhone' };
  if (/iPad/i.test(ua)) return { device: 'iPad', platform: 'iPad' };
  if (/Android/i.test(ua)) return { device: 'Android 手机', platform: 'Android' };
  if (/Linux/i.test(ua)) return { device: 'Linux PC', platform: 'Linux' };
  return { device: '浏览器', platform: 'Web' };
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '';
}

function upsertSession(userId, req) {
  const { device, platform } = detectDevice(req.headers['user-agent']);
  const ip = getClientIp(req);
  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO user_sessions (id, user_id, device, platform, ip, created_at, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, device, platform) DO UPDATE SET
      ip = excluded.ip,
      last_seen = excluded.last_seen
  `).run(id, userId, device, platform, ip, now, now);
}

const COOKIE_NAME = 'vxin_token';
const TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30天，秒

function generateVxinId() {
  for (let i = 0; i < 1000; i += 1) {
    const value = String(Math.floor(100000 + Math.random() * 900000));
    const taken = db.prepare('SELECT 1 FROM users WHERE wechat_id=?').get(value);
    if (!taken) return value;
  }
  throw new Error('v信号生成失败');
}

function serializeUser(user) {
  return {
    id: user.id,
    username: user.username,
    phone: user.phone,
    avatar: user.avatar || '',
    bio: user.bio || '',
    wechat_id: user.wechat_id || '',
    cover_photo: user.cover_photo || '',
  };
}

// Cookie 选项
function cookieOptions(req) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'strict' : 'lax',
    maxAge: TOKEN_MAX_AGE * 1000, // ms
    path: '/',
  };
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '登录尝试过于频繁，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: '注册过于频繁，请1小时后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── 注册 ──────────────────────────────────────────────────────────
router.post('/register', registerLimiter, async (req, res) => {
  const { username, phone, password } = req.body;
  if (!username || !phone || !password)
    return res.status(400).json({ error: '请填写所有字段' });

  // 密码强度检查：至少8位，至少包含1个字母和1个数字
  const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password))
    return res.status(400).json({ error: '密码必须至少8位，且至少包含1个字母和1个数字' });

  const existing = db.prepare('SELECT id FROM users WHERE phone=? OR username=?').get(phone, username);
  if (existing) return res.status(400).json({ error: '用户名或手机号已存在' });

  const hash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  const wechatId = generateVxinId();
  db.prepare('INSERT INTO users (id,username,phone,password,wechat_id) VALUES (?,?,?,?,?)').run(id, username, phone, hash, wechatId);

  const token = jwt.sign({ id, username, csrf: uuidv4() }, process.env.JWT_SECRET, { expiresIn: `${TOKEN_MAX_AGE}s` });
  res.cookie(COOKIE_NAME, token, cookieOptions(req));
  upsertSession(id, req);
  res.json({ token, user: { id, username, phone, avatar: '', bio: '', wechat_id: wechatId, cover_photo: '' } });
});

// ── 登录 ──────────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: '请填写手机号和密码' });

  const user = db.prepare('SELECT * FROM users WHERE phone=?').get(phone);
  if (!user) return res.status(400).json({ error: '用户不存在' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: '密码错误' });

  const token = jwt.sign(
    { id: user.id, username: user.username, csrf: uuidv4() },
    process.env.JWT_SECRET,
    { expiresIn: `${TOKEN_MAX_AGE}s` }
  );
  res.cookie(COOKIE_NAME, token, cookieOptions(req));
  upsertSession(user.id, req);
  res.json({ token, user: serializeUser(user) });
});

// ── 获取当前登录用户（页面刷新时调用）────────────────────────────
router.get('/me', auth, (req, res) => {
  const user = db.prepare('SELECT id,username,phone,avatar,bio,wechat_id,cover_photo FROM users WHERE id=?').get(req.user.id);
  if (!user) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return res.status(401).json({ error: '用户不存在' });
  }
  res.json(serializeUser(user));
});

// ── 刷新 Token（续期，每次有效请求时可调用）────────────────────
router.post('/refresh', auth, (req, res) => {
  const token = jwt.sign(
    { id: req.user.id, username: req.user.username, csrf: uuidv4() },
    process.env.JWT_SECRET,
    { expiresIn: `${TOKEN_MAX_AGE}s` }
  );
  res.cookie(COOKIE_NAME, token, cookieOptions(req));
  res.json({ success: true });
});

// ── 登出 ──────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ success: true });
});

// ── 登录设备列表 ─────────────────────────────────────────────────────
router.get('/sessions', auth, (req, res) => {
  const { device, platform } = detectDevice(req.headers['user-agent']);
  const sessions = db.prepare('SELECT * FROM user_sessions WHERE user_id=? ORDER BY last_seen DESC').all(req.user.id);
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE user_sessions SET last_seen=? WHERE user_id=? AND device=? AND platform=?')
    .run(now, req.user.id, device, platform);
  res.json(sessions.map(s => ({ ...s, current: s.device === device && s.platform === platform })));
});

router.delete('/sessions/:id', auth, (req, res) => {
  db.prepare('DELETE FROM user_sessions WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// ── 修改密码 ──────────────────────────────────────────────────────
router.put('/change-password', auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: '请填写完整' });
  if (newPassword.length < 6) return res.status(400).json({ error: '新密码至少6位' });

  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const valid = await bcrypt.compare(oldPassword, user.password);
  if (!valid) return res.status(400).json({ error: '当前密码错误' });

  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password=? WHERE id=?').run(hash, req.user.id);

  // 密码修改后重新颁发 Token
  const token = jwt.sign(
    { id: user.id, username: user.username, csrf: uuidv4() },
    process.env.JWT_SECRET,
    { expiresIn: `${TOKEN_MAX_AGE}s` }
  );
  res.cookie(COOKIE_NAME, token, cookieOptions(req));
  res.json({ success: true });
});

module.exports = router;
