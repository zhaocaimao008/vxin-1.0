import React, { useState } from 'react';
import { IcoBell } from './Icons';
import { prewarmAudio } from '../utils/callSound';

const LS_KEY = 'vxin_call_sound_ready';

/**
 * 首次引导条「点击开启来电铃声」。
 * 浏览器 autoplay 策略下 AudioContext 需用户手势解锁——让用户主动点一次，
 * 之后来电铃声即可无手势播放（sticky activation 保持到会话结束）。
 * - Electron 端：主进程已全局解锁 autoplay，无需引导
 * - 移动端（Capacitor）：有原生推送铃声，无需引导
 * - 已预热过（localStorage 标记）：不再打扰
 *
 * 与重连提示一起放在 Home 的正常布局中，给提示条留出真实高度，
 * 避免盖住移动端右上角“发起”和聊天返回按钮。
 */
export default function CallSoundGuide() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === '1'; } catch { return false; }
  });

  if (dismissed) return null;
  if (window.__ELECTRON_CONFIG__) return null;
  if (window.Capacitor && window.Capacitor.isNativePlatform()) return null;

  const enable = () => {
    prewarmAudio();
    try { localStorage.setItem(LS_KEY, '1'); } catch { /* 隐私模式忽略 */ }
    setDismissed(true);
  };

  const later = () => {
    try { localStorage.setItem(LS_KEY, '1'); } catch { /* 隐私模式忽略 */ }
    setDismissed(true);
  };

  return (
    <div
      role="status"
      data-testid="call-sound-guide"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '6px 10px',
        paddingTop: 'calc(6px + env(safe-area-inset-top))', // 移动端避开刘海
        background: 'var(--nt-glass-strong, rgba(255,255,255,.9))',
        WebkitBackdropFilter: 'var(--nt-blur)',
        backdropFilter: 'var(--nt-blur)',
        color: 'var(--text-primary)',
        fontSize: 12,
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><IcoBell size={15} style={{ verticalAlign: '-3px' }} /> 开启来电铃声提醒</span>
      <button
        onClick={enable}
        style={{
          border: 'none', borderRadius: 999, padding: '3px 10px', flexShrink: 0,
          background: 'var(--color-primary)', color: 'var(--text-on-brand)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        开启
      </button>
      <button
        onClick={later}
        style={{
          border: 'none', borderRadius: 999, padding: '3px 8px', flexShrink: 0,
          background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        暂不
      </button>
    </div>
  );
}
