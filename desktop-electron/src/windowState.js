'use strict';
/**
 * 窗口状态持久化（位置 + 尺寸 + 最大化状态）
 * 解决：每次启动都回到默认位置/尺寸，用户体验差。
 * 方案：使用 electron-store 持久化，多屏时校验边界避免窗口飘出屏幕。
 */

const { screen } = require('electron');
const Store = require('electron-store');

const store = new Store({ name: 'window-state' });
const KEY = 'main';

const DEFAULTS = {
  width: 1100,
  height: 720,
  x: undefined,
  y: undefined,
  isMaximized: false,
};

/**
 * 读取上次窗口状态（校验是否在当前屏幕范围内）
 */
function load() {
  const saved = store.get(KEY, DEFAULTS);
  // 校验位置：检查是否在某个显示器内（多屏场景）
  if (saved.x !== undefined && saved.y !== undefined) {
    const displays = screen.getAllDisplays();
    const visible = displays.some(d => {
      const { x, y, width, height } = d.workArea;
      return saved.x >= x && saved.y >= y &&
             saved.x + (saved.width || DEFAULTS.width) <= x + width &&
             saved.y + (saved.height || DEFAULTS.height) <= y + height;
    });
    if (!visible) {
      // 窗口飘出所有屏幕（如拔掉外接显示器），重置位置
      return { ...DEFAULTS, width: saved.width, height: saved.height };
    }
  }
  return { ...DEFAULTS, ...saved };
}

/**
 * 创建状态追踪器，附加到 BrowserWindow
 */
function track(win) {
  let saveTimer = null;

  function saveState() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (win.isDestroyed()) return;
      const state = {
        isMaximized: win.isMaximized(),
        ...(!win.isMaximized() ? getBounds(win) : {}),
      };
      store.set(KEY, { ...(store.get(KEY, DEFAULTS)), ...state });
    }, 500);   // 防抖 500ms，避免拖动时频繁写盘
  }

  win.on('resize',    saveState);
  win.on('move',      saveState);
  win.on('maximize',  saveState);
  win.on('unmaximize',saveState);
  win.on('close',     saveState);
}

function getBounds(win) {
  const { x, y, width, height } = win.getBounds();
  return { x, y, width, height };
}

module.exports = { load, track };
