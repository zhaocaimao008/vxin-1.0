'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** Current OS platform string */
  platform: process.platform,

  /**
   * Send a native OS notification (shown only when window is hidden/minimized).
   * @param {{ title?: string, body?: string, badge?: number }} opts
   */
  notify(opts = {}) {
    ipcRenderer.send('notify', opts);
  },

  /**
   * Update the app badge count (dock on macOS/Linux, tray tooltip on Windows).
   * @param {number} count
   */
  setBadge(count) {
    ipcRenderer.send('badge', count);
  },

  /**
   * Listen for incoming notification data forwarded from main process.
   * (Reserved for future use — main → renderer push.)
   * @param {(data: any) => void} callback
   */
  onNotification(callback) {
    ipcRenderer.on('notification', (_, data) => callback(data));
  },
});
