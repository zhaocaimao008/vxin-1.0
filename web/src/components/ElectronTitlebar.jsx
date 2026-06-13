import React, { useState } from 'react';

function WinBtn({ onClick, isClose, children }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 46, height: 30, border: 'none',
        background: hov ? (isClose ? '#E53E3E' : 'rgba(255,255,255,.15)') : 'transparent',
        color: hov ? '#fff' : 'rgba(255,255,255,.7)',
        cursor: 'pointer', fontSize: 14, transition: 'background .1s, color .1s',
        WebkitAppRegion: 'no-drag', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >{children}</button>
  );
}

export default function ElectronTitlebar() {
  if (!window.__ELECTRON_CONFIG__) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 30,
      background: '#1A2033', zIndex: 99999,
      WebkitAppRegion: 'drag',
      display: 'flex', alignItems: 'center',
      userSelect: 'none',
    }}>
      <span style={{ flex: 1, paddingLeft: 56, fontSize: 12, color: 'rgba(255,255,255,.4)', letterSpacing: 1 }}>v信</span>
      <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' }}>
        <WinBtn onClick={() => window.electron?.minimize?.()}>&#x2014;</WinBtn>
        <WinBtn onClick={() => window.electron?.maximize?.()}>&#x25A1;</WinBtn>
        <WinBtn isClose onClick={() => window.electron?.closeWindow?.()}>&#x2715;</WinBtn>
      </div>
    </div>
  );
}
