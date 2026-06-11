'use strict';
const config = require('../../config');
const { authCookieOptions } = require('../../utils/cookies');
const { asyncHandler } = require('../../utils/http');
const svc = require('./auth.service');

function setAuthCookie(req, res, token) {
  res.cookie(config.cookieName, token, authCookieOptions(req));
}

exports.register = asyncHandler(async (req, res) => {
  const { token, user } = await svc.register(req.body);
  setAuthCookie(req, res, token);
  svc.upsertSession(user.id, req);
  res.json({ user });
});

exports.login = asyncHandler(async (req, res) => {
  const { token, user } = await svc.login(req.body);
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
  if (req.token && req.user.exp) {
    const { addToBlacklist } = require('../../utils/tokenBlacklist');
    await addToBlacklist(req.token, req.user.exp);
  }
  res.clearCookie(config.cookieName, { path: '/' });
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
