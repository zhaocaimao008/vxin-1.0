import React from 'react';

const COLORS = ['#1ABC9C','#3498DB','#9B59B6','#E67E22','#E74C3C','#2ECC71','#F39C12','#07C160','#16A085','#8E44AD'];

function getColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Avatar({ src, name = '', size = 40, style = {}, online = false, className = '' }) {
  const radius = Math.round(size * 0.22);
  const baseStyle = { width: size, height: size, borderRadius: radius, overflow: 'hidden', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative', ...style };
  const letter = (name || '?')[0].toUpperCase();

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...style }}>
      {src
        ? <img src={src} alt={name} style={{ ...baseStyle, objectFit: 'cover' }} />
        : <div style={{ ...baseStyle, background: getColor(name), color: '#fff', fontSize: size * 0.42, fontWeight: 600 }}>{letter}</div>
      }
      {online && <span className="wc-online-dot" />}
    </div>
  );
}
