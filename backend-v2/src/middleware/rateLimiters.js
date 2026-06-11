'use strict';
/**
 * 集中式 HTTP 限流器定义（express-rate-limit）。
 * Socket 层的逐用户限流见 realtime/presence 中的 checkMsgRate。
 */
const rateLimit = require('express-rate-limit');

const json = msg => ({ error: msg });
const base = { standardHeaders: true, legacyHeaders: false };

// 登录：5 次失败 → 10 分钟锁定（需在 auth controller 中调用 recordFailedAttempt）
const loginLimiter = rateLimit({
  ...base, windowMs: 10 * 60 * 1000, max: 5,
  keyGenerator: req => req.body.phone || req.ip,
  handler: (req, res) => res.status(429).json(json('登录尝试过于频繁，账户已锁定10分钟')),
  message: json('登录尝试过于频繁，请10分钟后再试'),
});

// 注册：1 小时 5 次
const registerLimiter = rateLimit({
  ...base, windowMs: 60 * 60 * 1000, max: 5,
  message: json('注册过于频繁，请1小时后再试'),
});

// HTTP 发消息：单 IP 每分钟 60 条
const sendMsgLimiter = rateLimit({
  ...base, windowMs: 60 * 1000, max: 60,
  message: json('发送消息过于频繁，请稍后再试'),
});

// 上传凭证：单用户 10 分钟 30 次
const uploadCredentialLimiter = rateLimit({
  ...base, windowMs: 10 * 60 * 1000, max: 30,
  keyGenerator: req => req.user.id,
  handler: (req, res) => res.status(429).json(json('上传过于频繁，请稍后再试')),
  validate: { xForwardedForHeader: false },
});

module.exports = { loginLimiter, registerLimiter, sendMsgLimiter, uploadCredentialLimiter };
