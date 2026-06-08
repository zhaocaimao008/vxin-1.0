'use strict';

const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, Notification, shell } = require('electron');
const path = require('path');

const VXIN_URL = 'https://chat.91aigu.com';

let mainWindow = null;
let tray = null;
let isQuitting = false;
let unreadCount = 0;

// ─── Tray icon helpers ────────────────────────────────────────────────────────

function buildTrayIcon(badge) {
  // Try to load the real icon; fall back to a programmatic placeholder
  try {
    const iconPath = path.join(__dirname, 'icon.png');
    let img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      // Resize to tray dimensions
      if (process.platform === 'darwin') {
        img = img.resize({ width: 16, height: 16 });
        img.setTemplateImage(true);
      } else {
        img = img.resize({ width: 32, height: 32 });
      }
      return img;
    }
  } catch (_) {}
  return nativeImage.createEmpty();
}

function updateTrayTooltip() {
  if (!tray) return;
  const base = 'v信';
  tray.setToolTip(unreadCount > 0 ? `${base} (${unreadCount} 条未读)` : base);
}

function updateBadge(count) {
  unreadCount = Math.max(0, count);

  // macOS / Linux dock badge
  if (process.platform === 'darwin' || process.platform === 'linux') {
    app.setBadgeCount(unreadCount);
  }

  // Windows: update tray tooltip since no native badge API
  updateTrayTooltip();
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

function createTray() {
  const icon = buildTrayIcon(0);
  tray = new Tray(icon);
  tray.setToolTip('v信');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开 v信',
      click() {
        showWindow();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click() {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
        mainWindow.hide();
      } else {
        showWindow();
      }
    }
  });

  // Windows double-click
  tray.on('double-click', () => {
    showWindow();
  });
}

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// ─── Main window ──────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 640,
    title: 'v信',
    show: false,   // defer until ready-to-show
    backgroundColor: '#F7F8FA',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: process.platform === 'win32',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: true,
    },
  });

  mainWindow.loadURL(VXIN_URL);

  // Show once DOM is ready (avoids white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Hide to tray on close instead of quitting
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      // Notify user the first time
      if (process.platform === 'win32' && tray) {
        tray.displayBalloon({
          iconType: 'info',
          title: 'v信',
          content: 'v信 已最小化到系统托盘，双击托盘图标可重新打开。',
        });
      }
    }
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Block navigation away from the app URL
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(VXIN_URL)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

// Renderer → main: show native OS notification
// Usage: window.electronAPI.notify({ title, body, badge })
ipcMain.on('notify', (_, { title = 'v信', body = '', badge = 0 } = {}) => {
  // Update badge count
  if (typeof badge === 'number') updateBadge(badge);

  // Only send native notification if window is hidden or minimized
  const shouldNotify = !mainWindow || !mainWindow.isVisible() || mainWindow.isMinimized();
  if (shouldNotify && Notification.isSupported()) {
    const notif = new Notification({
      title,
      body,
      icon: path.join(__dirname, 'icon.png'),
      silent: false,
    });
    notif.on('click', () => showWindow());
    notif.show();
  }
});

// Renderer → main: update badge only
ipcMain.on('badge', (_, count) => {
  updateBadge(typeof count === 'number' ? count : 0);
});

// ─── App menu ─────────────────────────────────────────────────────────────────

function buildMenu() {
  const template = [];

  // macOS app menu
  if (process.platform === 'darwin') {
    template.push({
      label: app.name,
      submenu: [
        { label: `关于 v信`, role: 'about' },
        { type: 'separator' },
        { label: '服务', role: 'services' },
        { type: 'separator' },
        { label: `隐藏 v信`, role: 'hide' },
        { label: '隐藏其他', role: 'hideOthers' },
        { label: '全部显示', role: 'unhide' },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'Cmd+Q',
          click() { isQuitting = true; app.quit(); },
        },
      ],
    });
  }

  // Edit menu — needed for copy/paste/undo in text inputs
  template.push({
    label: '编辑',
    submenu: [
      { label: '撤销', role: 'undo' },
      { label: '重做', role: 'redo' },
      { type: 'separator' },
      { label: '剪切', role: 'cut' },
      { label: '复制', role: 'copy' },
      { label: '粘贴', role: 'paste' },
      { label: '全选', role: 'selectAll' },
    ],
  });

  // Window menu
  template.push({
    label: '窗口',
    submenu: [
      { label: '最小化', role: 'minimize' },
      ...(process.platform === 'darwin'
        ? [{ label: '缩放', role: 'zoom' }, { type: 'separator' }, { label: '前置所有窗口', role: 'front' }]
        : [{ label: '全屏', role: 'togglefullscreen' }]
      ),
      { type: 'separator' },
      { label: '刷新', role: 'reload' },
      { label: '强制刷新', role: 'forceReload' },
      { label: '开发者工具', role: 'toggleDevTools' },
    ],
  });

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  buildMenu();
  createTray();
  createWindow();

  app.on('activate', () => {
    // macOS: re-open on dock click
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      showWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // On non-macOS, quit only when explicitly triggered (isQuitting=true).
  // On macOS the tray keeps the app alive.
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
  });
}
