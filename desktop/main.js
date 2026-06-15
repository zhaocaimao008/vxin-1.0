'use strict';

const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, Notification, shell, dialog, nativeTheme } = require('electron');
const path = require('path');

let Store;
try { Store = require('electron-store'); } catch (_) { Store = null; }

const store = Store ? new Store({
  defaults: { serverUrl: 'https://dipsin.com', theme: 'auto', startMinimized: false }
}) : { get: (k, d) => d, set: () => {} };

let mainWindow = null;
let tray = null;
let isQuitting = false;
let unreadCount = 0;

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  const startMinimized = store.get('startMinimized', false);

  const serverUrl = store.get('serverUrl', 'https://dipsin.com');

  mainWindow = new BrowserWindow({
    width: 1000, height: 700,
    minWidth: 800, minHeight: 560,
    show: !startMinimized,
    backgroundColor: '#1a1a2e',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'win32',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // 将服务器地址同步传入 preload，供 React 在渲染前读取
      additionalArguments: [`--server-url=${serverUrl}`],
    },
  });

  if (process.platform === 'win32') {
    mainWindow.setMenu(null);
  }

  // 放行媒体权限：否则语音消息 / 音视频通话的 getUserMedia 会被 Electron 默认拒绝
  const ses = mainWindow.webContents.session;
  const GRANTED = ['media', 'audioCapture', 'videoCapture', 'notifications', 'clipboard-read', 'clipboard-sanitized-write'];
  ses.setPermissionRequestHandler((wc, permission, callback) => {
    callback(GRANTED.includes(permission));
  });
  // 部分 Chromium 版本走 check handler（同步），一并放行
  if (ses.setPermissionCheckHandler) {
    ses.setPermissionCheckHandler((wc, permission) => GRANTED.includes(permission));
  }

  mainWindow.loadFile(path.join(__dirname, 'web-dist', 'index.html'));

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ── Tray ──────────────────────────────────────────────────────────────────────

function buildTrayIcon(badge) {
  try {
    const iconPath = path.join(__dirname, badge > 0 ? 'icon.png' : 'icon.png');
    let img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      const size = process.platform === 'darwin' ? 16 : 32;
      img = img.resize({ width: size, height: size });
      if (process.platform === 'darwin') img.setTemplateImage(true);
      return img;
    }
  } catch (_) {}
  // Fallback: generate a colored square
  const size = 32;
  const canvas = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = 7; canvas[i * 4 + 1] = 193; canvas[i * 4 + 2] = 96; canvas[i * 4 + 3] = 255;
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function createTray() {
  tray = new Tray(buildTrayIcon(0));
  tray.setToolTip('v信');
  updateTrayMenu();
  tray.on('click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}

function updateTrayMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: '显示 v信', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  if (unreadCount > 0) {
    tray.setToolTip(`v信 (${unreadCount} 条未读)`);
  } else {
    tray.setToolTip('v信');
  }
}

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.handle('get-server-url', () => store.get('serverUrl', 'https://dipsin.com'));
ipcMain.handle('set-server-url', (_, url) => { store.set('serverUrl', url); });
ipcMain.handle('get-theme', () => store.get('theme', 'auto'));
ipcMain.handle('set-theme', (_, theme) => {
  store.set('theme', theme);
  if (theme === 'dark') nativeTheme.themeSource = 'dark';
  else if (theme === 'light') nativeTheme.themeSource = 'light';
  else nativeTheme.themeSource = 'system';
});

ipcMain.handle('set-badge', (_, count) => {
  unreadCount = count;
  updateTrayMenu();
  if (process.platform === 'darwin') app.dock.setBadge(count > 0 ? String(count) : '');
  if (process.platform === 'win32' && mainWindow) {
    if (count > 0) {
      const overlay = nativeImage.createEmpty();
      mainWindow.setOverlayIcon(overlay, `${count} 条未读`);
    } else {
      mainWindow.setOverlayIcon(null, '');
    }
  }
});

ipcMain.handle('show-notification', (_, { title, body, tag }) => {
  if (Notification.isSupported()) {
    const n = new Notification({ title, body, silent: false });
    n.on('click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
    n.show();
  }
});

ipcMain.handle('open-file-dialog', async (_, opts = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: opts.filters || [{ name: '所有文件', extensions: ['*'] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('read-file', async (_, filePath) => {
  const fs = require('fs');
  const data = fs.readFileSync(filePath);
  return { buffer: data.buffer, name: path.basename(filePath), size: data.length };
});

ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window-close', () => mainWindow?.hide());
ipcMain.handle('window-quit', () => { isQuitting = true; app.quit(); });

ipcMain.handle('get-platform', () => process.platform);

// ── App lifecycle ─────────────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); }
  });

  app.whenReady().then(() => {
    // Apply saved theme
    const theme = store.get('theme', 'auto');
    if (theme === 'dark') nativeTheme.themeSource = 'dark';
    else if (theme === 'light') nativeTheme.themeSource = 'light';

    createWindow();
    createTray();

    app.on('activate', () => {
      if (!mainWindow) createWindow();
      else mainWindow.show();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // Keep running in tray on Windows/Linux
    }
  });

  app.on('before-quit', () => { isQuitting = true; });
}
