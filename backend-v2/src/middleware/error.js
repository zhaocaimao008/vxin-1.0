'use strict';
/**
 * 统一错误处理（注册在所有路由之后）。
 * ApiError → 对应状态码 + { error }；其余未预期错误 → 500，日志保留堆栈。
 * 响应结构与旧后端一致：失败永远是 { error: '...' }。
 */
const { ApiError } = require('../utils/http');

// 404 兜底
function notFoundHandler(req, res) {
  res.status(404).json({ error: '接口不存在' });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof ApiError) {
    const body = { error: err.message };
    // 红包领取冲突等场景需透传额外字段（如 amount）
    if (err.amount !== undefined) body.amount = err.amount;
    return res.status(err.status).json(body);
  }
  // multer / 业务 throw 的普通 Error：若带 status 用之，否则 500
  if (err && err.status && err.message) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error('[error]', req.method, req.originalUrl, '→', err?.message, err?.stack);
  res.status(500).json({ error: '服务器内部错误' });
}

module.exports = { notFoundHandler, errorHandler };
