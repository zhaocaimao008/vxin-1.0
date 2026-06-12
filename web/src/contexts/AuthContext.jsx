import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';

// 所有请求自动携带 httpOnly Cookie（同源时浏览器自动附加，跨域需此选项）
axios.defaults.withCredentials = true;

// ── CSRF 防护：响应拦截器 ──────────────────────────────────────────
// 从任何 API 响应头中读取 X-CSRF-Token 并存入 sessionStorage
// 注：使用 sessionStorage 而非 localStorage，标签页关闭即清除，
//     XSS 仍可读取（SameSite=Strict Cookie 是防 CSRF 的主力），
//     但至少不会跨会话持久化。
axios.interceptors.response.use(
  (res) => {
    const csrfHeader = res.headers['x-csrf-token'];
    if (csrfHeader) sessionStorage.setItem('csrf_token', csrfHeader);
    return res;
  },
  (err) => Promise.reject(err)
);

// ── CSRF 防护：请求拦截器 ──────────────────────────────────────────
axios.interceptors.request.use(
  (config) => {
    if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
      const csrfToken = sessionStorage.getItem('csrf_token');
      if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

const AuthContext = createContext(null);

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

  // ── 401 自动踢出 ───────────────────────────────────────────────
  useEffect(() => {
    const id = axios.interceptors.response.use(
      res => res,
      err => {
        if (err.response?.status === 401 && userRef.current) {
          setUser(null);
          window.location.replace('/login');
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  // ── 初始化：用 Cookie 向后端验证身份 ──────────────────────────
  // 不从 localStorage 读取 token，直接请求 /api/auth/me。
  // Cookie 由浏览器自动附带，后端验证后返回用户信息。
  useEffect(() => {
    axios.get('/api/auth/me')
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
  // 后端已将 JWT 写入 httpOnly Cookie，此处只记录用户信息用于 UI 展示。
  const login = (userData) => {
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
    window.location.reload();
  };

  // ── 移除"最近登录"记录（UI 操作，不影响当前 Cookie 会话） ────
  const removeAccount = (accountId) => {
    const next = readAccounts().filter(a => a.id !== accountId);
    writeAccounts(next);
    setAccounts(next);
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
    } catch {}
    await axios.post('/api/auth/logout').catch(() => {});
    // 清除当前用户的最近登录记录
    if (userRef.current?.id) removeAccount(userRef.current.id);
    sessionStorage.removeItem('csrf_token');
    setUser(null);
  };

  // ── 更新本地用户缓存（头像/昵称变更后调用） ─────────────────
  const updateUser = (data) => {
    setUser(prev => {
      const updated = { ...prev, ...data };
      const next = readAccounts().map(a => a.id === updated.id ? { ...a, user: updated } : a);
      writeAccounts(next);
      setAccounts(next);
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      updateUser,
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
