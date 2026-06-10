import React, { useState, useCallback, useRef, useEffect } from 'react';
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

export default function AddFriendModal({ onClose, initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
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

  // 带入初始关键词时自动搜索（来自主搜索框「去网络搜索」兜底）
  useEffect(() => { if (initialQuery.trim()) doSearch(initialQuery); }, [initialQuery, doSearch]);

  const onChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    if (!v.trim()) { setResults([]); setSearched(false); }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(v), 350);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    inputRef.current?.focus();
  };

  return (
    <div className="af-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="af-panel" onClick={e => e.stopPropagation()}>

        {/* ── 标题栏 ── */}
        <div className="af-hd">
          <span className="af-hd-title">添加好友</span>
          <button className="af-hd-close" onClick={onClose} aria-label="关闭">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* ── 搜索框 ── */}
        <div className="af-search-wrap">
          <div className="af-search">
            <svg className="af-search-ico" viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input
              ref={inputRef}
              className="af-search-inp"
              placeholder="搜索 v信号、手机号或昵称"
              value={query}
              onChange={onChange}
              onKeyDown={e => e.key === 'Enter' && doSearch(query)}
            />
            {query && (
              <button className="af-search-clr" onClick={clearSearch} aria-label="清空">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                  <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── 内容区 ── */}
        <div className="af-body">

          {/* 搜索中 */}
          {searching && (
            <div className="af-loading">
              <div className="af-spinner" />
              <span className="af-loading-txt">搜索中…</span>
            </div>
          )}

          {/* 空闲态：引导图 */}
          {!searching && !query && (
            <div className="af-empty">
              <div className="af-empty-icon-wrap">
                <div className="af-empty-avatar-bg">
                  <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"
                    style={{ color: 'var(--color-primary)', opacity: .85 }}>
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
                <div className="af-empty-plus">
                  <svg viewBox="0 0 14 14" width="10" height="10" fill="none"
                    stroke="#fff" strokeWidth="2" strokeLinecap="round">
                    <line x1="7" y1="1" x2="7" y2="13"/>
                    <line x1="1" y1="7" x2="13" y2="7"/>
                  </svg>
                </div>
              </div>
              <div className="af-empty-title">查找新朋友</div>
              <div className="af-empty-sub">输入 v信号快速定位联系人</div>
              <div className="af-tags">
                <span className="af-tag">v信号</span>
                <span className="af-tag">手机号</span>
                <span className="af-tag">昵称</span>
              </div>
            </div>
          )}

          {/* 未找到结果 */}
          {!searching && searched && results.length === 0 && (
            <div className="af-notfound">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"
                style={{ color: 'var(--gray-300)', marginBottom: 10 }}>
                <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <div className="af-notfound-title">未找到「{query}」相关用户</div>
              <div className="af-notfound-sub">可尝试搜索 v信号或手机号</div>
            </div>
          )}

          {/* 搜索结果 */}
          {!searching && results.map(u => (
            <AfResultItem key={u.id} user={u} onClick={() => setViewId(u.id)} />
          ))}
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
    </div>
  );
}
