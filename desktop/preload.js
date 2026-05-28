const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  onNotification: (callback) => ipcRenderer.on('notification', (_, data) => callback(data))
});
