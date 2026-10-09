'use strict';
/**
 * 来电视觉提醒：标题栏闪烁 + favicon 变化。
 * 纯视觉、零权限、零依赖——浏览器 autoplay 限制下无手势时唯一 100% 生效的提醒层。
 * 后台标签页同样可见（桌面浏览器）。
 */
let _titleTimer = null;
let _origTitle = '';
// index.html 同时声明了多枚 <link rel="icon">（svg / png / ico），浏览器可能取其中任意一枚；
// 提醒期间全部替换，结束后逐个恢复原 href（提醒时新建的 link 则直接移除）。
let _origFavicons = null; // Array<{ link: HTMLLinkElement, href: string|null, type: string|null, created: boolean }>

function iconLinks() {
  return Array.from(document.querySelectorAll('link[rel~="icon"]'));
}

function setFavicon(href) {
  let links = iconLinks();
  if (!links.length) {
    const link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
    if (_origFavicons) _origFavicons.push({ link, href: null, type: null, created: true });
    links = [link];
  }
  links.forEach(link => {
    link.type = 'image/png';
    link.href = href;
  });
}

function restoreFavicons() {
  if (!_origFavicons) return;
  _origFavicons.forEach(({ link, href, type, created }) => {
    if (created) { link.remove(); return; }
    if (type) link.type = type; else link.removeAttribute('type');
    if (href !== null) link.setAttribute('href', href); else link.removeAttribute('href');
  });
  _origFavicons = null;
}

// 64x64 红底白电话：危险语义红 + 与 Icons.jsx IcoPhone 同一条线性电话路径（24 网格，圆头描边）
const PHONE_PATH = 'M5 3.5h2.8a1.5 1.5 0 0 1 1.4 1l.9 2.8a1.5 1.5 0 0 1-.4 1.6L8.3 10.2a12 12 0 0 0 5.5 5.5l1.3-1.4a1.5 1.5 0 0 1 1.6-.4l2.8.9a1.5 1.5 0 0 1 1 1.4V19a1.5 1.5 0 0 1-1.6 1.5C10.7 20 4 13.3 3.5 5.1A1.5 1.5 0 0 1 5 3.5z';
function makeCallFavicon() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#D93A30';
  g.beginPath(); g.arc(32, 32, 32, 0, Math.PI * 2); g.fill();
  g.translate(14, 14); g.scale(1.5, 1.5); // 24 网格 → 36px，居中
  g.strokeStyle = '#FFFFFF';
  g.lineWidth = 2.2;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.stroke(new Path2D(PHONE_PATH));
  return c.toDataURL('image/png');
}

/**
 * 开始来电视觉提醒：标题在「📞 xx 来电」与原标题间轮换，favicon 换为红色电话。
 * 幂等：已在提醒中则忽略。
 */
export function startCallVisualAlert(name) {
  if (_titleTimer) return;
  _origTitle = document.title;
  _origFavicons = iconLinks().map(link => ({
    link, href: link.getAttribute('href'), type: link.getAttribute('type'), created: false,
  }));
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
  restoreFavicons();
}
