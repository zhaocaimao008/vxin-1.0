import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY  = 'wc_dark';
const DARK_CLASS   = 'dark-mode';
const SWITCH_CLASS = 'theme-switching';
const SWITCH_MS    = 320;

/* 读初始值：localStorage 优先，否则跟随操作系统 */
function readInitial() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === '1';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  } catch {
    return false;
  }
}

/* 给 <html> 短暂加上 theme-switching class，触发全局过渡 CSS */
function kickTransition() {
  const html = document.documentElement;
  html.classList.add(SWITCH_CLASS);
  setTimeout(() => html.classList.remove(SWITCH_CLASS), SWITCH_MS + 80);
}

export function useTheme() {
  const [dark, _set] = useState(readInitial);

  /* 同步 DOM class + 持久化 */
  useEffect(() => {
    document.body.classList.toggle(DARK_CLASS, dark);
    try { localStorage.setItem(STORAGE_KEY, dark ? '1' : '0'); } catch {}
  }, [dark]);

  /* 监听操作系统偏好（仅当用户未手动设置时才跟随） */
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const handler = (e) => {
      try {
        if (localStorage.getItem(STORAGE_KEY) === null) _set(e.matches);
      } catch {}
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setDarkMode = useCallback((value) => {
    kickTransition();
    _set(value);
  }, []);

  const toggle = useCallback(() => {
    kickTransition();
    _set(prev => !prev);
  }, []);

  return { darkMode: dark, setDarkMode, toggle };
}
