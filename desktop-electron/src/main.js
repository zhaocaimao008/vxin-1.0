'use strict';

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog,
        globalShortcut, clipboard, screen, Notification, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const Store = require('electron-store');

// ── 配置持久化 ──────────────────────────────────────────────
const store = new Store({
  defaults: {
    serverUrl: 'https://dipsin.com',
    autoLaunch: false,
    windowBounds: { width: 1200, height: 800 },
    minimizeToTray: true,
    notifications: true,
  },
});

// ── 日志 ────────────────────────────────────────────────────
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('v信 Desktop v2 启动');

// ── 全局引用（防止 GC） ──────────────────────────────────────
let mainWindow = null;
let tray = null;
let isQuitting = false;
let notificationQueue = [];

// ── 服务器地址 ──────────────────────────────────────────────
const SERVER_URL = store.get('serverUrl');

// ── 主窗口 ──────────────────────────────────────────────────
function createWindow() {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 900,
    minHeight: 600,
    title: 'v信',
    icon: path.join(__dirname, '../assets/icon.png'),
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  // 加载 web 构建产物
  const webDist = path.join(__dirname, '../../web/dist/index.html');
  mainWindow.loadFile(webDist);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // 检查更新（不阻塞启动）
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 5000);
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting && store.get('minimizeToTray')) {
      e.preventDefault();
      mainWindow.hide();
      return;
    }
    store.set('windowBounds', mainWindow.getBounds());
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // ── 拖拽文件 / 粘贴图片 ──────────────────────────────
  setupDragAndDrop();
}

// ── 自动更新 ──────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    log.info('检查更新中...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('发现新版本:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update:available', info);
    }
  });

  autoUpdater.on('update-not-available', () => {
    log.info('已是最新版本');
  });

  autoUpdater.on('download-progress', (progress) => {
    const pct = Math.round(progress.percent);
    if (mainWindow) {
      mainWindow.webContents.send('update:progress', pct);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('更新已下载:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update:downloaded', info);
    }
    // 自动安装
    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 30000);
  });

  autoUpdater.on('error', (err) => {
    log.error('更新错误:', err.message);
  });
}

// ── 系统托盘 ──────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '../assets/icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip('v信');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开 v信',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: '开机启动',
      type: 'checkbox',
      checked: store.get('autoLaunch'),
      click: (item) => {
        store.set('autoLaunch', item.checked);
        app.setLoginItemSettings({ openAtLogin: item.checked });
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── 拖拽文件 / 粘贴图片 ──────────────────────────────────
function setupDragAndDrop() {
  // 文件拖拽由渲染进程通过 IPC 处理
  // 主进程提供文件路径
  mainWindow.webContents.on('will-navigate', (e, url) => {
    // 阻止导航到外部 URL
    e.preventDefault();
  });
}

// ── IPC 处理器 ────────────────────────────────────────────
function setupIPC() {
  // 窗口操作
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());

  // 原生通知
  ipcMain.handle('notification:show', (_, { title, body, tag, icon }) => {
    if (!store.get('notifications')) return;
    try {
      const notif = new Notification({
        title,
        body,
        tag,
        icon: icon ? nativeImage.createFromDataURL(icon) : undefined,
      });
      notif.on('click', () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      });
      notif.show();
    } catch (e) {
      log.warn('通知失败:', e.message);
    }
  });

  // 选择文件（上传图片/文件）
  ipcMain.handle('dialog:selectFile', async (_, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: options?.filters || [
        { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    return result.canceled ? [] : result.filePaths;
  });

  // 截图：使用全局快捷键截图
  ipcMain.handle('screenshot:capture', async () => {
    // 隐藏窗口 → 截图 → 恢复
    mainWindow?.minimize();
    return new Promise((resolve) => {
      // 延迟等待窗口隐藏
      setTimeout(async () => {
        try {
          const { createCapturer } = require('./screenshot');
          const imgPath = await createCapturer();
          resolve(imgPath);
        } catch (e) {
          log.error('截图失败:', e);
          resolve(null);
        } finally {
          mainWindow?.show();
          mainWindow?.focus();
        }
      }, 300);
    });
  });

  // 获取文件内容（base64）
  ipcMain.handle('file:readAsBase64', async (_, filePath) => {
    try {
      const fs = require('fs');
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
      };
      const mime = mimeMap[ext] || 'application/octet-stream';
      return `data:${mime};base64,${data.toString('base64')}`;
    } catch (e) {
      log.error('读取文件失败:', filePath, e.message);
      return null;
    }
  });

  // 服务器配置
  ipcMain.handle('config:setServerUrl', (_, url) => {
    store.set('serverUrl', url);
  });
  ipcMain.handle('config:getServerUrl', () => store.get('serverUrl'));

  // 系统信息
  ipcMain.handle('system:getPlatform', () => process.platform);
}

// ── 全局快捷键（截图） ──────────────────────────────────
function setupShortcuts() {
  // Ctrl+Alt+A 截图（类微信）
  globalShortcut.register('CommandOrControl+Alt+A', async () => {
    if (!mainWindow) return;
    const result = await mainWindow.webContents.executeJavaScript(
      'window.__vxinScreenshot?.()'
    );
  });
}

// ── 应用生命周期 ──────────────────────────────────────────
app.whenReady().then(async () => {
  // 开机启动
  if (store.get('autoLaunch')) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  setupIPC();
  createWindow();
  createTray();
  setupAutoUpdater();
  setupShortcuts();

  // macOS
  app.on('activate', () => {
    if (mainWindow === null) createWindow();
    else mainWindow.show();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 托盘不退出
  }
});
