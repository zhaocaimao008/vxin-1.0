'use strict';
/**
 * 来电铃声（WebAudio 合成，零音频文件依赖）。
 *
 * 浏览器 autoplay 策略：AudioContext 初始 suspended，必须用户手势后才允许出声。
 * 本模块配合两处解锁：
 *   1. 全局首次手势静默解锁（main.jsx 一次性 pointerdown/keydown/touchstart → prewarmAudio）
 *   2. 首次引导条「点击开启来电铃声」（CallSoundGuide 组件，点击即预热）
 * 解锁后（sticky activation）AudioContext 保持 running，来电铃声即可无手势播放。
 *
 * Electron 桌面端：主进程已 appendSwitch('autoplay-policy','no-user-gesture-required')
 * + backgroundThrottling:false，本模块自动生效，无需额外处理。
 */
let _ctx = null;
let _ringing = false;
let _ringTimer = null;

function getCtx() {
  if (!_ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { _ctx = new AC(); } catch { return null; }
  }
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

/** 预热：必须在用户手势回调内调用才会真正解锁（幂等，可安全重复调用）。 */
export function prewarmAudio() {
  getCtx();
}

// 单声：正弦音 + 快起慢收包络，避免爆音
function beep(ctx, freq, dur, gainVal) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(gainVal, t + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t); osc.stop(t + dur + 0.05);
}

/**
 * 播放来电铃声（循环：900/1200Hz 交替，电话铃声听感）。
 * 幂等：已在响则忽略。AudioContext 未解锁时静默返回——视觉提醒（标题/favicon）兜底。
 */
export function playIncomingRing() {
  if (_ringing) return;
  const ctx = getCtx();
  if (!ctx || ctx.state !== 'running') return;
  _ringing = true;
  let beat = 0;
  const playBeat = () => {
    if (!_ringing) return;
    beep(ctx, beat % 2 === 0 ? 900 : 1200, 0.45, 0.16);
    beat += 1;
    _ringTimer = setTimeout(playBeat, 700);
  };
  playBeat();
}

/** 停止来电铃声（幂等）。 */
export function stopIncomingRing() {
  _ringing = false;
  if (_ringTimer) { clearTimeout(_ringTimer); _ringTimer = null; }
}
