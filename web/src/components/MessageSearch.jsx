import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import SearchResults from './SearchResults';

export default function MessageSearch({ onSelectConversation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef(null);
  const searchAbortRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    searchAbortRef.current?.abort();
    if (!q.trim()) { setResults([]); return; }
    const ac = new AbortController();
    searchAbortRef.current = ac;
    setSearching(true);
    try {
      const { data } = await axios.get('/api/messages/search', {
        params: { q },
        signal: ac.signal,
      });
      if (!ac.signal.aborted) setResults(data);
    } catch (err) {
      if (err.code !== 'ERR_CANCELED' && !axios.isCancel?.(err)) setResults([]);
    }
    if (!ac.signal.aborted) setSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const handleSelect = (msg) => {
    // Navigate to the conversation containing this message
    if (msg.conversation_id && onSelectConversation) {
      // Find the conversation from the global list
      axios.get('/api/messages/conversations').then(({ data }) => {
        const conv = data.find(c => c.id === msg.conversation_id);
        if (conv) onSelectConversation(conv);
      }).catch(() => {});
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      doSearch(query);
    }
    if (e.key === 'Escape') {
      setExpanded(false);
      setQuery('');
      setResults([]);
    }
  };

  return (
    <div style={{ position: 'relative', padding: '0 10px', marginTop: 4 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center',
          background: '#E8E8E8', borderRadius: 6,
          padding: '6px 10px', height: 30, gap: 6,
          cursor: expanded ? 'default' : 'pointer',
          transition: 'all .15s',
        }}
        onClick={() => {
          if (!expanded) {
            setExpanded(true);
            setTimeout(() => inputRef.current?.focus(), 100);
          }
        }}
      >
        <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: '#999', flexShrink: 0 }}>
          <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        {expanded ? (
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索消息..."
            style={{
              flex: 1, fontSize: 12, color: '#191919',
              background: 'transparent', border: 'none', outline: 'none',
            }}
          />
        ) : (
          <span style={{ fontSize: 12, color: '#999', flex: 1 }}>搜索消息</span>
        )}
        {expanded && query && (
          <button
            style={{ color: '#999', fontSize: 13, lineHeight: 1, padding: 2, flexShrink: 0 }}
            onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
          >
            ✕
          </button>
        )}
      </div>

      {expanded && (
        <SearchResults
          results={results}
          query={query}
          searching={searching}
          onSelect={handleSelect}
          onClose={() => { setExpanded(false); setQuery(''); setResults([]); }}
        />
      )}
    </div>
  );
}
