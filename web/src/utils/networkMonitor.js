/**
 * 网络质量监控器（多端通用，Web/Electron）
 * 功能：
 *   1. 实时检测网络类型（4G/WiFi/离线）
 *   2. RTT / 下行带宽估算
 *   3. 慢速网络时自动降级（停止预加载、降低图片质量）
 *   4. 连接变化事件广播
 */

export const NetworkType = {
  UNKNOWN: 'unknown',
  OFFLINE: 'offline',
  SLOW_2G: 'slow-2g',
  TWO_G: '2g',
  THREE_G: '3g',
  FOUR_G: '4g',
  WIFI: 'wifi',
};

class NetworkMonitor {
  constructor() {
    this._listeners = new Map();
    this._state = this._getCurrentState();
    this._setupObservers();
  }

  /** 当前网络状态快照 */
  get state() { return this._state; }

  /** 是否离线 */
  get isOffline() { return !navigator.onLine; }

  /** 是否慢速网络（2G / slow-2g） */
  get isSlow() {
    const { effectiveType } = this._state;
    return effectiveType === NetworkType.SLOW_2G || effectiveType === NetworkType.TWO_G;
  }

  /** 是否允许预加载（快速网络才预加载）*/
  get canPreload() {
    return !this.isOffline && !this.isSlow && this._state.saveData === false;
  }

  /** 订阅网络变化事件 */
  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event).delete(fn);
  }

  // ── 内部 ──────────────────────────────────────────────────

  _getCurrentState() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
      online: navigator.onLine,
      effectiveType: conn?.effectiveType || NetworkType.UNKNOWN,
      rtt: conn?.rtt || 0,
      downlink: conn?.downlink || 0,
      saveData: conn?.saveData || false,
      type: conn?.type || NetworkType.UNKNOWN,
    };
  }

  _emit(event, data) {
    this._listeners.get(event)?.forEach(fn => fn(data));
  }

  _update() {
    const prev = this._state;
    this._state = this._getCurrentState();
    if (prev.effectiveType !== this._state.effectiveType ||
        prev.online !== this._state.online) {
      this._emit('change', this._state);
      if (!this._state.online) this._emit('offline', this._state);
      if (this._state.online && !prev.online) this._emit('online', this._state);
    }
  }

  _setupObservers() {
    window.addEventListener('online',  () => this._update());
    window.addEventListener('offline', () => this._update());
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      conn.addEventListener('change', () => this._update());
    }
  }
}

// 单例
export const networkMonitor = new NetworkMonitor();

/**
 * 根据网络质量动态调整图片质量参数
 * @returns {string} quality - 'high'|'medium'|'low'
 */
export function getAdaptiveImageQuality() {
  if (networkMonitor.isOffline) return 'low';
  if (networkMonitor.isSlow) return 'low';
  const { downlink } = networkMonitor.state;
  if (downlink > 10) return 'high';
  if (downlink > 2) return 'medium';
  return 'low';
}

/**
 * 自适应预加载：慢网不预加载
 */
export function shouldPrefetch() {
  return networkMonitor.canPreload;
}
