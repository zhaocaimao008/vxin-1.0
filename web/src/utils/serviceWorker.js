/**
 * Service Worker 注册管理器
 * 功能：
 *   1. 注册/更新 SW
 *   2. 监听更新，提示用户刷新（UpdateBanner）
 *   3. 离线状态检测 + 自动同步 outbox
 *   4. Background Sync 注册（离线发消息补偿）
 */

let swRegistration = null;
let _updateAvailableCallback = null;

/**
 * 注册 Service Worker
 * @param {Object} options
 * @param {Function} options.onUpdate - 有新版本时的回调（传入 registration）
 * @param {Function} options.onSuccess - 首次安装成功回调
 * @param {Function} options.onOffline - 网络断开回调
 */
export async function registerSW({ onUpdate, onSuccess, onOffline } = {}) {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  // 开发模式不注册（避免缓存干扰热更新）
  if (import.meta.env.DEV) return;

  _updateAvailableCallback = onUpdate;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',   // 强制每次检查更新
    });
    swRegistration = registration;

    // 首次安装成功
    if (registration.installing) {
      registration.installing.addEventListener('statechange', (e) => {
        if (e.target.state === 'activated') onSuccess?.();
      });
    }

    // 检测新版本（用户刷新后生效）
    registration.addEventListener('updatefound', () => {
      const newSW = registration.installing;
      if (!newSW) return;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          // 新版本 SW 已就绪，提示用户刷新
          onUpdate?.(registration);
        }
      });
    });

    // 每 30 分钟检查更新
    setInterval(() => registration.update(), 30 * 60 * 1000);

    // 监听 SW 消息（导航、outbox 同步）
    navigator.serviceWorker.addEventListener('message', handleSWMessage);

    // 网络状态监听
    window.addEventListener('online',  () => handleOnline());
    window.addEventListener('offline', () => onOffline?.());

    return registration;
  } catch (err) {
    console.warn('[SW] 注册失败（不影响功能）:', err.message);
  }
}

/** 用户确认后，激活新版 SW 并刷新页面 */
export function applyUpdate() {
  if (!swRegistration?.waiting) return;
  swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  window.location.reload();
}

/** 注册 Background Sync（离线时自动补发 outbox）*/
export async function registerOutboxSync() {
  if (!swRegistration) return;
  try {
    await swRegistration.sync.register('vxin-outbox-sync');
  } catch {
    // sync API 不支持时静默（Firefox 不支持）
  }
}

/** 请求推送通知权限 */
export async function requestPushPermission(vapidPublicKey) {
  if (!swRegistration || !('PushManager' in window)) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    const sub = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    return sub;
  } catch (err) {
    console.warn('[SW] 推送订阅失败:', err.message);
    return null;
  }
}

// ── 内部 ──────────────────────────────────────────────────────

function handleSWMessage(event) {
  const { type, url, conversationId: _conversationId } = event.data || {};
  if (type === 'navigate' && url) {
    window.location.href = url;
  }
  if (type === 'sync_outbox') {
    // 触发 outbox 重试（由 ChatWindow 中的 outbox 模块处理）
    window.dispatchEvent(new CustomEvent('vxin:sync_outbox'));
  }
}

function handleOnline() {
  // 恢复网络后注册一次 sync，补发离线期间积压消息
  registerOutboxSync();
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}
