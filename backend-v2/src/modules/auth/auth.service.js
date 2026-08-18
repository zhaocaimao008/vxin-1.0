'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const { db, generateVxinId, generateUserInviteCode } = require('../../db/connection');
const { badRequest, notFound, forbidden } = require('../../utils/http');
const { addToBlacklist } = require('../../utils/tokenBlacklist');
const { invalidateUser } = require('../../utils/userStatusCache');

// 运行时邀请码：支持多个逗号分隔（后台可改）
function currentInviteCode() {
  const row = db.prepare("SELECT value FROM admin_settings WHERE key='invite_code'").get();
  return row?.value ?? config.inviteCode;
}

function isValidInviteCode(code) {
  if (!/^\d{6}$/.test(code)) return false;
  const raw = currentInviteCode();
  // 必须先配置邀请码才能注册：未配置时一律拒绝（不再默认放行任意 6 位码）
  if (!raw) return false;
  return raw.split(',').map(s => s.trim()).includes(code);
}

// 注册是否需要邀请码（后台总开关，存 admin_settings.invite_required）。默认需要。
function isInviteRequired() {
  const row = db.prepare("SELECT value FROM admin_settings WHERE key='invite_required'").get();
  return row?.value !== 'off';
}

// v信号注册总开关（存 admin_settings.feature_vxin_register）。默认开启，后端可随时关闭。
function isVxinRegisterEnabled() {
  const row = db.prepare("SELECT value FROM admin_settings WHERE key='feature_vxin_register'").get();
  return row?.value !== 'off';
}

// 解析注册邀请码：先认管理员全局码（无邀请人），再认某用户的专属码（记其为邀请人）。
// 返回 { valid, inviterId }。inviterId 仅在用了他人专属码时非空。
function resolveInvite(code) {
  if (!/^\d{6}$/.test(code)) return { valid: false, inviterId: null };
  const raw = currentInviteCode();
  const globals = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (globals.includes(code)) return { valid: true, inviterId: null };
  // 专属码：邀请人须存在且未被封禁
  const inviter = db.prepare('SELECT id FROM users WHERE invite_code=? AND banned=0').get(code);
  if (inviter) return { valid: true, inviterId: inviter.id };
  return { valid: false, inviterId: null };
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
  return req.ip || req.socket?.remoteAddress || '';
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, csrf: uuidv4() },
    config.jwtSecret,
    { algorithm: 'HS256', expiresIn: `${config.tokenMaxAge}s` }
  );
}

function serializeUser(u) {
  return {
    id: u.id, username: u.username, phone: u.phone,
    avatar: u.avatar || '', bio: u.bio || '',
    wechat_id: u.wechat_id || '', cover_photo: u.cover_photo || '',
  };
}

// token 可选：登录/注册/切换账号/刷新时传入，供 deleteSession 精确黑名单该设备的最新 token。
function upsertSession(userId, req, token = null) {
  const { device, platform } = detectDevice(req.headers['user-agent']);
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO user_sessions (id, user_id, device, platform, ip, created_at, last_seen, token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, device, platform) DO UPDATE SET ip=excluded.ip, last_seen=excluded.last_seen, token=excluded.token
  `).run(uuidv4(), userId, device, platform, getClientIp(req), now, now, token);
}

// ── 业务 ────────────────────────────────────────────────────────
async function register({ username, phone, password, inviteCode, loginType, identifier }) {
  // v信号注册模式：loginType='vxin' 时用 6 位数字 v信号注册（受 feature_vxin_register 开关控制）
  const vxinMode = loginType === 'vxin';
  if (vxinMode && !isVxinRegisterEnabled()) throw badRequest('v信号注册已关闭');
  if (!password) throw badRequest('请填写所有字段');

  let wechatId;
  if (vxinMode) {
    // v信号注册：用户自定义 6 位数字 v信号，不填手机号
    const vxin = String(identifier || '').trim();
    if (!/^\d{6}$/.test(vxin)) throw badRequest('v信号必须是6位数字');
    if (db.prepare('SELECT id FROM users WHERE wechat_id=?').get(vxin)) throw badRequest('该v信号已被注册');
    username = (username || vxin || '').trim();
    phone = '0' + vxin; // 占位手机号（0开头不与真实手机号冲突，登录走 v信号）
    wechatId = vxin;
  } else {
    if (!phone) throw badRequest('请填写所有字段');
    // 前端注册页无「用户名」输入框（仅手机号/密码/邀请码）→ username 缺省时用手机号兜底，
    // 保证 Windows/Android 客户端注册流程可用（手机号本身唯一，作为用户名不冲突）。
    username = (username || phone || '').trim();
    wechatId = generateVxinId();
  }
  // 用户名 2-20 字符（与前端 Register 保持一致，后端为权威）
  if (typeof username !== 'string' || username.length < 2 || username.length > 20)
    throw badRequest('用户名长度为 2-20 字符');
  if (typeof phone !== 'string' || phone.length < 5 || phone.length > 20 || !/^\+?[\d\s\-]{5,20}$/.test(phone))
    throw badRequest('手机号格式不正确');
  // 邀请码校验受后台总开关控制：关闭时任何人都可注册（但仍解析可选邀请码以记录邀请关系）；开启时强制校验。
  // resolveInvite 同时兼容「管理员全局码」和「其他用户的专属邀请码」，后者会记录邀请人（裂变）。
  let inviterId = null;
  if (isInviteRequired()) {
    if (!inviteCode || !/^\d{6}$/.test(inviteCode)) throw badRequest('邀请码必须是6位数字');
    const r = resolveInvite(inviteCode);
    if (!r.valid) throw badRequest('邀请码不正确');
    inviterId = r.inviterId;
  } else if (inviteCode && /^\d{6}$/.test(inviteCode)) {
    inviterId = resolveInvite(inviteCode).inviterId; // 关闭校验时仍尽力记录邀请关系
  }
  if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(password))
    throw badRequest('密码必须至少8位，且至少包含1个字母和1个数字');

  if (db.prepare('SELECT id FROM users WHERE phone=? OR username=?').get(phone, username))
    throw badRequest('用户名或手机号已存在');

  const hash = await bcrypt.hash(password, 12);
  const id = uuidv4();
  const myInviteCode = generateUserInviteCode(); // 新用户自己的专属邀请码
  try {
    db.prepare('INSERT INTO users (id,username,phone,password,wechat_id,invite_code,invited_by) VALUES (?,?,?,?,?,?,?)')
      .run(id, username, phone, hash, wechatId, myInviteCode, inviterId);
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') throw badRequest('用户名或手机号已存在');
    throw e;
  }

  const user = { id, username, phone, avatar: '', bio: '', wechat_id: wechatId, cover_photo: '' };
  return { token: signToken({ id, username }), user };
}

// 登录：支持「手机号 + 密码」与「v信号(wechat_id) + 密码」两种方式。
//   向后兼容：旧客户端仍发 { phone, password }，无 loginType/identifier 时回退按 phone 查询。
//   新客户端发 { loginType: 'phone'|'vxin', identifier, password }。
//   两条路径复用同一套密码校验 / JWT / Session / 设备逻辑，不复制第二套认证系统。
//   统一错误文案「账号或密码错误」——手机号与 v信号均不区分，避免账号枚举。
async function login(body = {}) {
  const password = body.password;
  // 归一化登录方式与账号标识：
  //   - 显式 loginType='vxin' 时按 v信号查；
  //   - 否则一律走手机号（含旧的 { phone } 请求与 loginType='phone'）。
  const loginType = body.loginType === 'vxin' ? 'vxin' : 'phone';
  const identifier =
    loginType === 'vxin'
      ? (body.identifier ?? body.wechat_id ?? '')
      : (body.identifier ?? body.phone ?? '');

  if (!identifier || !password) throw badRequest('请填写账号和密码');

  let user;
  if (loginType === 'vxin') {
    // v信号 = 6 位纯数字（现有 generateVxinId 规则）。格式不符直接按「账号或密码错误」拒绝，
    // 既避免无谓查询，也不泄漏「该 v信号不存在」的信息。
    const vxin = String(identifier).trim();
    if (!/^\d{6}$/.test(vxin)) throw badRequest('账号或密码错误');
    user = db.prepare('SELECT id,username,phone,avatar,bio,wechat_id,cover_photo,password,banned FROM users WHERE wechat_id=?').get(vxin);
  } else {
    user = db.prepare('SELECT id,username,phone,avatar,bio,wechat_id,cover_photo,password,banned FROM users WHERE phone=?').get(String(identifier).trim());
  }

  if (!user || !await bcrypt.compare(password, user?.password || '')) throw badRequest('账号或密码错误');
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
  // 显式列查询：绝不返回 token 等敏感列，仅暴露设备展示所需字段。
  const sessions = db.prepare(
    'SELECT id, user_id, device, platform, ip, created_at, last_seen FROM user_sessions WHERE user_id=? ORDER BY last_seen DESC'
  ).all(userId);
  db.prepare('UPDATE user_sessions SET last_seen=? WHERE user_id=? AND device=? AND platform=?')
    .run(Math.floor(Date.now() / 1000), userId, device, platform);
  return sessions.map(s => ({ ...s, current: s.device === device && s.platform === platform }));
}

// 单设备踢下线：只黑名单该会话最后记录的 token（不推进 password_changed_at，
// 否则会牵连该用户的所有其它在线设备一并失效）。返回该会话的 device/platform，
// 供上层定向断开对应的 socket 连接；会话不存在（已被删除/不属于该用户）返回 null。
async function deleteSession(userId, sessionId) {
  const session = db.prepare('SELECT device, platform, token FROM user_sessions WHERE id=? AND user_id=?').get(sessionId, userId);
  if (!session) return null;
  db.prepare('DELETE FROM user_sessions WHERE id=? AND user_id=?').run(sessionId, userId);
  if (session.token) {
    const payload = jwt.decode(session.token);
    if (payload?.exp) await addToBlacklist(session.token, payload.exp).catch(() => {});
  }
  return { device: session.device, platform: session.platform };
}

function deleteAllOtherSessions(userId, device, platform) {
  const now = Math.floor(Date.now() / 1000);
  db.transaction(() => {
    db.prepare('DELETE FROM user_sessions WHERE user_id=? AND NOT (device=? AND platform=?)').run(userId, device, platform);
    // 推进 password_changed_at，令所有被踢设备的 JWT（iat < 该时间戳）立即失效
    db.prepare('UPDATE users SET password_changed_at=? WHERE id=?').run(now, userId);
  })();
  invalidateUser(userId); // 驱逐状态缓存，令被踢设备下次请求立即拦截
}

async function deleteAccount(userId, password) {
  const user = db.prepare('SELECT password FROM users WHERE id=?').get(userId);
  if (!user) throw notFound('用户不存在');
  if (!await bcrypt.compare(password, user.password)) throw badRequest('密码错误，注销失败');
  const rand = Math.random().toString(36).slice(2, 8);
  const redpackets = require('../redpackets/redpackets.service');

  // 产品语义与顺序：
  //   ① 先结清该用户「发出且在途」的红包 —— 剩余未领金额按原路退回其本人钱包（复用过期回收口径）。
  //   ② 再校验钱包余额，若仍 > 0 则拒绝注销、要求先提现/清零（绝不吞钱/转走）。
  //   理由：在途红包本质是"预扣未真正花出去"的自有资金，注销前应先回到余额，再以"余额必须为 0"
  //   这一条统一口径拦截；否则用户会因在途红包被误判有余额而永远无法注销。
  //
  // ⚠ 事务边界（关键）：结算(退款) 与 拦截/软删「不能」放同一事务——否则拦截时的 throw 会连带
  //   回滚已完成的退款，导致钱既没退回、注销也没成，用户资金被卡死。故拆成两段：
  //   结算独立事务先提交（退款落袋），再在第二段事务里做余额拦截与软删。
  //   幂等：settle 用 status 'active'→'expired' 的 CAS 抢占，二次注销时已无 active 红包 → 不会重复退。

  // 第一段：结算在途红包（独立事务，退款一旦发生即持久化，与后续拦截无关）
  db.transaction(() => {
    redpackets.settleUserActivePacketsTx(userId);
  })();

  // 第二段：余额拦截 + 软删 + 脏数据清理（独立事务；拦截 throw 只回滚本段，不影响上面已提交的退款）
  db.transaction(() => {
    const walletRow = db.prepare('SELECT balance FROM wallets WHERE user_id=?').get(userId);
    const balance = walletRow ? walletRow.balance : 0;
    if (balance > 0) {
      throw badRequest(`钱包仍有余额 ${balance} 金币，请先提现或清零后再注销`, 'WALLET_NOT_EMPTY');
    }

    // wechat_id 必须置 NULL 而非 ''：idx_users_wechat_id_unique 是全表唯一索引（非 partial），
    // 若置 ''，第二个被注销账号会与第一个的 '' 冲突 → UNIQUE constraint failed 500。
    // SQLite UNIQUE 索引允许多个 NULL，故 NULL 是安全的注销占位；
    // ensureNumericVxinIds 也已排除 banned 用户，不会给已注销账号重新分配 vxin_id。
    db.prepare("UPDATE users SET username=?, phone=?, password='*', avatar='', bio='', wechat_id=NULL, banned=1 WHERE id=?")
      .run(`已注销${rand}`, `deleted_${rand}@x`, userId);
    invalidateUser(userId); // 驱逐状态缓存，令已注销账号立即被拒
    db.prepare('DELETE FROM contacts WHERE user_id=? OR contact_id=?').run(userId, userId);
    db.prepare('DELETE FROM blocked_users WHERE user_id=? OR blocked_id=?').run(userId, userId);
    db.prepare('DELETE FROM friend_requests WHERE from_id=? OR to_id=?').run(userId, userId);
    db.prepare('DELETE FROM conversation_members WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM device_accounts WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM user_sessions WHERE user_id=?').run(userId);
    // 补清此前遗漏的用户脏数据（参照 admin.deleteUser 的清理口径；自助注销仅软删用户本体，不删他人可见的会话/消息）
    db.prepare('DELETE FROM conversation_settings WHERE user_id=?').run(userId);
    db.prepare('DELETE FROM conversation_clears WHERE user_id=?').run(userId);
  })();
}

async function changePassword(userId, { oldPassword, newPassword, currentToken }) {
  // 后台开关拦截：关闭「自助修改密码」后，任何客户端（含绕过 UI 的直连）都被拒绝。
  // 直接读 admin_settings，避免引入 admin.service 造成循环依赖；实时生效，无需重启。
  if (db.prepare('SELECT value FROM admin_settings WHERE key=?').get('feature_change_password')?.value === 'off') {
    throw forbidden('管理员已关闭自助修改密码功能');
  }
  if (!oldPassword || !newPassword) throw badRequest('请填写完整');
  if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(newPassword)) throw badRequest('新密码至少8位且需包含字母和数字');
  const user = db.prepare('SELECT id,username,password,banned FROM users WHERE id=?').get(userId);
  if (!user) throw notFound('用户不存在');
  if (!await bcrypt.compare(oldPassword, user.password)) throw badRequest('当前密码错误');
  const hash = await bcrypt.hash(newPassword, 12);
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE users SET password=?, password_changed_at=? WHERE id=?').run(hash, now, userId);
  db.prepare('DELETE FROM user_sessions WHERE user_id=?').run(userId);
  // 将当前 token 加入黑名单，防止改密后旧 token 继续有效（最长 7 天）
  if (currentToken) await addToBlacklist(currentToken, jwt.decode(currentToken)?.exp);
  invalidateUser(userId); // 驱逐状态缓存
  return signToken(user);
}

// ── 设备多账号（丝滑切换）────────────────────────────────────────
// 记录"本设备(wallet)曾密码登录过 user"，切换时凭此免密重签发 token。
function recordDeviceAccount(walletId, userId) {
  if (!walletId || !userId) return;
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO device_accounts (wallet_id, user_id, created_at, last_used)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(wallet_id, user_id) DO UPDATE SET last_used=excluded.last_used
  `).run(walletId, userId, now, now);
}

function removeDeviceAccount(walletId, userId) {
  if (!walletId || !userId) return;
  db.prepare('DELETE FROM device_accounts WHERE wallet_id=? AND user_id=?').run(walletId, userId);
}

// 免密切换：校验本设备登录过该账号 → 重签发 token + 返回用户信息。
function switchAccount(walletId, userId) {
  if (!walletId) throw badRequest('请重新登录');
  const owned = db.prepare('SELECT 1 FROM device_accounts WHERE wallet_id=? AND user_id=?').get(walletId, userId);
  if (!owned) throw forbidden('该账号未在本设备登录过，请重新登录');
  const user = db.prepare('SELECT id,username,phone,avatar,bio,wechat_id,cover_photo,banned FROM users WHERE id=?').get(userId);
  if (!user) { removeDeviceAccount(walletId, userId); throw notFound('用户不存在'); }
  if (user.banned) { removeDeviceAccount(walletId, userId); throw forbidden('账号已被封禁'); }
  db.prepare('UPDATE device_accounts SET last_used=? WHERE wallet_id=? AND user_id=?')
    .run(Math.floor(Date.now() / 1000), walletId, userId);
  return { token: signToken(user), user: serializeUser(user) };
}

/** 忘记密码：手机号 + 邀请码验证后重置（无需登录） */
async function resetPassword({ phone, inviteCode, newPassword }) {
  if (!phone || !inviteCode || !newPassword) throw badRequest('请填写所有字段');
  if (typeof phone !== 'string' || phone.length < 5 || phone.length > 20 || !/^\+?[\d\s\-]{5,20}$/.test(phone))
    throw badRequest('手机号格式不正确');
  if (!/^\d{6}$/.test(inviteCode)) throw badRequest('邀请码必须是6位数字');
  if (!isValidInviteCode(inviteCode)) throw badRequest('邀请码不正确');
  if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(newPassword))
    throw badRequest('密码必须至少8位，且至少包含1个字母和1个数字');
  const user = db.prepare('SELECT id FROM users WHERE phone=?').get(phone);
  if (!user) return { success: true }; // 不暴露手机号是否已注册，防枚举
  const hash = await bcrypt.hash(newPassword, 12);
  const resetAt = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE users SET password=?, password_changed_at=? WHERE id=?').run(hash, resetAt, user.id);
  db.prepare('DELETE FROM user_sessions WHERE user_id=?').run(user.id);
  invalidateUser(user.id); // 驱逐状态缓存
  return { success: true };
}

module.exports = {
  register, login, getMe, refreshToken, upsertSession,
  listSessions, deleteSession, deleteAllOtherSessions, deleteAccount, changePassword, resetPassword,
  recordDeviceAccount, removeDeviceAccount, switchAccount,
  detectDevice,
};
