import React, { useState, useEffect } from 'react';

function WinBtn({ onClick, isClose, children, title }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={title}
      aria-label={title}
      style={{
        width: 46, height: 30, border: 'none', outline: 'none',
        background: hov ? (isClose ? 'var(--titlebar-close-hover)' : 'var(--titlebar-btn-hover-bg)') : 'transparent',
        color: hov ? 'var(--titlebar-fg-hover)' : 'var(--titlebar-fg)',
        cursor: 'pointer', fontSize: 'var(--text-base)', transition: 'background .1s, color .1s',
        WebkitAppRegion: 'no-drag',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: "calc(var(--z-native) + 1)",
      }}
    >{children}</button>
  );
}

export default function ElectronTitlebar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    document.documentElement.classList.add('electron-app');

    // 查询初始窗口状态（ipcRenderer.invoke → Promise）
    api.isMaximized?.().then(setIsMaximized).catch(() => {});

    // preload 将 IPC maximize/unmaximize 事件转为 CustomEvent
    const handler = (e) => setIsMaximized(e.detail);
    window.addEventListener('electron:maximized-change', handler);

    return () => {
      document.documentElement.classList.remove('electron-app');
      window.removeEventListener('electron:maximized-change', handler);
    };
  }, []);

  if (!window.__ELECTRON_CONFIG__) return null;

  const api = window.electronAPI;
  // minimize / maximize / close 均为 ipcRenderer.invoke，返回 Promise
  const handleMin   = () => { api?.minimize?.().catch?.(() => {}); };
  const handleMax   = () => { api?.maximize?.().catch?.(() => {}); };
  const handleClose = () => { api?.close?.().catch?.(() => {});   };

  return (
    <div
      id="vxin-titlebar"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 30,
        background: 'var(--titlebar-bg)', zIndex: "calc(var(--z-native) - 1)",
        WebkitAppRegion: 'drag',
        display: 'flex', alignItems: 'center',
        userSelect: 'none',
      }}
    >
      {/* 左侧：图标 + 标题 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        flex: 1, paddingLeft: 10, minWidth: 0,
      }}>
        {/* v信 品牌图标 — 新版绿色圆角方形 + 白色双聊天气泡，与 EXE/Login/侧栏
            Logo 同一套矢量图（不用旧的单色 V 形勾勒 + 渐变，渐变本身也不符合
            品牌规范）。 */}
        <div style={{ width: 18, height: 18, flexShrink: 0, borderRadius: 4, overflow: 'hidden' }}>
          <svg viewBox="0 0 100 100" fill="none" width="18" height="18">
            <rect x="0" y="0" width="100" height="100" fill="#0D9EB8"/>
            <rect x="47.54" y="48.53" width="43.20" height="33.30" rx="11.30" fill="#0D9EB8"/>
            <polygon points="85.56,79.69 77.41,78.40 86.41,88.69" fill="#0D9EB8"/>
            <circle cx="86.41" cy="88.69" r="1.37" fill="#0D9EB8"/>
            <rect x="7.10" y="17.66" width="66.00" height="50.16" rx="15.05" fill="#fff"/>
            <polygon points="15.02,64.85 26.31,63.07 13.83,77.32" fill="#fff"/>
            <circle cx="13.83" cy="77.32" r="1.90" fill="#fff"/>
            <rect x="49.34" y="50.33" width="39.60" height="29.70" rx="9.50" fill="#fff"/>
            <polygon points="84.19,78.05 76.66,76.86 84.98,86.37" fill="#fff"/>
            <circle cx="84.98" cy="86.37" r="1.27" fill="#fff"/>
          </svg>
        </div>
        <span style={{
          fontSize: 12, color: 'var(--titlebar-title)',
          letterSpacing: 0.5, whiteSpace: 'nowrap',
        }}>v信</span>
      </div>

      <div style={{
        display: 'flex', height: '100%',
        WebkitAppRegion: 'no-drag',
        position: 'relative', zIndex: "var(--z-native)",
      }}>
        <WinBtn onClick={handleMin} title="最小化">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="5.5" width="10" height="1" fill="currentColor" rx="0.5"/>
          </svg>
        </WinBtn>

        <WinBtn onClick={handleMax} title={isMaximized ? '还原' : '最大化'}>
          {isMaximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="3" y="1" width="8" height="8" rx="1"/>
              <rect x="1.5" y="3.5" width="8" height="8" rx="1" fill="var(--titlebar-bg)" stroke="currentColor"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="1.5" y="1.5" width="9" height="9" rx="1"/>
            </svg>
          )}
        </WinBtn>

        <WinBtn isClose onClick={handleClose} title="关闭">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="2" x2="10" y2="10"/>
            <line x1="10" y1="2" x2="2" y2="10"/>
          </svg>
        </WinBtn>
      </div>
    </div>
  );
}
