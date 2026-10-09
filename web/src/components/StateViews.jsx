import React from 'react';
import { IcoChat, IcoWarn } from './Icons';

/** Skeleton — 骨架屏占位（列表首屏加载态） */
export const Skeleton = React.memo(function Skeleton({ rows = 6, avatar = true }) {
  return (
    <div className="wc-skeleton" role="status" aria-busy="true" aria-label="加载中">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="wc-skeleton-row" key={i}>
          {avatar && <div className="wc-skeleton-avatar" />}
          <div className="wc-skeleton-lines">
            <div className="wc-skeleton-line" style={{ width: '55%' }} />
            <div className="wc-skeleton-line" style={{ width: '80%' }} />
          </div>
        </div>
      ))}
    </div>
  );
});

/** EmptyState — 空态 */
// 默认图标为 Icons.jsx 的线性图标，放在柔和圆形底块里；调用方传入的 icon（图标元素或字符）原样显示。
const DEFAULT_EMPTY_ICON = <IcoChat size={28} />;
export const EmptyState = React.memo(function EmptyState({ icon = DEFAULT_EMPTY_ICON, title = '暂无内容', desc, action }) {
  const isGlyph = typeof icon === 'string' || typeof icon === 'number';
  return (
    <div className="wc-state wc-state--empty" role="status">
      <div className={isGlyph ? 'wc-state-icon' : 'wc-state-icon wc-state-icon--tile'} aria-hidden="true">{icon}</div>
      <div className="wc-state-title">{title}</div>
      {desc && <div className="wc-state-desc">{desc}</div>}
      {action && <div className="wc-state-action">{action}</div>}
    </div>
  );
});

/** ErrorState — 错误态（可重试） */
export const ErrorState = React.memo(function ErrorState({ title = '加载失败', desc = '请检查网络后重试', onRetry }) {
  return (
    <div className="wc-state wc-state--error" role="alert">
      <div className="wc-state-icon wc-state-icon--warn" aria-hidden="true"><IcoWarn size={40} /></div>
      <div className="wc-state-title">{title}</div>
      {desc && <div className="wc-state-desc">{desc}</div>}
      {onRetry && (
        <button type="button" className="wc-state-retry" onClick={onRetry}>重试</button>
      )}
    </div>
  );
});
