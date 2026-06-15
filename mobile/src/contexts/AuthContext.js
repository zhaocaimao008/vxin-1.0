import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { loadServerUrl, saveServerUrl, getServerUrl } from '../config';

// baseURL is set after loadServerUrl() resolves in useEffect

const AuthContext = createContext(null);
const ACCOUNTS_KEY = 'vxin_accounts_v1';
const ACTIVE_KEY = 'vxin_active_account_id_v1';
const MAX_ACCOUNTS = 15;

async function readAccounts() {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    const accounts = JSON.parse(raw || '[]');
    return Array.isArray(accounts) ? accounts.filter(a => a?.id && a?.token && a?.user) : [];
  } catch {
    return [];
  }
}

async function writeAccounts(accounts) {
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.slice(0, MAX_ACCOUNTS)));
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const setActiveAccount = async (account) => {
    if (!account) {
      setToken(null);
      setUser(null);
      await AsyncStorage.removeItem(ACTIVE_KEY);
      delete axios.defaults.headers.common.Authorization;
      return;
    }
    setToken(account.token);
    setUser(account.user);
    await AsyncStorage.setItem(ACTIVE_KEY, account.id);
    axios.defaults.headers.common.Authorization = `Bearer ${account.token}`;
  };

  useEffect(() => {
    (async () => {
      const serverUrl = await loadServerUrl();
      axios.defaults.baseURL = serverUrl;
      const stored = await readAccounts();
      setAccounts(stored);
      const activeId = await AsyncStorage.getItem(ACTIVE_KEY);
      const active = stored.find(a => a.id === activeId) || stored[0];
      if (active) {
        await setActiveAccount(active);
        try {
          const { data } = await axios.get('/api/auth/me');
          const updated = { ...active, user: data, lastLoginAt: Date.now() };
          const next = [updated, ...stored.filter(a => a.id !== updated.id)].slice(0, MAX_ACCOUNTS);
          await writeAccounts(next);
          setAccounts(next);
          setUser(data);
        } catch {
          await setActiveAccount(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (tokenVal, userData) => {
    const next = [
      { id: userData.id, token: tokenVal, user: userData, lastLoginAt: Date.now() },
      ...(await readAccounts()).filter(a => a.id !== userData.id),
    ].slice(0, MAX_ACCOUNTS);
    await writeAccounts(next);
    setAccounts(next);
    await setActiveAccount(next.find(a => a.id === userData.id));
  };

  const switchAccount = async (accountId) => {
    const account = (await readAccounts()).find(a => a.id === accountId);
    if (!account) return false;
    await setActiveAccount(account);
    return true;
  };

  const removeAccount = async (accountId) => {
    const next = (await readAccounts()).filter(a => a.id !== accountId);
    await writeAccounts(next);
    setAccounts(next);
    if (user?.id === accountId) await setActiveAccount(next[0] || null);
  };

  const logout = async () => {
    if (user?.id) await removeAccount(user.id);
    else await setActiveAccount(null);
  };

  const changeServer = async (newUrl) => {
    const clean = newUrl.trim().replace(/\/$/, '');
    try { await axios.post('/api/auth/logout'); } catch {}
    await saveServerUrl(clean);
    axios.defaults.baseURL = clean;
    await setActiveAccount(null);
    await AsyncStorage.removeItem(ACTIVE_KEY);
    setAccounts([]);
  };

  const updateUser = async (data) => {
    const updated = { ...user, ...data };
    setUser(updated);
    const next = (await readAccounts()).map(a => a.id === updated.id ? { ...a, user: updated } : a);
    await writeAccounts(next);
    setAccounts(next);
  };

  return (
    <AuthContext.Provider value={{ user, token, accounts, maxAccounts: MAX_ACCOUNTS, login, logout, switchAccount, removeAccount, updateUser, changeServer, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
