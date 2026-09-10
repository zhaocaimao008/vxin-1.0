import React, { useState } from 'react';
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
 * 定位沿革（批次11/12/18）：从「顶栏下方居中大胶囊」一路改到这版「顶部通栏细条」，
 * 前两版无论把 top 偏移调多大，都只是在"猜下面还有多少内容"——不同页面顶部结构高度
 * 不一（单层顶栏/双层标题+标签/短会话消息紧贴顶部…），批次18 用真实截图实测到
 * 大胶囊会直接压在新会话第一条消息气泡上。这版改用与 ReconnectingBanner
 * （同目录，已验证过全端无遮挡问题的既有组件）完全相同的"顶部通栏细条"方案：
 * 贴 viewport 最顶端、内容单行不换行、高度收得足够窄，不再需要为任何页面的具体高度
 * 猜测安全间距——两个通栏细条即使碰巧同时出现也只是相互紧贴，不会压住消息/标题正文。
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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '6px 10px',
        paddingTop: 'calc(6px + env(safe-area-inset-top))', // 移动端避开刘海
        background: 'rgba(23,29,48,0.95)',
        color: '#fff',
        fontSize: 12,
        boxShadow: '0 1px 6px rgba(0,0,0,.25)',
      }}
    >
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🔔 开启来电铃声提醒</span>
      <button
        onClick={enable}
        style={{
          border: 'none', borderRadius: 999, padding: '3px 10px', flexShrink: 0,
          background: '#4C8DFF', color: '#fff', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        开启
      </button>
      <button
        onClick={later}
        style={{
          border: 'none', borderRadius: 999, padding: '3px 8px', flexShrink: 0,
          background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        暂不
      </button>
    </div>
  );
}
