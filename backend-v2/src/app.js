'use strict';
/**
 * Express 应用装配（不含 HTTP/Socket 启动，便于测试与复用）。
 * 中间件顺序：helmet → cors → cookieParser → body 解析 → 静态 → CSRF 门控 → 路由 → 错误处理。
 */
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');
const csrfProtection = require('./middleware/csrf');
const { notFoundHandler, errorHandler } = require('./middleware/error');
const { requestLogger } = require('./utils/logger');
const { metricsMiddleware, metrics } = require('./utils/monitoring');
const swaggerSpec = require('./utils/swagger');
const sentry = require('./utils/sentry');

const app = express();

// ── Sentry 错误追踪初始化 ────────────────────────────────────────
sentry.initSentry();
sentry.attachSentryMiddleware(app);

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

// 日志和监控中间件
app.use(requestLogger);
app.use(metricsMiddleware);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(config.uploadsRoot));
app.use('/downloads', express.static(path.join(__dirname, '../../downloads'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
  },
}));

// ── 下载中心页面 ─────────────────────────────────────────────────────
app.use('/download', require('./modules/download'));

// ── API 文档 ────────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 性能指标端点（Prometheus 格式）
app.get('/metrics', (req, res) => {
  res.type('text/plain');
  res.send(metrics.getPrometheusMetrics());
});

// 实时指标端点（JSON 格式，用于前端展示）
app.get('/api/metrics', (req, res) => {
  res.json(metrics.getMetrics());
});

// CSRF 双提交门控（路由之前）
app.use('/api', csrfProtection);

// ── 路由 ────────────────────────────────────────────────────────
app.use('/api/auth',          require('./modules/auth/auth.routes'));
app.use('/api/users',         require('./modules/users/users.routes'));
app.use('/api/messages',      require('./modules/messages/messages.routes'));
app.use('/api/moments',       require('./modules/moments/moments.routes'));
app.use('/api/notifications', require('./modules/notifications/notifications.routes'));
app.use('/api/upload',        require('./modules/upload/upload.routes'));
app.use('/api/stickers',      require('./modules/stickers/stickers.routes'));
app.use('/api/admin',         require('./modules/admin/admin.routes'));

// 公开配置（前端读取功能开关，决定朋友圈/收藏入口显隐）
const { getFeatures } = require('./modules/admin/admin.service');
app.get('/api/config', (req, res) => res.json({ features: getFeatures() }));

// 健康检查
app.get('/health', (req, res) => res.json({ ok: true, version: 2 }));

// ── 兜底 ────────────────────────────────────────────────────────
app.use(notFoundHandler);
sentry.attachSentryErrorHandler(app);
app.use(errorHandler);

module.exports = app;
