'use strict';
/**
 * HTTP 辅助
 *   ApiError      —— 带状态码的业务错误，被 errorHandler 统一转成 JSON
 *   asyncHandler  —— 包裹 async controller，自动 catch 并转交 next(err)
 *
 * ⚠ 响应结构保持与旧后端逐字一致（裸 JSON，非信封），
 *   否则会破坏正在运行的 Web/Electron 前端。失败一律 { error: '...' }。
 */
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

const badRequest  = msg => new ApiError(400, msg);
const unauthorized = msg => new ApiError(401, msg);
const forbidden   = msg => new ApiError(403, msg);
const notFound    = msg => new ApiError(404, msg);
const conflict    = msg => new ApiError(409, msg);

const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { ApiError, asyncHandler, badRequest, unauthorized, forbidden, notFound, conflict };
