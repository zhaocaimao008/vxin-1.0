const { app, BrowserWindow, Menu, Tray, nativeImage } = require('electron');
const path = require('path');

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: 'v信',
    backgroundColor: '#F5F5F5',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: path.join(__dirname, 'icon.png')
  });

  const isDev = !app.isPackaged;
  const SERVER_URL = process.env.VXIN_SERVER_URL || 'http://93.179.127.50:8086';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL(SERVER_URL);
  }

  mainWindow.on('close', (e) => {
    if (process.platform === 'darwin') {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 菜单
const menu = Menu.buildFromTemplate([
  { label: 'v信', submenu: [
    { label: '关于 v信', role: 'about' },
    { type: 'separator' },
    { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
  ]},
  { label: '编辑', submenu: [
    { role: 'undo', label: '撤销' },
    { role: 'redo', label: '重做' },
    { type: 'separator' },
    { role: 'cut', label: '剪切' },
    { role: 'copy', label: '复制' },
    { role: 'paste', label: '粘贴' },
    { role: 'selectAll', label: '全选' }
  ]},
  { label: '窗口', submenu: [
    { role: 'minimize', label: '最小化' },
    { role: 'zoom', label: '缩放' },
    { role: 'togglefullscreen', label: '全屏' },
    { type: 'separator' },
    { role: 'reload', label: '刷新' },
    { role: 'forceReload', label: '强制刷新' }
  ]}
]);
Menu.setApplicationMenu(menu);
