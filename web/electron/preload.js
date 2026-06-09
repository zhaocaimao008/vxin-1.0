'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// 白名单事件：只允许转发这些频道，防止渲染层监听任意 IPC
const ALLOWED_EVENTS = ['maximize', 'unmaximize'];

contextBridge.exposeInMainWorld('vxinAPI', {

  /** 标记当前运行在 Electron 容器中，React 侧可用于条件判断 */
  isElectron: true,

  // ── 窗口控制（配合 frame:false 的自定义标题栏使用）─────────
  minimize:    () => ipcRenderer.send('window:minimize'),
  maximize:    () => ipcRenderer.send('window:maximize'),
  close:       () => ipcRenderer.send('window:close'),

  /** 查询当前最大化状态（组件 mount 时同步初始值）*/
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  /**
   * 监听窗口最大化 / 还原事件
   * 主进程在 maximize / unmaximize 时主动 send，此处转发给渲染层
   * @param {(isMaximized: boolean) => void} callback
   * @returns {() => void} 清理函数，组件卸载时调用
   */
  onMaximizeChange: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const onMax   = () => callback(true);
    const onUnmax = () => callback(false);
    ipcRenderer.on('maximize',   onMax);
    ipcRenderer.on('unmaximize', onUnmax);
    return () => {
      ipcRenderer.off('maximize',   onMax);
      ipcRenderer.off('unmaximize', onUnmax);
    };
  },

  // ── 系统原生通知 ────────────────────────────────────────────
  /** @param {{ title: string, body: string, icon?: string }} opts */
  notify: (opts) => ipcRenderer.invoke('notify:show', opts),

});
