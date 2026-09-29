import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext({});

const FONT_SIZES = { small: 12, normal: 14, large: 16, xlarge: 18 };

const getSystemDark = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;

export function SettingsProvider({ children }) {
  // 主题三态：'light' | 'dark' | 'auto'（跟随系统）。迁移旧版布尔存储 wc_dark。
  const [themeMode, setThemeMode] = useState(() => {
    const t = localStorage.getItem('wc_theme');
    if (t === 'light' || t === 'dark' || t === 'auto') return t;
    const legacy = localStorage.getItem('wc_dark');
    if (legacy === '1') return 'dark';
    if (legacy === '0') return 'light';
    // 从未选择过：跟随系统（系统深色时不再强制亮屏）
    return 'auto';
  });
  const [systemDark, setSystemDark] = useState(getSystemDark);
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('wc_font') || 'normal');
  const [notifySound, setNotifySound] = useState(() => localStorage.getItem('wc_notify') !== '0');

  // 跟踪系统主题变化，切到「跟随系统」时立即生效
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = e => setSystemDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const darkMode = themeMode === 'auto' ? systemDark : themeMode === 'dark';
  // 向后兼容：仍暴露 setDarkMode(bool)，映射到 themeMode
  const setDarkMode = v => setThemeMode(v ? 'dark' : 'light');

  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('wc_theme', themeMode);
    localStorage.setItem('wc_dark', darkMode ? '1' : '0'); // 兼容旧版读取
  }, [darkMode, themeMode]);

  useEffect(() => {
    const size = FONT_SIZES[fontSize] || 14;
    document.documentElement.style.setProperty('--font-msg', size + 'px');
    document.documentElement.style.setProperty('--font-name', (size) + 'px');
    document.documentElement.style.setProperty('--font-preview', (size - 2) + 'px');
    localStorage.setItem('wc_font', fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('wc_notify', notifySound ? '1' : '0');
  }, [notifySound]);

  return (
    <SettingsContext.Provider value={{ darkMode, setDarkMode, themeMode, setThemeMode, fontSize, setFontSize, notifySound, setNotifySound }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
