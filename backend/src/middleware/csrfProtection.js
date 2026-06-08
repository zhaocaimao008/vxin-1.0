'use strict';

/**
 * CSRF Protection Middleware
 *
 * Double-submit cookie pattern:
 * - auth middleware sets a csrf_token cookie (non-HttpOnly) on each authenticated response
 * - Frontend reads this cookie and sends it as X-CSRF-Token header
 * - This middleware compares the cookie value with the header value
 * - GET/HEAD/OPTIONS are always skipped (safe methods)
 *
 * Since cookieParser runs before this middleware, req.cookies is available.
 * The csrf_token cookie was set by auth.js in a PRIOR response, so the browser
 * sends it on every subsequent request.
 */
module.exports = (req, res, next) => {
  // Safe methods — no CSRF risk
  if (/^(GET|HEAD|OPTIONS)$/i.test(req.method)) return next();

  // Read csrf_token from request cookie (set by auth.js in prior response)
  const cookieToken = req.cookies?.csrf_token;

  // No CSRF cookie means user hasn't completed authentication yet
  // (or CSRF token hasn't been issued) — skip check, auth.js will handle 401
  if (!cookieToken) return next();

  const headerToken = req.headers['x-csrf-token'];

  if (!headerToken || headerToken !== cookieToken) {
    return res.status(403).json({ error: 'CSRF token 无效或缺失' });
  }

  next();
};
