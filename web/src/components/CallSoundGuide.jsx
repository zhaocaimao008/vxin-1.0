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

  const style = {
    position: 'fixed',
    // top:12 此前直接扣在顶栏（--header-h: 54px）范围内，压住会话头部的联系人名字。改成
    // header-h+12 后又发现"动态"页有标题+子标签两层顶部区域（比单层顶栏更高，实测约
    // 90-100px），同样的偏移量还是会压住"互动消息"标签文字。这是个全局挂载、跨任意页面
    // 显示的一次性引导条，没有单一 CSS 选择器能覆盖所有页面各自不同高度的顶部结构，与其
    // 逐页微调，不如统一让到一个能容纳"顶栏+两行标题"场景的安全值，牺牲部分页面下方多出
    // 的空白换全页面不遮挡。
    top: 100,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    // 窄屏(≤400px)下 fixed+shrink-to-fit 会把里面的文字挤得换行，胶囊被撑成三行，
    // 比压住头部还难看；收紧内边距/间距/字号，文字整体不换行，宁可贴边也不折行。
    padding: window.innerWidth <= 400 ? '6px 10px' : '8px 14px',
    borderRadius: 999,
    background: 'rgba(23,29,48,0.95)',
    color: '#fff',
    fontSize: window.innerWidth <= 400 ? 11 : 13,
    boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
    maxWidth: 'calc(100vw - 16px)',
  };

  return (
    <div style={style} role="status">
      <span style={{ whiteSpace: 'nowrap' }}>🔔 开启来电铃声提醒</span>
      <button
        onClick={enable}
        style={{
          border: 'none', borderRadius: 999, padding: window.innerWidth <= 400 ? '3px 10px' : '4px 14px',
          background: '#4C8DFF', color: '#fff', fontSize: window.innerWidth <= 400 ? 11 : 13, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        开启
      </button>
      <button
        onClick={later}
        style={{
          border: 'none', borderRadius: 999, padding: window.innerWidth <= 400 ? '3px 6px' : '4px 10px',
          background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: window.innerWidth <= 400 ? 10 : 12, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        暂不
      </button>
    </div>
  );
}
