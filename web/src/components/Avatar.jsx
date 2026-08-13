import React, { memo, useState } from 'react';
import { mediaUrl } from '../utils/url';

// 无头像时的字母头像配色：AURORA 极光系多彩，按名字 hash 稳定取色，去掉"整页灰"
const COLORS = [
  'var(--color-primary)', // 极光靛(主)——跟随品牌主色 token，暗色自动切换
  '#17B8A6', // 青碧(辅)
  '#5B7BF0', // 靛蓝
  '#9B7BF5', // 薰衣草紫
  '#F0A020', // 琥珀
  '#FF7A93', // 珊瑚粉
  '#13C2C2', // 青
  '#7C6BF7', // 蓝紫
  '#E8619D', // 品红
  '#38C0A8', // 薄荷
];

export function getColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default memo(function Avatar({ src, name = '', size = 40, style = {}, online = false,
  className: _className = '', onClick, priority = false }) {
  const radius = Math.max(3, Math.round(size * 0.13));
  const baseStyle = { width: size, height: size, borderRadius: radius, overflow: 'hidden',
    flexShrink: 0, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', position: 'relative', ...style };
  const letter = (name || '?')[0].toUpperCase();

  const [errored, setErrored] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) { setPrevSrc(src); setErrored(false); }
  const showImg = src && !errored;

  // srcset：根据设备像素比提供 1x/2x/3x 版本（节省移动端带宽 50-70%）
  // sizes：告知浏览器实际显示尺寸（单位 px × dpr），精确选取最优分辨率
  const imgUrl = showImg ? mediaUrl(src) : null;
  const imgSizes = `${size}px`;
  // 若服务端支持 ?w= 缩放参数则生成 srcset，否则只用原图
  const hasSrcset = imgUrl && !imgUrl.startsWith('data:') && !imgUrl.startsWith('blob:');
  const srcSet = hasSrcset
    ? `${imgUrl}?w=${size} 1x, ${imgUrl}?w=${size * 2} 2x, ${imgUrl}?w=${size * 3} 3x`
    : undefined;

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
          <div aria-hidden="true" style={{ ...baseStyle, position: 'absolute', inset: 0,
            background: getColor(name), color: 'var(--text-inverse)',
            fontSize: size * 0.42, fontWeight: 600 }}>{letter}</div>
          <img
            src={imgUrl}
            srcSet={srcSet}
            sizes={imgSizes}
            alt={name}
            width={size}
            height={size}
            loading={priority ? 'eager' : 'lazy'}
            fetchpriority={priority ? 'high' : 'auto'}
            decoding={priority ? 'sync' : 'async'}
            crossOrigin="anonymous"
            onError={() => setErrored(true)}
            style={{ ...baseStyle, objectFit: 'cover', position: 'relative', zIndex: 1 }}
          />
        </>
      ) : (
        <div style={{ ...baseStyle, background: getColor(name), color: 'var(--text-inverse)',
          fontSize: size * 0.42, fontWeight: 600, transition: 'opacity .15s' }}>{letter}</div>
      )}
      {online && <span className="wc-online-dot" />}
    </div>
  );
});
