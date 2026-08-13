/**
 * ConvListSkeleton — 会话列表加载骨架屏
 * 在会话数据未到达前显示，防止 CLS 和白屏
 */
import React, { memo } from 'react';

const SkeletonRow = memo(function SkeletonRow({ wide }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 16px', height: 64,
    }}>
      {/* 头像占位 */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: 'var(--skeleton-bg, rgba(255,255,255,0.06))',
        animation: 'skeleton-pulse 1.2s ease-in-out infinite',
      }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 名称行 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{
            width: wide ? 120 : 80, height: 13, borderRadius: 4,
            background: 'var(--skeleton-bg, rgba(255,255,255,0.06))',
            animation: 'skeleton-pulse 1.2s ease-in-out infinite',
          }} />
          <div style={{
            width: 32, height: 11, borderRadius: 4,
            background: 'var(--skeleton-bg, rgba(255,255,255,0.04))',
            animation: 'skeleton-pulse 1.2s ease-in-out infinite',
          }} />
        </div>
        {/* 摘要行 */}
        <div style={{
          width: wide ? '80%' : '60%', height: 11, borderRadius: 4,
          background: 'var(--skeleton-bg, rgba(255,255,255,0.04))',
          animation: 'skeleton-pulse 1.2s ease-in-out infinite',
        }} />
      </div>
    </div>
  );
});

export default memo(function ConvListSkeleton({ count = 8 }) {
  return (
    <div style={{ overflow: 'hidden' }}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} wide={i % 3 !== 0} />
      ))}
    </div>
  );
});
