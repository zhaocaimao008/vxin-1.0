'use strict';
const crypto = require('crypto');
const config = require('../../config');
const { authCookieOptions, walletCookieOptions } = require('../../utils/cookies');
const { asyncHandler, badRequest } = require('../../utils/http');
const svc = require('./auth.service');

function setAuthCookie(req, res, token) {
  res.cookie(config.cookieName, token, authCookieOptions(req));
}

// 取本设备 wallet id（多账号丝滑切换）：无则生成并下发长效 httpOnly Cookie
function ensureWallet(req, res) {
  let walletId = req.cookies?.[config.walletCookie];
  if (!walletId) {
    walletId = crypto.randomUUID();
    res.cookie(config.walletCookie, walletId, walletCookieOptions(req));
  }
  return walletId;
}

exports.register = asyncHandler(async (req, res) => {
  const { token, user } = await svc.register(req.body);
  setAuthCookie(req, res, token);
  svc.recordDeviceAccount(ensureWallet(req, res), user.id);
  svc.upsertSession(user.id, req);
  res.json({ user });
});

exports.login = asyncHandler(async (req, res) => {
  const { token, user } = await svc.login(req.body);
  setAuthCookie(req, res, token);
  svc.recordDeviceAccount(ensureWallet(req, res), user.id);
  svc.upsertSession(user.id, req);
  res.json({ user });
});

// 免密切换账号：凭 wallet cookie 校验本设备登录过该账号 → 重签发 token
exports.switchAccount = asyncHandler(async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) throw badRequest('缺少 userId');
  const walletId = req.cookies?.[config.walletCookie];
  const { token, user } = svc.switchAccount(walletId, userId);
  setAuthCookie(req, res, token);
  svc.upsertSession(user.id, req);
  res.json({ user });
});

exports.me = asyncHandler(async (req, res) => {
  const user = svc.getMe(req.user.id);
  if (!user) {
    res.clearCookie(config.cookieName, { path: '/' });
    return res.status(401).json({ error: '用户不存在' });
  }
  res.json(user);
});

exports.refresh = asyncHandler(async (req, res) => {
  setAuthCookie(req, res, svc.refreshToken(req.user));
  res.json({ success: true });
});

exports.logout = asyncHandler(async (req, res) => {
  // 将 token 加入黑名单
  if (req.token && req.user?.exp) {
    const { addToBlacklist } = require('../../utils/tokenBlacklist');
    await addToBlacklist(req.token, req.user.exp);
  }
  // 退出即从本设备钱包移除当前账号（其余账号仍可丝滑切换）。
  // logout 路由无 auth 中间件，故从 cookie 解码取 userId。
  try {
    const jwt = require('jsonwebtoken');
    const tok = req.cookies?.[config.cookieName];
    const walletId = req.cookies?.[config.walletCookie];
    if (tok && walletId) {
      const payload = jwt.verify(tok, config.jwtSecret);
      svc.removeDeviceAccount(walletId, payload.id);
    }
  } catch (_) { /* token 无效就算了 */ }
  res.clearCookie(config.cookieName, { path: '/' });
  res.clearCookie(config.csrfCookie, { path: '/' });  // 同时清 CSRF cookie，避免残留导致下次登录/注册误报
  res.json({ success: true });
});

exports.sessions = asyncHandler(async (req, res) => {
  res.json(svc.listSessions(req.user.id, req));
});

exports.deleteSession = asyncHandler(async (req, res) => {
  svc.deleteSession(req.user.id, req.params.id);
  res.json({ success: true });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const token = await svc.changePassword(req.user.id, req.body);
  setAuthCookie(req, res, token);
  res.json({ success: true });
});
