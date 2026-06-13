'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// 从 main 进程通过 additionalArguments 同步传入的服务器地址
// React 在 module 顶层就能同步读取，不需要等待异步 IPC
const serverUrlArg = process.argv.find(a => a.startsWith('--server-url='));
const serverUrl = serverUrlArg ? serverUrlArg.slice('--server-url='.length) : 'https://dipsin.com';

contextBridge.exposeInMainWorld('__ELECTRON_CONFIG__', { serverUrl });

contextBridge.exposeInMainWorld('electron', {
  getServerUrl:     ()       => ipcRenderer.invoke('get-server-url'),
  setServerUrl:     (url)    => ipcRenderer.invoke('set-server-url', url),
  getTheme:         ()       => ipcRenderer.invoke('get-theme'),
  setTheme:         (theme)  => ipcRenderer.invoke('set-theme', theme),
  setBadge:         (count)  => ipcRenderer.invoke('set-badge', count),
  showNotification: (opts)   => ipcRenderer.invoke('show-notification', opts),
  openFileDialog:   (opts)   => ipcRenderer.invoke('open-file-dialog', opts),
  readFile:         (filePath) => ipcRenderer.invoke('read-file', filePath),
  minimize:         ()       => ipcRenderer.invoke('window-minimize'),
  maximize:         ()       => ipcRenderer.invoke('window-maximize'),
  closeWindow:      ()       => ipcRenderer.invoke('window-close'),
  quit:             ()       => ipcRenderer.invoke('window-quit'),
  getPlatform:      ()       => ipcRenderer.invoke('get-platform'),
});
