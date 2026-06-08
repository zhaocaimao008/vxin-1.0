import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';

axios.defaults.withCredentials = true;

// ── CSRF 防护：响应拦截器 ──────────────────────────────────────────
// 从任何 API 响应头中读取 X-CSRF-Token 并存入 localStorage
axios.interceptors.response.use(
  (res) => {
    const csrfHeader = res.headers['x-csrf-token'];
    if (csrfHeader) {
      localStorage.setItem('csrf_token', csrfHeader);
    }
    return res;
  },
  (err) => Promise.reject(err)
);

// ── CSRF 防护：请求拦截器 ──────────────────────────────────────────
// 对 POST/PUT/PATCH/DELETE 请求自动附加 X-CSRF-Token header
axios.interceptors.request.use(
  (config) => {
    if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
      const csrfToken = localStorage.getItem('csrf_token');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return config;
  },
  (err) => Promise.reject(err)
);

const AuthContext = createContext(null);
const ACCOUNTS_KEY = 'vxin_accounts_v1';
const ACTIVE_KEY = 'vxin_active_account_id_v1';
const MAX_ACCOUNTS = 15;

function readAccounts() {
  try {
    const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
    return Array.isArray(accounts) ? accounts.filter(a => a?.id && a?.token && a?.user) : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.slice(0, MAX_ACCOUNTS)));
}

function upsertAccount(token, user) {
  const next = [
    { id: user.id, token, user, lastLoginAt: Date.now() },
    ...readAccounts().filter(a => a.id !== user.id),
  ].slice(0, MAX_ACCOUNTS);
  writeAccounts(next);
  return next;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [accounts, setAccounts] = useState(() => readAccounts());
  const [loading, setLoading] = useState(true);
  const userRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);

  const setActiveAccount = (account) => {
    if (!account) {
      sessionStorage.removeItem(ACTIVE_KEY);
      delete axios.defaults.headers.common.Authorization;
      setToken(null);
      setUser(null);
      return;
    }
    sessionStorage.setItem(ACTIVE_KEY, account.id);
    axios.defaults.headers.common.Authorization = `Bearer ${account.token}`;
    setToken(account.token);
    setUser(account.user);
  };

  useEffect(() => {
    const id = axios.interceptors.response.use(
      res => res,
      err => {
        if (err.response?.status === 401 && userRef.current) {
          setActiveAccount(null);
          window.location.replace('/');
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  useEffect(() => {
    const stored = readAccounts();
    setAccounts(stored);
    const activeId = sessionStorage.getItem(ACTIVE_KEY);
    const active = stored.find(a => a.id === activeId) || stored[0];

    if (active) {
      setActiveAccount(active);
      axios.get('/api/auth/me')
        .then(r => {
          const updated = { ...active, user: r.data, lastLoginAt: Date.now() };
          const next = [updated, ...stored.filter(a => a.id !== updated.id)].slice(0, MAX_ACCOUNTS);
          writeAccounts(next);
          setAccounts(next);
          setUser(r.data);
        })
        .catch(() => setActiveAccount(null))
        .finally(() => setLoading(false));
      return;
    }

    axios.get('/api/auth/me')
      .then(r => setUser(r.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = (token, userData) => {
    if (!token) {
      setUser(userData);
      return;
    }
    const next = upsertAccount(token, userData);
    setAccounts(next);
    setActiveAccount(next.find(a => a.id === userData.id));
  };

  const switchAccount = (accountId) => {
    const account = readAccounts().find(a => a.id === accountId);
    if (!account) return false;
    setActiveAccount(account);
    return true;
  };

  const removeAccount = (accountId) => {
    const next = readAccounts().filter(a => a.id !== accountId);
    writeAccounts(next);
    setAccounts(next);
    if (userRef.current?.id === accountId) setActiveAccount(next[0] || null);
  };

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
    if (userRef.current?.id) removeAccount(userRef.current.id);
    else setActiveAccount(null);
  };

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
      token,
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
