import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import Avatar from './Avatar';
import UserProfile from './UserProfile';
import './AddFriendModal.css';

function AfResultItem({ user: u, onClick }) {
  return (
    <div className="af-item" onClick={onClick}>
      <Avatar src={u.avatar} name={u.username} size={46}
        style={{ borderRadius: 'var(--radius-avatar-lg)', flexShrink: 0 }} />
      <div className="af-item-info">
        <div className="af-item-name">{u.username}</div>
        {(u.wechat_id || u.phone) && (
          <div className="af-item-sub">
            {u.wechat_id ? `v信号：${u.wechat_id}` : `手机：${u.phone.slice(0, 3)}****${u.phone.slice(-4)}`}
          </div>
        )}
      </div>
      <svg className="af-item-chevron" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
      </svg>
    </div>
  );
}

const GREEN = '#07C160';

export default function AddFriendModal({ onClose, initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [focused, setFocused] = useState(false);
  const [viewId, setViewId] = useState(null);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  const doSearch = useCallback((q) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setSearching(true);
    axios.get(`/api/users/search?q=${encodeURIComponent(q.trim())}`)
      .then(({ data }) => { setResults(data); setSearched(true); })
      .catch(() => { setResults([]); setSearched(true); })
      .finally(() => setSearching(false));
  }, []);

  useEffect(() => { if (initialQuery.trim()) doSearch(initialQuery); }, [initialQuery, doSearch]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    if (!v.trim()) { setResults([]); setSearched(false); }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(v), 350);
  };

  const clearSearch = () => {
    setQuery(''); setResults([]); setSearched(false);
    inputRef.current?.focus();
  };

  // ── 全局遮罩 + Portal 逃逸 ──
  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16, background: 'rgba(0, 0, 0, 0.4)',
  };
  const cardStyle = {
    width: 400, maxWidth: '92vw', maxHeight: '80vh',
    display: 'flex', flexDirection: 'column',
    background: 'var(--bg-panel, #fff)', borderRadius: 16,
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.28)',
    border: '1px solid var(--border-color)', overflow: 'hidden',
  };

  // ── 轻盈搜索框：聚焦时变白 + 绿边 + 浅绿光晕 ──
  const searchWrap = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '11px 14px', borderRadius: 12,
    background: focused ? 'var(--bg-panel, #fff)' : 'var(--bg-input-search)',
    border: `1.5px solid ${focused ? GREEN : 'var(--border-color)'}`,
    boxShadow: focused ? `0 0 0 3px rgba(7,193,96,0.12)` : 'none',
    transition: 'background .18s ease, border-color .18s ease, box-shadow .18s ease',
  };

  const isIdle = !query;          // 空闲态：展示引导
  const isSearchingState = query && (searching || (!searched && results.length === 0));

  return createPortal(
    <>
      <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={cardStyle} onClick={e => e.stopPropagation()}>

          {/* 标题栏 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>添加好友</span>
            <button onClick={onClose} aria-label="关闭"
              style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, color: 'var(--text-secondary)', background: 'transparent', cursor: 'pointer', border: 'none', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          {/* 搜索框 */}
          <div style={{ padding: '16px 20px 12px', flexShrink: 0 }}>
            <div style={searchWrap}>
              {/* 极细线条放大镜 */}
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none"
                stroke={focused ? GREEN : 'var(--text-tertiary)'} strokeWidth="2" strokeLinecap="round"
                style={{ flexShrink: 0, transition: 'stroke .18s ease' }}>
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                placeholder="搜索 v信号、手机号或昵称"
                value={query}
                onChange={onChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={e => e.key === 'Enter' && doSearch(query)}
                style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)', background: 'transparent', border: 'none', outline: 'none', boxShadow: 'none', WebkitAppearance: 'none', padding: 0 }}
              />
              {query && (
                <button onClick={clearSearch} aria-label="清空"
                  style={{ display: 'flex', alignItems: 'center', color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* 内容区 */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 180, paddingBottom: 8 }}>

            {/* 空闲态：高呼吸感留白 + 阶梯排版 + 标签胶囊 */}
            {isIdle && (
              <div style={{ padding: '40px 28px 44px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                  输入账号查找朋友
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', fontWeight: 400, lineHeight: 1.7, marginBottom: 20 }}>
                  支持通过 v信号、手机号或昵称<br />精准定位你想添加的联系人
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  {['v信号', '手机号', '昵称'].map(t => (
                    <span key={t} style={{
                      fontSize: 12, color: 'var(--text-secondary)',
                      padding: '5px 13px', borderRadius: 999,
                      background: 'var(--bg-input-search)',
                      border: '1px solid var(--border-color)',
                    }}>{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 动态搜索响应条：输入即浮现，点击/回车触发 */}
            {isSearchingState && (
              <div
                onClick={() => doSearch(query)}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-input-search)'; }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  margin: '4px 16px', padding: '12px 14px', borderRadius: 10,
                  background: 'var(--bg-input-search)', cursor: 'pointer',
                  transition: 'background .15s ease',
                }}>
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  搜索：<span style={{ color: GREEN, fontWeight: 500 }}>{query}</span>
                </span>
                {searching
                  ? <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>搜索中…</span>
                  : <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>回车 ↵</span>}
              </div>
            )}

            {/* 搜索结果 */}
            {!searching && results.map(u => (
              <AfResultItem key={u.id} user={u} onClick={() => setViewId(u.id)} />
            ))}

            {/* 未找到 */}
            {!searching && searched && query && results.length === 0 && (
              <div style={{ textAlign: 'center', padding: '28px 24px', color: 'var(--text-tertiary)' }}>
                <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 4 }}>未找到「{query}」相关用户</div>
                <div style={{ fontSize: 12 }}>换个 v信号或手机号试试</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {viewId && (
        <UserProfile
          userId={viewId}
          onClose={() => setViewId(null)}
          onStartChat={() => { setViewId(null); onClose(); }}
          onFriendAdded={() => {}}
        />
      )}
    </>,
    document.body
  );
}
