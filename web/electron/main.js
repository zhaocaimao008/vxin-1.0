'use strict';

const {
  app, BrowserWindow, ipcMain, Notification,
  shell, nativeTheme, session,
} = require('electron');
const path = require('path');

// ── 环境检测 ──────────────────────────────────────────────────
const IS_DEV     = process.env.ELECTRON_DEV === '1';
const LOAD_LOCAL = process.env.VXIN_LOAD_LOCAL === '1';
const SERVER_URL = process.env.VXIN_SERVER_URL || 'https://chat.91aigu.com';
const DEV_URL    = 'http://localhost:3000';
const PROD_INDEX = path.join(__dirname, '../dist/index.html');

const IS_LINUX = process.platform === 'linux';
const IS_MAC   = process.platform === 'darwin';

nativeTheme.themeSource = 'system';

// ── 窗口工厂 ─────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width:     1280,
    height:    800,
    minWidth:  900,
    minHeight: 600,

    // ── 无边框处理 ──────────────────────────────────────────
    // macOS：hiddenInset 保留红绿灯按钮原生位置
    // Linux / Windows：frame:false，由渲染层实现自定义标题栏
    // Linux 注意：titleBarStyle 对 Linux 无效，不能设置，否则在部分发行版会异常
    frame: !IS_MAC,
    ...(IS_MAC ? { titleBarStyle: 'hiddenInset' } : {}),

    backgroundColor: '#1c1c1e',
    show: false, // 等 ready-to-show 再显示，消除白屏闪烁

    // Linux 需要显式指定 icon，否则 deb 包桌面图标为空白
    ...(IS_LINUX ? { icon: path.join(__dirname, '../public/icon.png') } : {}),

    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,  // 必须：隔离主/渲染进程上下文
      nodeIntegration:  false, // 必须：渲染进程禁止直接调用 Node.js API
      sandbox:          true,  // 启用 Chromium 沙箱
      spellcheck:       false,
    },
  });

  // 内容就绪后再显示（防白屏）
  win.once('ready-to-show', () => win.show());

  // ── 向渲染层推送窗口最大化状态 ──────────────────────────────
  // Linux 和 Windows 必须手动 send，macOS 同样需要以保持一致
  win.on('maximize',   () => win.webContents.send('maximize'));
  win.on('unmaximize', () => win.webContents.send('unmaximize'));

  // Linux 全屏也触发最大化状态更新
  if (IS_LINUX) {
    win.on('enter-full-screen', () => win.webContents.send('maximize'));
    win.on('leave-full-screen', () => win.webContents.send('unmaximize'));
  }

  // ── 加载策略 ───────────────────────────────────────────────
  if (IS_DEV) {
    // 开发：Vite HMR，开启 DevTools
    win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else if (LOAD_LOCAL) {
    // 本地文件模式（需配合 .env.desktop 的 VITE_API_BASE）
    win.loadFile(PROD_INDEX);
  } else {
    // 生产推荐：加载已部署服务端，Cookie/Auth 完全同源
    win.loadURL(SERVER_URL);
  }

  // target="_blank" 链接交给系统默认浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

// ── 应用生命周期 ──────────────────────────────────────────────
app.whenReady().then(() => {
  // 开发模式：放宽 CSP 允许 Vite HMR 的 ws:// 连接
  if (IS_DEV) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' " +
            "http://localhost:* ws://localhost:* https://chat.91aigu.com",
          ],
        },
      });
    });
  }

  createWindow();

  // macOS：点击 Dock 图标重建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Windows / Linux：所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  if (!IS_MAC) app.quit();
});

// ── IPC 通道 ──────────────────────────────────────────────────

// 自定义标题栏窗口控制按钮
ipcMain.on('window:minimize', (_e) => {
  BrowserWindow.getFocusedWindow()?.minimize();
});
ipcMain.on('window:maximize', (_e) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  // Linux 全屏与最大化统一处理
  if (IS_LINUX && win.isFullScreen()) {
    win.setFullScreen(false);
  } else {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  }
});
ipcMain.on('window:close', (_e) => {
  BrowserWindow.getFocusedWindow()?.close();
});

// 查询最大化状态（渲染层初始化时同步一次）
ipcMain.handle('window:isMaximized', (_e) => {
  const win = BrowserWindow.getFocusedWindow();
  return win ? (win.isMaximized() || (IS_LINUX && win.isFullScreen())) : false;
});

// 系统原生通知
ipcMain.handle('notify:show', (_e, { title, body, icon } = {}) => {
  if (!Notification.isSupported()) return;
  new Notification({ title, body, icon }).show();
});
