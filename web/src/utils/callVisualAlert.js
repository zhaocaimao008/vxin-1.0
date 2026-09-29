'use strict';
/**
 * 来电视觉提醒：标题栏闪烁 + favicon 变化。
 * 纯视觉、零权限、零依赖——浏览器 autoplay 限制下无手势时唯一 100% 生效的提醒层。
 * 后台标签页同样可见（桌面浏览器）。
 */
let _titleTimer = null;
let _origTitle = '';
let _origFavicon = null;

function setFavicon(href) {
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}

// 64x64 红底白电话：用与应用内一致的 Material 电话图标路径绘制（emoji 在各系统上外观不一）
const PHONE_PATH = 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z';
function makeCallFavicon() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#E53935';
  g.beginPath(); g.arc(32, 32, 32, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#FFFFFF';
  g.translate(14, 14); g.scale(1.5, 1.5);
  g.fill(new Path2D(PHONE_PATH));
  return c.toDataURL('image/png');
}

/**
 * 开始来电视觉提醒：标题在「📞 xx 来电」与原标题间轮换，favicon 换为红色电话。
 * 幂等：已在提醒中则忽略。
 */
export function startCallVisualAlert(name) {
  if (_titleTimer) return;
  _origTitle = document.title;
  const orig = document.querySelector('link[rel="icon"]');
  _origFavicon = orig ? orig.href : null;
  setFavicon(makeCallFavicon());
  let showCall = true;
  _titleTimer = setInterval(() => {
    document.title = showCall ? `📞 ${name} 来电 - ${_origTitle}` : _origTitle;
    showCall = !showCall;
  }, 900);
}

/** 停止视觉提醒并恢复原标题/favicon（幂等）。 */
export function stopCallVisualAlert() {
  if (_titleTimer) { clearInterval(_titleTimer); _titleTimer = null; }
  document.title = _origTitle;
  if (_origFavicon !== null) setFavicon(_origFavicon);
  _origFavicon = null;
}
