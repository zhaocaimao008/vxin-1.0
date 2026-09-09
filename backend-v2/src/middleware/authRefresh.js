'use strict';
/** Refresh 仅接受尚未过期的 JWT，撤销记录的 exp 与可续期截止时间一致。 */
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
      // 校验 exp，禁止已撤销 JWT 在黑名单到期后重新续期。
      const payload = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256'],
      });

      if (!payload.id) return res.status(401).json({ error: 'Token无效' });
      if (payload.id) {
        let row = getUserStatus(payload.id);
        if (!row) {
          row = readDb.prepare('SELECT banned, password_changed_at, auth_version FROM users WHERE id=?').get(payload.id);
          if (row) setUserStatus(payload.id, row.banned, row.password_changed_at, row.auth_version);
        }
        // 旧 JWT 仅兼容初始版本 1；真实改密推进版本，恢复时间戳不能复活旧授权。
        if (!row || (payload.authVersion ?? 1) !== row.auth_version) return res.status(401).json({ error: '登录已失效，请重新登录' });
        if (row?.banned) {
          res.clearCookie(config.cookieName, { path: '/' });
          return res.status(403).json({ error: '账号已被封禁' });
        }
        if (payload.authVersion == null && (!payload.iat || payload.iat <= row.password_changed_at)) {
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
