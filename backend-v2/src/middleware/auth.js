'use strict';
/**
 * 鉴权中间件：仅从 httpOnly Cookie 读取 JWT，不接受 Authorization header
 * （Token 从不进响应体/localStorage，消除 XSS 窃取风险）。
 * 校验通过后顺带下发 CSRF 双提交 Cookie + header，供前端回传比对。
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { csrfCookieOptions } = require('../utils/cookies');

module.exports = function auth(req, res, next) {
  const token = req.cookies?.[config.cookieName];
  if (!token) return res.status(401).json({ error: '未授权' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    req.csrfToken = req.user.csrf;
    res.cookie(config.csrfCookie, req.csrfToken, csrfCookieOptions(req));
    res.setHeader('X-CSRF-Token', req.csrfToken);
    next();
  } catch {
    res.clearCookie(config.cookieName, { path: '/' });
    return res.status(401).json({ error: 'Token无效或已过期' });
  }
};
