'use strict';
/**
 * 启动入口：HTTP server + Socket.io + 实时层装配 + 监听。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const config = require('./config');
const app = require('./app');
const setupRealtime = require('./realtime');
const { shutdown: shutdownWriter } = require('./db/writer');

// 确保上传目录存在
['avatars', 'files'].forEach(d => fs.mkdirSync(path.join(config.uploadsRoot, d), { recursive: true }));

const server = http.createServer(app);

const io = new Server(server, {
  transports: ['websocket'], // 仅 websocket 防集群握手死锁
  cors: {
    origin: config.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

// 让 HTTP 路由层能拿到 io 与在线用户集合
app.set('io', io);
app.set('onlineUsers', new Set());

setupRealtime(io, app);

server.listen(config.port, () => {
  console.log(`v信后端 v2 已启动: http://localhost:${config.port}  (env=${config.env})`);
});

// 优雅退出：通知 worker flush 落盘后再退出（pm2 restart / 停服时不丢写）
let _closing = false;
function graceful(sig) {
  if (_closing) return;
  _closing = true;
  console.log(`[server] 收到 ${sig}，优雅退出中…`);
  try { shutdownWriter(); } catch {}
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', () => graceful('SIGTERM'));
process.on('SIGINT',  () => graceful('SIGINT'));

module.exports = { server, io };
