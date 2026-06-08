const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Bearer 优先，允许同一浏览器不同标签页用不同账号；Cookie 作为 Web 默认兜底。
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.vxin_token;
  if (!token) return res.status(401).json({ error: '未授权' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    // 从 JWT payload 中提取稳定 csrf token（由 jwt.sign 时注入）
    req.csrfToken = req.user.csrf;
    // 设置非 HttpOnly csrf_token Cookie 和响应头，前端 JS 均可读取
    // 后端 csrfProtection 中间件通过对比此 Cookie 与 X-CSRF-Token header 实现 CSRF 校验
    res.cookie('csrf_token', req.csrfToken, {
      httpOnly: false,
      sameSite: 'strict',
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      path: '/',
    });
    res.setHeader('X-CSRF-Token', req.csrfToken);
    next();
  } catch {
    // Token 过期或无效时清除 Cookie
    res.clearCookie('vxin_token', { path: '/' });
    return res.status(401).json({ error: 'Token无效或已过期' });
  }
};
