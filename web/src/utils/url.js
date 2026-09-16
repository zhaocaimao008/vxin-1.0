// 把后端返回的相对资源路径（如 /uploads/avatars/x.jpg、/api/...）解析成可用的绝对地址。
//
// Web 端：跟随配置中的 API 地址；未配置时保留同源相对路径。
// Electron 桌面端：页面跑在 file:// 下，<img src="/uploads/x.jpg"> 会解析成
//   file:///uploads/x.jpg（不存在）。必须补上服务器地址。
//   注意：axios.defaults.baseURL 只对 axios/fetch 生效，对 <img> 标签无效，
//   所以这里必须显式拼接。
//
// 地址优先级：
//   1. 运行时手动切换（localStorage vxin_server_url）
//   2. 远程配置（Config.api/socket）
//   3. 空值 → Web 同源，相对路径可用
import { getConfig, isConfigLoaded } from './config';

// ── 已确认废弃的 v信官方旧服务器地址（与 Android/iOS DEPRECATED_SERVERS 一致）──
// 仅自动清除白名单内的废弃官方地址；用户自己配置的其他自定义服务器一律保留。
const DEPRECATED_SERVERS = new Set(['45.77.131.33', '104.244.95.70']);

export function isDeprecatedServerUrl(url) {
  if (!url) return false;
  try { return DEPRECATED_SERVERS.has(new URL(url).hostname); } catch { return false; }
}

// 清除 localStorage 中废弃的官方旧服务器地址，返回是否发生了清除。
export function clearDeprecatedServerUrl() {
  const manualUrl = localStorage.getItem('vxin_server_url');
  if (manualUrl && isDeprecatedServerUrl(manualUrl)) {
    localStorage.removeItem('vxin_server_url');
    return true;
  }
  return false;
}

function getBaseUrl() {
  // 自动清除废弃官方地址（45.77.131.33 / 104.244.95.70），与 Android/iOS 清理行为一致
  clearDeprecatedServerUrl();
  const manualUrl = localStorage.getItem('vxin_server_url');
  if (manualUrl) return manualUrl;

  // config 可能还未加载（页面渲染时资源先于配置加载）
  if (isConfigLoaded()) {
    const cfg = getConfig();
    if (cfg.api) return cfg.api;
    if (cfg.socket) return cfg.socket;
  }

  return '';
}

function bearerToken() {
  try { return localStorage.getItem('vxin_electron_token') || ''; } catch { return ''; }
}

export function mediaUrl(u) {
  if (!u) return u;
  if (/^(data:|blob:)/i.test(u)) return u;

  const isElectron = !!window.__ELECTRON_CONFIG__;
  const isNative   = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const base = getBaseUrl().replace(/\/$/, '');
  if (!base) return u;
  try {
    const backend = new URL(base);
    const absolute = /^(https?:)?\/\//i.test(u);
    const resource = new URL(absolute ? u : `${base}/${u.replace(/^\//, '')}`, backend);
    if (!['http:', 'https:'].includes(resource.protocol) || resource.username || resource.password) return '';
    const uploadsPath = backend.pathname.replace(/\/$/, '') + '/uploads/';
    // Never send this session's token to another origin, including protocol-relative URLs.
    if ((isElectron || isNative) && resource.origin === backend.origin && resource.pathname.startsWith(uploadsPath)) {
      const token = bearerToken();
      if (token) resource.searchParams.set('token', token);
    }
    return resource.href;
  } catch { return ''; }
}

// 跳转到登录页。Electron 跑在 file:// 下，不能用绝对路径 '/login'
// （会跳到 file:///login 白屏），必须用 HashRouter 的 hash 路由。
export function goLogin() {
  if (window.__ELECTRON_CONFIG__) window.location.hash = '#/login';
  // Web 部署在 /app/ 子路径：必须带 BASE_URL，否则退出登录后落到落地页 404
  else window.location.replace((import.meta.env.BASE_URL || '/') + 'login');
}
