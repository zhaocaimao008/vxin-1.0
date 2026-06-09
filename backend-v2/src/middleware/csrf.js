'use strict';
/**
 * CSRF 双提交 Cookie 校验（全域门控，注册在路由之前）。
 *   - 安全方法 GET/HEAD/OPTIONS 跳过
 *   - 对比 csrf_token Cookie 与 X-CSRF-Token header
 *   - 无 CSRF Cookie = 尚未鉴权，放行交给 auth 处理 401
 */
const config = require('../config');

module.exports = function csrfProtection(req, res, next) {
  if (/^(GET|HEAD|OPTIONS)$/i.test(req.method)) return next();

  const cookieToken = req.cookies?.[config.csrfCookie];
  if (!cookieToken) return next();

  const headerToken = req.headers['x-csrf-token'];
  if (!headerToken || headerToken !== cookieToken) {
    return res.status(403).json({ error: 'CSRF token 无效或缺失' });
  }
  next();
};
