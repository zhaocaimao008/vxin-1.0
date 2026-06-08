require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = [
  'https://chat.91aigu.com',
  'https://vxin.91aigu.com',
  'https://91aigu.com',
  'https://www.91aigu.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://104.244.95.70:8086',
  'http://93.179.127.50:8086',
];

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST'],
  }
});

// 创建上传目录
['uploads/avatars', 'uploads/files'].forEach(dir => {
  fs.mkdirSync(path.join(__dirname, '..', dir), { recursive: true });
});

app.set('trust proxy', 1); // 运行在 Nginx 反代后面

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:", "https:"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      fontSrc: ["'self'", "https:"],
      frameSrc: ["'self'"],
      mediaSrc: ["'self'", "data:", "blob:", "https:"],
    },
  },
}));
app.use(cors({
  origin: (origin, cb) => {
    // 允许无 Origin 的请求（移动端、curl）和白名单来源
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.set('io', io);
app.set('onlineUsers', new Set());

// CSRF 防护（双提交 Cookie 模式）：在路由之前注册，作为全域门控中间件
// 对 POST/PUT/PATCH/DELETE 校验 X-CSRF-Token header 与 csrf_token Cookie 一致
app.use('/api', require('./middleware/csrfProtection'));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/upload', require('./routes/upload'));

require('./socket')(io, app);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`v信后端服务已启动: http://localhost:${PORT}`));
