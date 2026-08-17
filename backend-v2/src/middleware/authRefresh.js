'use strict';
/**
 * 宽松鉴权中间件：专供 /auth/refresh 使用。
 *
 * 背景：前端在收到 401（access token 过期）后才调用 refresh。
 * 若 refresh 也用严格鉴权（jwt.verify 校验过期），过期 token 会直接 401，
 * 静默刷新永远无法在真正过期时生效 → 用户被迫重新登录。
 *
 * 本中间件：验证签名 + 黑名单 + 用户状态，但**忽略过期**，
 * 并设"滑动宽限窗口"（默认 1 个 tokenMaxAge，即最长 2 倍有效期），
 * 超过窗口仍拒绝，避免 token 被无限续期。
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { csrfCookieOptions } = require('../utils/cookies');
const { isBlacklisted } = require('../utils/tokenBlacklist');
const { readDb } = require('../db/connection');
const { getUserStatus, setUserStatus } = require('../utils/userStatusCache');

module.exports = function authRefresh(req, res, next) {
  // Cookie first (web); fall back to Bearer header (Electron desktop)
  const bearerHeader = req.headers['authorization'];
  const token = req.cookies?.[config.cookieName] ||
    (bearerHeader?.startsWith('Bearer ') ? bearerHeader.slice(7) : null);
  if (!token) return res.status(401).json({ error: '未授权' });

  isBlacklisted(token).then(blacklisted => {
    if (blacklisted) {
      res.clearCookie(config.cookieName, { path: '/' });
      return res.status(401).json({ error: '无效的Token，请重新登录' });
    }

    try {
      // 忽略过期，仅验签名（refresh 场景允许过期 token 换新）
      const payload = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256'],
        ignoreExpiration: true,
      });

      // 滑动宽限窗口：过期超过 1 个 tokenMaxAge 则拒绝续期
      if (payload.exp) {
        const graceMs = config.tokenMaxAge * 1000;
        if (Date.now() - payload.exp * 1000 > graceMs) {
          res.clearCookie(config.cookieName, { path: '/' });
          return res.status(401).json({ error: '登录已过期，请重新登录' });
        }
      }

      if (payload.id) {
        let row = getUserStatus(payload.id);
        if (!row) {
          row = readDb.prepare('SELECT banned, password_changed_at FROM users WHERE id=?').get(payload.id);
          if (row) setUserStatus(payload.id, row.banned, row.password_changed_at);
        }
        if (row?.banned) {
          res.clearCookie(config.cookieName, { path: '/' });
          return res.status(403).json({ error: '账号已被封禁' });
        }
        if (payload.iat && row?.password_changed_at && payload.iat < row.password_changed_at) {
          res.clearCookie(config.cookieName, { path: '/' });
          return res.status(401).json({ error: '密码已修改，请重新登录' });
        }
      }

      req.user = payload;
      req.token = token;
      req.csrfToken = req.user.csrf;
      res.cookie(config.csrfCookie, req.csrfToken, csrfCookieOptions(req));
      res.setHeader('X-CSRF-Token', req.csrfToken);
      next();
    } catch {
      res.clearCookie(config.cookieName, { path: '/' });
      return res.status(401).json({ error: 'Token无效' });
    }
  }).catch(err => {
    console.error('[AuthRefresh] Blacklist check error:', err);
    res.clearCookie(config.cookieName, { path: '/' });
    return res.status(503).json({ error: '认证服务暂时不可用，请稍后再试' });
  });
};
