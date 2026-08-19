import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { clearCache } from '../utils/msgCache';

// 所有请求自动携带 httpOnly Cookie（同源时浏览器自动附加，跨域需此选项）
axios.defaults.withCredentials = true;

// ── CSRF 防护拦截器（模块级单次注册，避免热重载/re-import 累积注册）────
// Bug修复：原来在模块顶层注册，开发热重载时每次都叠加新拦截器，
// 导致同一响应被多次处理（CSRF token 重复写入/覆盖，性能下降）。
// 解决：用标志位 + eject 保证全局只注册一次。
const _interceptors = { req: -1, res: -1 };
function _setupInterceptors() {
  if (_interceptors.res >= 0) {
    axios.interceptors.response.eject(_interceptors.res);
    axios.interceptors.request.eject(_interceptors.req);
  }
  // 响应拦截器：读取 CSRF token
  _interceptors.res = axios.interceptors.response.use(
    (res) => {
      const csrfHeader = res.headers['x-csrf-token'];
      if (csrfHeader) {
        sessionStorage.setItem('csrf_token', csrfHeader);
        localStorage.setItem('csrf_token_cache', csrfHeader);
      }
      return res;
    },
    (err) => Promise.reject(err)
  );
  // 请求拦截器：注入 CSRF token
  _interceptors.req = axios.interceptors.request.use(
    (config) => {
      if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
        const csrfToken = sessionStorage.getItem('csrf_token') || localStorage.getItem('csrf_token_cache');
        if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
      }
      return config;
    },
    (err) => Promise.reject(err)
  );
}
_setupInterceptors(); // 模块加载时注册一次

const AuthContext = createContext(null);

// Electron 模式下 Cookie 跨域无法自动携带，用 sessionStorage 存 token，
// 设到 axios Authorization header 实现 Bearer 鉴权
const ELECTRON_TOKEN_KEY = 'vxin_electron_token';
// Electron(file://)与移动端(Capacitor 跨域 https://localhost)均无法可靠使用 Cookie，
// 统一改用 Bearer token；用 localStorage 持久化，App 重启后免重新登录。
const isBearerClient = () => !!(window.__ELECTRON_CONFIG__ || window.Capacitor?.isNativePlatform?.());

// 清除 CSRF token 缓存（会话结束/切换账号或服务器时调用）：
// session 与 localStorage 兜底缓存必须一起清，否则旧会话的 token 会残留在
// localStorage，被下一个会话的首个 POST 取用（请求拦截器会 fallback 到它）导致 403。
function clearCsrfCache() {
  sessionStorage.removeItem('csrf_token');
  localStorage.removeItem('csrf_token_cache');
}

function setElectronToken(token) {
  if (!isBearerClient()) return;
  if (token) {
    localStorage.setItem(ELECTRON_TOKEN_KEY, token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem(ELECTRON_TOKEN_KEY);
    delete axios.defaults.headers.common['Authorization'];
  }
}

// ── 多账号"最近登录"记录 ──────────────────────────────────────────
// 只存 { id, user, lastLoginAt }，不存 token。
// token 始终只在后端签发的 httpOnly Cookie 中，JS 无法读取。
// 切换账号需重新登录（无静默换 Cookie 能力），这是正确的安全边界。
const ACCOUNTS_KEY = 'vxin_accounts_v2';   // v2 = 无 token 版本
const MAX_ACCOUNTS = 15;

function readAccounts() {
  try {
    const raw = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(a => a?.id && a?.user) : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.slice(0, MAX_ACCOUNTS)));
}

function upsertAccount(user) {
  const next = [
    { id: user.id, user, lastLoginAt: Date.now() },
    ...readAccounts().filter(a => a.id !== user.id),
  ].slice(0, MAX_ACCOUNTS);
  writeAccounts(next);
  return next;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser]         = useState(null);
  const [accounts, setAccounts] = useState(() => readAccounts());
  const [loading, setLoading]   = useState(true);
  const userRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);

  // 会话失效统一清理：401 兜底踢出 / 被踢下线(SocketContext force_logout) /
  // refresh 失败(axiosInterceptor vxin:session_expired) 三处共用，避免各写一套、遗漏清理项。
  const forceLogout = useCallback(() => {
    setUser(null);
    setElectronToken(null);
    if (window.__ELECTRON_CONFIG__) window.location.hash = '#/login';
    else window.location.replace('/app/login');
  }, []);

  // ── 401 自动踢出 ───────────────────────────────────────────────
  useEffect(() => {
    const id = axios.interceptors.response.use(
      res => res,
      err => {
        if (err.response?.status === 401 && userRef.current) forceLogout();
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, [forceLogout]);

  // ── 被踢下线 / token 静默刷新失败 → 立即登出（而非静默挂起） ────
  // 事件来源：web/src/utils/axiosInterceptor.js 的 refresh 失败分支、
  // web/src/contexts/SocketContext.jsx 的 socket 'force_logout' 监听。
  useEffect(() => {
    const onSessionExpired = () => { if (userRef.current) forceLogout(); };
    window.addEventListener('vxin:session_expired', onSessionExpired);
    return () => window.removeEventListener('vxin:session_expired', onSessionExpired);
  }, [forceLogout]);

  // ── 初始化：恢复 Electron Bearer token，然后验证身份 ────────
  useEffect(() => {
    if (isBearerClient()) {
      const stored = localStorage.getItem(ELECTRON_TOKEN_KEY);
      if (stored) axios.defaults.headers.common['Authorization'] = `Bearer ${stored}`;
    }
    // timeout: 8s — 防止 Electron/弱网下请求挂起导致 loading:true 永不结束（白屏卡死）
    axios.get('/api/auth/me', { timeout: 8000 })
      .then(r => {
        setUser(r.data);
        // 刷新"最近登录"记录中的用户信息（头像/昵称可能已更新）
        const next = readAccounts().map(a => a.id === r.data.id ? { ...a, user: r.data, lastLoginAt: Date.now() } : a);
        writeAccounts(next);
        setAccounts(next);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // ── 登录成功回调（由 Login/Register 页面调用） ─────────────────
  const login = (userData, token) => {
    setElectronToken(token || null);
    setUser(userData);
    const next = upsertAccount(userData);
    setAccounts(next);
  };

  // ── 免密切换账号 ──────────────────────────────────────────────
  // 后端凭 httpOnly 的 wallet cookie 校验"本设备登录过该账号"，重签发 token。
  // 成功即换上新账号的 Cookie，reload 重建 socket / 拉取数据。
  // 失败（如 wallet 过期、该账号未在本设备登录过）抛错，调用方回退到密码登录。
  const switchAccount = async (accountId) => {
    const { data } = await axios.post('/api/auth/switch', { userId: accountId });
    const next = upsertAccount(data.user);
    setAccounts(next);
    setUser(data.user);
    clearCsrfCache();
    window.location.reload();
  };

  // ── 移除"最近登录"记录 + 从本设备钱包删除（删除账号，不再可免密切换） ────
  const removeAccount = (accountId) => {
    const next = readAccounts().filter(a => a.id !== accountId);
    writeAccounts(next);
    setAccounts(next);
    // 后端清掉本设备对该账号的免密切换凭证（best-effort）
    axios.post('/api/auth/forget', { userId: accountId }).catch(() => {});
  };

  // ── 登出 ──────────────────────────────────────────────────────
  const logout = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration('/');
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) {
          await axios.delete('/api/notifications/web-subscribe', { data: { endpoint: sub.endpoint } });
          await sub.unsubscribe();
        }
      }
    } catch { /* best-effort push cleanup; ignore */ }
    await axios.post('/api/auth/logout').catch(() => {});
    if (userRef.current?.id) removeAccount(userRef.current.id);
    clearCsrfCache();
    clearCache();   // 隐私红线：登出清空离线消息缓存
    setElectronToken(null);
    setUser(null);
  };

  // ── 切换服务器（无需重装客户端） ─────────────────────────────
  // 1. 保存新 URL 到 localStorage（Electron 运行时）和 electron-store（下次启动）
  // 2. 更新 axios baseURL
  // 3. 清除当前登录态 → PrivateRoute 自动跳转登录页 → 用户用新服务器账号重新登录
  const changeServer = async (newUrl) => {
    const clean = newUrl.trim().replace(/\/$/, '');
    try { await axios.post('/api/auth/logout'); } catch { /* logout is best-effort on server switch */ }
    if (window.__ELECTRON_CONFIG__) {
      localStorage.setItem('vxin_server_url', clean);
      window.electronAPI?.setServerUrl?.(clean);
    }
    axios.defaults.baseURL = clean;
    setElectronToken(null);
    clearCsrfCache();
    clearCache();   // 切换服务器=换账号域，清离线消息缓存避免串号
    setUser(null);
    setAccounts([]);
  };

  // ── 更新本地用户缓存（头像/昵称变更后调用） ─────────────────
  const updateUser = (data) => {
    setUser(prev => {
      const updated = { ...prev, ...data };
      const next = readAccounts().map(a => a.id === updated.id ? { ...a, user: updated } : a);
      writeAccounts(next);
      // 在 updater 外部异步同步 accounts，避免在 updater 函数里调 setState
      setTimeout(() => setAccounts(next), 0);
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      updateUser,
      changeServer,
      loading,
      accounts,
      switchAccount,
      removeAccount,
      maxAccounts: MAX_ACCOUNTS,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
