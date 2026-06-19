'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// ── 同步注入配置 ──────────────────────────────────────────────
// renderer 通过 window.__ELECTRON_CONFIG__ 判断 Electron 环境
const config = {
  isElectron: true,
  serverUrl: 'https://dipsin.com',
  appVersion: '2.0.0',
};

contextBridge.exposeInMainWorld('__ELECTRON_CONFIG__', config);

// ── 安全的 API 桥接 ──────────────────────────────────────────
contextBridge.exposeInMainWorld('electron', {
  // 窗口操作
  minimize:       () => ipcRenderer.invoke('window:minimize'),
  maximize:       () => ipcRenderer.invoke('window:maximize'),
  closeWindow:    () => ipcRenderer.invoke('window:close'),
  isMaximized:    () => ipcRenderer.invoke('window:isMaximized'),

  // 通知
  showNotification: (opts) => ipcRenderer.invoke('notification:show', opts),

  // 文件操作
  selectFile:     (opts) => ipcRenderer.invoke('dialog:selectFile', opts),
  readFileAsBase64: (path) => ipcRenderer.invoke('file:readAsBase64', path),

  // 截图
  screenshot:     () => ipcRenderer.invoke('screenshot:capture'),

  // 服务器配置
  setServerUrl:   (url) => ipcRenderer.invoke('config:setServerUrl', url),
  getServerUrl:   ()    => ipcRenderer.invoke('config:getServerUrl'),

  // 系统信息
  getPlatform:    ()    => ipcRenderer.invoke('system:getPlatform'),
});

// ── 事件监听（渲染进程订阅主进程事件） ──────────────────────────
// 更新事件
ipcRenderer.on('update:available', (_, info) => {
  window.dispatchEvent(new CustomEvent('electron:update-available', { detail: info }));
});
ipcRenderer.on('update:progress', (_, pct) => {
  window.dispatchEvent(new CustomEvent('electron:update-progress', { detail: pct }));
});
ipcRenderer.on('update:downloaded', (_, info) => {
  window.dispatchEvent(new CustomEvent('electron:update-downloaded', { detail: info }));
});
