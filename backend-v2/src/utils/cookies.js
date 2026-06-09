'use strict';
/**
 * Cookie 策略：同域 vs 跨域自动适配。
 *   同域 HTTPS（Nginx 反代）  → SameSite=Strict
 *   同域 HTTP（本地开发）     → SameSite=Lax
 *   跨域（Electron/独立前端域）→ SameSite=None + Secure（否则浏览器丢弃 Cookie）
 */
const config = require('../config');

function isHttps(req) {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function isCrossOrigin(req) {
  const origin = req.headers['origin'];
  if (!origin) return false;
  try { return new URL(origin).host !== req.get('host'); }
  catch { return false; }
}

// httpOnly JWT Cookie
function authCookieOptions(req) {
  const cross = isCrossOrigin(req);
  return {
    httpOnly: true,
    secure:   isHttps(req) || cross,
    sameSite: cross ? 'none' : (isHttps(req) ? 'strict' : 'lax'),
    maxAge:   config.tokenMaxAge * 1000,
    path:     '/',
  };
}

// 非 httpOnly 的 CSRF 双提交 Cookie（前端 JS 需读取并回传 header）
function csrfCookieOptions(req) {
  const cross = isCrossOrigin(req);
  return {
    httpOnly: false,
    secure:   isHttps(req) || cross,
    sameSite: cross ? 'none' : (isHttps(req) ? 'strict' : 'lax'),
    path:     '/',
  };
}

module.exports = { authCookieOptions, csrfCookieOptions, isHttps, isCrossOrigin };
