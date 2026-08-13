/**
 * 搜索结果高亮渲染（B15 配套前端组件）
 *
 * 后端 FTS5 snippet() 返回带 <mark>关键词</mark> 标记的文本片段。
 * 本工具将其安全渲染：
 *   1. DOMPurify 消毒（仅保留 <mark> 标签，防止 XSS）
 *   2. 渲染为 React 元素（dangerouslySetInnerHTML 受控）
 */
import React, { memo } from 'react';
import DOMPurify from 'dompurify';

// 只允许 <mark> 标签，其他全部剥离
const PURIFY_CONFIG = {
  ALLOWED_TAGS: ['mark'],
  ALLOWED_ATTR: [],
};

/**
 * 渲染带高亮的搜索摘要
 * @param {string} highlight  后端返回的含 <mark> 标签文本
 * @param {string} fallback   highlight 为空时的降级文本（纯文本，不含标签）
 */
export const HighlightText = memo(function HighlightText({ highlight, fallback = '' }) {
  if (!highlight) {
    return <span>{fallback}</span>;
  }
  const clean = DOMPurify.sanitize(highlight, PURIFY_CONFIG);
  return (
    <span
      dangerouslySetInnerHTML={{ __html: clean }}
      style={{ '--mark-bg': 'rgba(109,90,230,0.25)', '--mark-color': 'inherit' }}
    />
  );
});

/**
 * CSS-in-JS：mark 元素样式（可在全局 CSS 里覆盖）
 * 已在 design-tokens.css 追加 mark { background: var(--mark-bg); color: var(--mark-color); }
 */
export const HIGHLIGHT_STYLE = `
  mark {
    background: rgba(109, 90, 230, 0.22);
    color: inherit;
    border-radius: 2px;
    padding: 0 1px;
    font-weight: 600;
  }
`;
