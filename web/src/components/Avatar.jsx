import React, { memo, useState } from 'react';
import { mediaUrl } from '../utils/url';

// 无头像时的字母头像配色：多彩调色盘，按名字 hash 稳定取色
const COLORS = [
  'var(--color-primary)',
  '#17B8A6',
  '#5B7BF0',
  '#9B7BF5',
  '#F0A020',
  '#FF7A93',
  '#13C2C2',
  '#7C6BF7',
  '#E8619D',
  '#38C0A8',
];

export function getColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default memo(function Avatar({ src, name = '', size = 40, style = {}, online = false,
  className: _className = '', onClick, priority = false }) {
  const radius = Math.max(3, Math.round(size * 0.13));
  const baseStyle = {
    width: size, height: size, borderRadius: radius, overflow: 'hidden',
    flexShrink: 0, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', position: 'relative', ...style,
  };
  const letter = (name || '?')[0].toUpperCase();

  const [errored, setErrored] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) { setPrevSrc(src); setErrored(false); }
  const showImg = src && !errored;

  // mediaUrl 已在 Electron 下附加 token，直接用原图 URL，不加 srcset ?w= 参数
  // （服务端不支持按宽缩放，?w= 会 404 导致裂图）
  const imgUrl = showImg ? mediaUrl(src) : null;

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', flexShrink: 0,
               cursor: onClick ? 'pointer' : undefined, ...style }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } : undefined}
    >
      {showImg ? (
        <>
          {/* 底层字母兜底：图片加载中/加载失败时可见 */}
          <div aria-hidden="true" style={{ ...baseStyle, position: 'absolute', inset: 0,
            background: getColor(name), color: 'var(--text-inverse)',
            fontSize: size * 0.42, fontWeight: 600 }}>{letter}</div>
          <img
            src={imgUrl}
            alt={name}
            width={size}
            height={size}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            onError={() => setErrored(true)}
            style={{ ...baseStyle, objectFit: 'cover', position: 'relative', zIndex: 1 }}
          />
        </>
      ) : (
        <div style={{ ...baseStyle, background: getColor(name), color: 'var(--text-inverse)',
          fontSize: size * 0.42, fontWeight: 600 }}>{letter}</div>
      )}
      {online && <span className="wc-online-dot" />}
    </div>
  );
});

