// perf-monitor 仅开发环境加载（生产构建中 Vite 的 tree-shaking 会因 import.meta.env.DEV 移除）
if (import.meta.env.DEV) { import('./perf-monitor.js'); }
import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import * as Sentry from '@sentry/react';
import App from './App';
import './design-tokens.css';
import './index.css';
import './mobile-adapt.css';
import './ui-refresh.css';
import { loadRemoteConfig, getConfig } from './utils/config';
import { initWebVitals } from './utils/webVitals';
import { initImageOptimizer } from './utils/imageOptimizer';
import { setupAxiosInterceptors } from './utils/axiosInterceptor';
import { registerSW } from './utils/serviceWorker';
import { networkMonitor } from './utils/networkMonitor';

// ── Sentry 错误监控初始化 ─────────────────────────────────
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: `vxin@${__APP_VERSION__}`,
    integrations: [
      new Sentry.BrowserTracing({
        tracePropagationTargets: ['localhost', /^https:\/\/www\.vxinchat\.com/],
      }),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1, // 10% 性能监控采样
    replaysSessionSampleRate: 0.1, // 10% 正常会话录制
    replaysOnErrorSampleRate: 1.0, // 100% 错误会话录制
    beforeSend(event, _hint) {
      // 过滤敏感信息
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      if (event.request?.headers?.Authorization) {
        event.request.headers.Authorization = '[Filtered]';
      }
      // 过滤用户数据中的手机号
      if (event.user?.phone) {
        event.user.phone = event.user.phone.slice(0, 3) + '****' + event.user.phone.slice(-4);
      }
      return event;
    },
  });
}

// ── 通用加载流程 ──────────────────────────────────────────
// 1. 加载远程配置（所有平台统一入口）
// 2. 设置 Axios baseURL
// 3. 启动 React

(async function boot() {
  // 平台判断
  const isElectron = !!window.__ELECTRON_CONFIG__;
  const isMobile   = !!(window.Capacitor && window.Capacitor.isNativePlatform());

  // 1. 加载远程配置
  await loadRemoteConfig();
  const cfg = getConfig();

  // 2. 设置 Axios baseURL
  //    优先级：运行时手动切换的 URL > 远程配置 > Vite 环境变量
  const manualUrl = localStorage.getItem('vxin_server_url');
  const apiBase = manualUrl || cfg.api || import.meta.env.VITE_API_BASE || '';

  if (apiBase) {
    axios.defaults.baseURL = apiBase;
  }
  // 跨域请求必须携带 Cookie，全局开启
  axios.defaults.withCredentials = true;

  // 设置 Axios 拦截器（CSRF、token 刷新、错误重试）
  setupAxiosInterceptors(axios);

  // 3. Electron / 移动端恢复 Bearer token（localStorage 持久化）
  if (isElectron || isMobile) {
    const stored = localStorage.getItem('vxin_electron_token');
    if (stored) axios.defaults.headers.common['Authorization'] = `Bearer ${stored}`;
  }

  // 4. 平台初始化
  if (isElectron) {
    import('./utils/electron').then(mod => mod.initElectronFeatures()).catch(() => {});
  }

  // 5. 性能监控初始化（非阻塞）
  if (!isElectron && !isMobile) {
    initWebVitals();
    initImageOptimizer();
  }

  // 6. 网络质量监控（全端）
  networkMonitor.on('offline', () => {
    window.dispatchEvent(new CustomEvent('vxin:network_offline'));
  });
  networkMonitor.on('online', () => {
    window.dispatchEvent(new CustomEvent('vxin:network_online'));
  });

  // 7. Service Worker 注册（Web 端，PWA 离线支持）
  if (!isElectron && !isMobile) {
    registerSW({
      onUpdate: (reg) => {
        // 有新版本：通过自定义事件通知 UpdateBanner 组件
        window.dispatchEvent(new CustomEvent('vxin:sw_update', { detail: { reg } }));
      },
      onSuccess: () => {
        console.log('[SW] 离线缓存已就绪');
      },
    });
  }

  // 8. 渲染 React
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
