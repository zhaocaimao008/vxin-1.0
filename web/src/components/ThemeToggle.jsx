import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import './ThemeToggle.css';

/* ── 太阳图标（亮色模式时显示） ── */
function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24" width="18" height="18" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="5"/>
      {/* 8 条射线 */}
      <line x1="12" y1="1"     x2="12" y2="3"/>
      <line x1="12" y1="21"    x2="12" y2="23"/>
      <line x1="1"  y1="12"    x2="3"  y2="12"/>
      <line x1="21" y1="12"    x2="23" y2="12"/>
      <line x1="4.22"  y1="4.22"  x2="5.64"  y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36"/>
      <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
    </svg>
  );
}

/* ── 月亮图标（暗黑模式时显示） ── */
function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24" width="18" height="18" fill="none"
      stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

/* ── 主组件 ── */
export default function ThemeToggle() {
  const { darkMode, setDarkMode } = useSettings();

  return (
    <button
      className="tt-btn"
      onClick={() => setDarkMode(!darkMode)}
      aria-label={darkMode ? '切换到亮色模式' : '切换到暗黑模式'}
      title={darkMode ? '亮色模式' : '暗黑模式'}
    >
      {/* key 变化触发重新挂载，进场动画自动播放 */}
      <span key={darkMode ? 'moon' : 'sun'} className="tt-icon">
        {darkMode ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}
