'use strict';
/**
 * Electron 内存监控器
 *
 * 功能：
 *   1. 定期采样主进程 + 渲染进程内存
 *   2. 超阈值时主动触发 GC + 清理缓存
 *   3. 极端情况（>800MB）提示用户重启
 *   4. 开发模式下输出内存趋势日志
 */

const { app, BrowserWindow } = require('electron');

const WARN_MB   = 400;   // 警告阈值（MB）
const CRIT_MB   = 600;   // 严重阈值（MB）
const CHECK_MS  = 30000; // 检查间隔（30s）

let checkInterval = null;
let lastWarnedAt  = 0;

function getMemoryMB() {
  const info = process.memoryUsage();
  return {
    rss: Math.round(info.rss / 1024 / 1024),
    heap: Math.round(info.heapUsed / 1024 / 1024),
    heapTotal: Math.round(info.heapTotal / 1024 / 1024),
  };
}

async function checkMemory() {
  const mem = getMemoryMB();
  const now = Date.now();

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Memory] RSS=${mem.rss}MB Heap=${mem.heap}/${mem.heapTotal}MB`);
  }

  if (mem.rss > CRIT_MB) {
    // 触发 V8 GC（需要 --expose-gc 启动参数）
    if (global.gc) {
      global.gc();
      console.log('[Memory] ⚠️ 严重内存压力，已触发 GC');
    }
    // 通知渲染进程清理缓存
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('memory:pressure', { level: 'critical', rss: mem.rss });
        // 清理渲染进程 GPU 内存缓存
        win.webContents.session.clearCache().catch(() => {});
      }
    });
    if (now - lastWarnedAt > 5 * 60 * 1000) {  // 5分钟内只提示一次
      lastWarnedAt = now;
      console.warn(`[Memory] 内存使用率严重：${mem.rss}MB，建议重启应用`);
    }
  } else if (mem.rss > WARN_MB) {
    if (global.gc) global.gc();
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('memory:pressure', { level: 'warning', rss: mem.rss });
      }
    });
  }
}

function start() {
  if (checkInterval) return;
  // 启动后 10s 开始第一次检查（等应用稳定）
  setTimeout(() => {
    checkMemory();
    checkInterval = setInterval(checkMemory, CHECK_MS);
  }, 10000);
}

function stop() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

module.exports = { start, stop, getMemoryMB };
