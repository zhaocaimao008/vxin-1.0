/**
 * ModalSkeleton — lazy 弹窗骨架屏
 * 替代 fallback={null}，避免弹窗加载时的 CLS（布局抖动）
 * 极简动画，不分散注意力
 */
import React from 'react';

// 模态弹窗骨架（全屏蒙层 + 居中卡片占位）
export function ModalSkeleton({ height = 400 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)',
    }}>
      <div style={{
        width: 360, height, borderRadius: 12,
        background: 'var(--color-surface, #1e2235)',
        animation: 'skeleton-pulse 1.2s ease-in-out infinite',
      }} />
    </div>
  );
}

// 侧边面板骨架（群信息、用户资料等）
export function PanelSkeleton({ width = 300 }) {
  return (
    <div style={{
      width, height: '100%',
      background: 'var(--color-surface, #1e2235)',
      animation: 'skeleton-pulse 1.2s ease-in-out infinite',
      borderLeft: '1px solid var(--color-border, rgba(255,255,255,0.08))',
    }} />
  );
}

// 内联骨架块（表情面板等）
export function InlineSkeleton({ height = 280, width = '100%' }) {
  return (
    <div style={{
      width, height, borderRadius: 8,
      background: 'var(--color-surface, #1e2235)',
      animation: 'skeleton-pulse 1.2s ease-in-out infinite',
    }} />
  );
}

// 全局 CSS（追加到 design-tokens.css）
// @keyframes skeleton-pulse { 0%,100%{opacity:.6} 50%{opacity:.9} }
