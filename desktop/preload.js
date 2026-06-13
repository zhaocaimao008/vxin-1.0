'use strict';
const { contextBridge, ipcRenderer } = require('electron');

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
