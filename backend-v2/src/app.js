'use strict';
/**
 * Express 应用装配（不含 HTTP/Socket 启动，便于测试与复用）。
 * 中间件顺序：helmet → cors → cookieParser → body 解析 → 静态 → CSRF 门控 → 路由 → 错误处理。
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config');
const csrfProtection = require('./middleware/csrf');
const { notFoundHandler, errorHandler } = require('./middleware/error');

const app = express();

app.set('trust proxy', 1); // Nginx 反代后面

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'ws:', 'wss:', 'https:'],
      imgSrc:     ["'self'", 'data:', 'blob:', 'https:'],
      scriptSrc:  ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https:'],
      fontSrc:    ["'self'", 'https:'],
      frameSrc:   ["'self'"],
      mediaSrc:   ["'self'", 'data:', 'blob:', 'https:'],
    },
  },
}));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || config.allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(config.uploadsRoot));

// CSRF 双提交门控（路由之前）
app.use('/api', csrfProtection);

// ── 路由 ────────────────────────────────────────────────────────
app.use('/api/auth',          require('./modules/auth/auth.routes'));
app.use('/api/users',         require('./modules/users/users.routes'));
app.use('/api/messages',      require('./modules/messages/messages.routes'));
app.use('/api/moments',       require('./modules/moments/moments.routes'));
app.use('/api/notifications', require('./modules/notifications/notifications.routes'));
app.use('/api/upload',        require('./modules/upload/upload.routes'));
app.use('/api/admin',         require('./modules/admin/admin.routes'));

// 健康检查
app.get('/health', (req, res) => res.json({ ok: true, version: 2 }));

// ── 兜底 ────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
