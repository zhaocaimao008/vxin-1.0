/**
 * BrandMark / BrandLogo — v信 品牌标志（全站唯一实现）
 *
 * 几何只来自 ../brand/vxinMark.json；favicon / PWA / Electron / 启动画面的位图由
 * web/scripts/generate-brand-assets.py 读同一文件生成，改标志只改 JSON 再重跑脚本。
 *
 * 颜色写死为品牌色，不跟随 currentColor：品牌不是功能图标。
 * 根节点 class="vx-brand-mark"（不带 vx-ico），brand-icons.css 对它做 fill/stroke 隔离，
 * 历史样式里 `.xxx svg { fill: ... }` 之类的规则不会把它染色或描边。
 */
import React from 'react';
import mark from '../brand/vxinMark.json';

const { colors: C, bubble: B, v: V, tile: T, viewBox: VB } = mark;

const PALETTES = {
  // 墨绿方块 + 白气泡 + 墨绿 V（默认）
  tile: { tile: C.ink, bubble: C.paper, v: C.ink },
  // 白方块 + 墨绿气泡 + 白 V（放在墨绿或深色大面积底上时使用）
  light: { tile: C.paper, bubble: C.ink, v: C.paper },
};

export function BrandMark({ size = 40, variant = 'tile', title, className, style, ...rest }) {
  const p = PALETTES[variant] || PALETTES.tile;
  const labelled = Boolean(title);
  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      width={size ?? undefined}
      height={size ?? undefined}
      className={className ? `vx-brand-mark ${className}` : 'vx-brand-mark'}
      style={style}
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
      {...rest}
    >
      <rect className="vxb-tile" width={VB} height={VB} rx={T.radius} fill={p.tile} style={{ fill: p.tile }} />
      <rect className="vxb-bubble" x={B.x} y={B.y} width={B.width} height={B.height} rx={B.radius}
        fill={p.bubble} style={{ fill: p.bubble }} />
      <path className="vxb-bubble" d={B.tail} fill={p.bubble} stroke={p.bubble} strokeWidth="1.2" strokeLinejoin="round"
        style={{ fill: p.bubble, stroke: p.bubble }} />
      <polyline className="vxb-v" points={V.points} fill="none" stroke={p.v} strokeWidth={V.strokeWidth}
        strokeLinecap="round" strokeLinejoin="round" style={{ fill: 'none', stroke: p.v }} />
    </svg>
  );
}

/** 标志 + 「v信」字标（可选副标题）。layout: 'row' 横排（页头/标题栏）| 'stack' 竖排（登录/关于/启动） */
export function BrandLogo({ size = 40, layout = 'row', tagline, className, nameClassName, ...rest }) {
  const cls = ['vx-brand-logo', `vx-brand-logo--${layout}`, className].filter(Boolean).join(' ');
  return (
    <span className={cls} {...rest}>
      <BrandMark size={size} />
      <span className="vx-brand-text">
        <span className={nameClassName ? `vx-brand-name ${nameClassName}` : 'vx-brand-name'}>v信</span>
        {tagline && <span className="vx-brand-tagline">{tagline}</span>}
      </span>
    </span>
  );
}

export default BrandMark;
