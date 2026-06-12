'use strict';
/**
 * 集中式配置：所有环境变量读取的唯一入口。
 * 业务代码一律 require('../config') 取值，禁止散落 process.env。
 */
require('dotenv').config();
const path = require('path');

const config = {
  env:  process.env.NODE_ENV || 'development',
  // backend-v2 验证期跑 3003，避免与生产 3002 冲突；上线切换时改回 3002
  port: parseInt(process.env.PORT_V2 || process.env.PORT, 10) || 3003,

  // ── 数据库 ──────────────────────────────────────────────────
  // 复用生产同一个 wechat.db（数据是契约，绝不另起炉灶）
  dbPath: path.resolve(__dirname, '../../wechat.db'),

  // ── 鉴权 ────────────────────────────────────────────────────
  jwtSecret:    process.env.JWT_SECRET,
  cookieName:   'vxin_token',
  csrfCookie:   'csrf_token',
  walletCookie: 'vxin_wallet',     // 设备多账号钱包(丝滑切换), httpOnly 长效
  walletMaxAge: 30 * 24 * 60 * 60, // 30天（秒）
  tokenMaxAge:  30 * 24 * 60 * 60, // 30天（秒）
  inviteCode:   process.env.INVITE_CODE || '',

  // ── 后台管理（独立超管账号）────────────────────────────────
  admin: {
    username:    process.env.ADMIN_USERNAME || '',
    password:    process.env.ADMIN_PASSWORD || '',
    cookieName:  'vxin_admin_token',
    tokenMaxAge: 12 * 60 * 60, // 12小时（秒）
    // IP 白名单(逗号分隔)。为空=不限制(默认，避免误锁)；非空时仅允许列表内 IP 访问后台。
    ipWhitelist: (process.env.ADMIN_IP_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean),
  },

  // ── CORS ────────────────────────────────────────────────────
  allowedOrigins: (() => {
    const defaults = [
      'https://chat.91aigu.com',
      'https://vxin.91aigu.com',
      'https://91aigu.com',
      'https://www.91aigu.com',
      'https://dipsin.com',
      'https://www.dipsin.com',
      'http://dipsin.com',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://104.244.95.70:8086',
      'http://93.179.127.50:8086',
    ];
    const extra = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    return [...new Set([...defaults, ...extra])];
  })(),

  // ── 应用 ────────────────────────────────────────────────────
  appUrl:       process.env.APP_URL || 'https://chat.91aigu.com',
  uploadsRoot:  path.resolve(__dirname, '../../../backend/uploads'),

  // ── 业务常量 ────────────────────────────────────────────────
  limits: {
    maxMsgLength:   2000,
    msgRateLimit:   3,      // Socket：每用户每秒最多 3 条
    msgRateWindow:  1000,
    recallWindow:   120,    // 撤回/编辑时限（秒）
    groupMembersPreview: 9, // 会话列表群头像预览数
    unreadCap:      99,     // 未读早停上限
  },

  vapid: {
    publicKey:  process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    email:      process.env.VAPID_EMAIL || 'mailto:admin@vxin.app',
  },
};

if (!config.jwtSecret) {
  console.error('[config] 致命错误：未设置 JWT_SECRET');
  process.exit(1);
}

module.exports = config;
