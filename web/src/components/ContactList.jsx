import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import UserProfile from './UserProfile';
import { GroupAvatar } from './GroupInfo';
import { useSocket } from '../contexts/SocketContext';

/* ── 搜索 + 添加好友独立弹窗 ── */
function AddFriendModal({ onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [viewId, setViewId] = useState(null);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  const doSearch = useCallback((q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    axios.get(`/api/users/search?q=${encodeURIComponent(q.trim())}`)
      .then(({ data }) => setResults(data))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, []);

  const onChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(v), 400);
  };

  return (
    <div className="af-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="af-modal">
        <div className="af-header">
          <span className="af-title">添加好友</span>
          <button className="af-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <div className="af-search-wrap">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" style={{ color: '#B0BAC5', flexShrink: 0 }}>
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            ref={inputRef}
            className="af-search-input"
            placeholder="搜索 v信号、手机号或昵称"
            value={query}
            onChange={onChange}
            onKeyDown={e => e.key === 'Enter' && doSearch(query)}
          />
          {query && (
            <button className="af-clear" onClick={() => { setQuery(''); setResults([]); }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          )}
        </div>

        <div className="af-body">
          {searching && (
            <div className="af-hint">搜索中…</div>
          )}
          {!searching && query && results.length === 0 && (
            <div className="af-hint">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="#D0D7E3" style={{ marginBottom: 10 }}>
                <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              未找到「{query}」相关用户
              <div style={{ fontSize: 12, marginTop: 4, color: '#B0BAC5' }}>可搜索 v信号、手机号或昵称</div>
            </div>
          )}
          {!searching && !query && (
            <div className="af-hint">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="#D0D7E3" style={{ marginBottom: 10 }}>
                <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
              输入 v信号、手机号或昵称搜索
            </div>
          )}
          {results.map(u => (
            <div key={u.id} className="af-result-item" onClick={() => setViewId(u.id)}>
              <Avatar src={u.avatar} name={u.username} size={44} style={{ borderRadius: 8, flexShrink: 0 }} />
              <div className="af-result-info">
                <div className="af-result-name">{u.username}</div>
                <div className="af-result-sub">{u.wechat_id ? `v信号：${u.wechat_id}` : u.phone}</div>
              </div>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="#C7C7CC">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </div>
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

/* ── 主组件 ── */
export default function ContactList({ onStartChat, searchQuery = '', addFriendRequest = 0 }) {
  const [contacts, setContacts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [groups, setGroups] = useState([]);
  const [tab, setTab] = useState('contacts');
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [activeChar, setActiveChar] = useState(null);
  const [viewProfile, setViewProfile] = useState(null);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const listRef = useRef(null);
  const { socket } = useSocket();

  const fetchContacts = useCallback(() =>
    axios.get('/api/users/contacts').then(r => setContacts(r.data)), []);
  const fetchRequests = useCallback(() =>
    axios.get('/api/users/friend-requests').then(r => setRequests(r.data)), []);
  const fetchGroups = useCallback(() =>
    axios.get('/api/messages/my-groups').then(r => setGroups(r.data)), []);

  useEffect(() => {
    fetchContacts(); fetchRequests(); fetchGroups();
  }, [fetchContacts, fetchRequests, fetchGroups]);

  useEffect(() => {
    if (!socket) return;
    const onOnline = ({ userId }) => setOnlineIds(prev => new Set([...prev, userId]));
    const onOffline = ({ userId }) => setOnlineIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
    const onFriendReq = (req) => setRequests(prev => [req, ...prev]);
    const onAccepted = () => { fetchContacts(); fetchRequests(); };
    const onNewConv = () => fetchGroups();
    socket.on('user_online', onOnline);
    socket.on('user_offline', onOffline);
    socket.on('new_friend_request', onFriendReq);
    socket.on('friend_request_accepted', onAccepted);
    socket.on('new_conversation', onNewConv);
    socket.on('group_updated', onNewConv);
    return () => {
      socket.off('user_online', onOnline);
      socket.off('user_offline', onOffline);
      socket.off('new_friend_request', onFriendReq);
      socket.off('friend_request_accepted', onAccepted);
      socket.off('new_conversation', onNewConv);
      socket.off('group_updated', onNewConv);
    };
  }, [socket, fetchContacts, fetchGroups, fetchRequests]);

  useEffect(() => {
    const handler = ({ detail }) => {
      const { userId, remark } = detail || {};
      if (userId) setContacts(prev => prev.map(c => c.id === userId ? { ...c, remark: remark || '' } : c));
      fetchContacts();
    };
    window.addEventListener('vxin:remark-changed', handler);
    return () => window.removeEventListener('vxin:remark-changed', handler);
  }, [fetchContacts]);

  // 从顶栏"添加朋友"入口触发
  useEffect(() => {
    if (!addFriendRequest) return;
    setShowAddFriend(true);
  }, [addFriendRequest]);

  const handleRequest = async (id, action) => {
    await axios.post(`/api/users/friend-request/${id}/handle`, { action });
    setRequests(prev => prev.filter(r => r.id !== id));
    if (action === 'accepted') fetchContacts();
  };

  const startChat = (contact) => {
    axios.post('/api/messages/conversation/private', { userId: contact.id }).then(({ data }) => {
      onStartChat({ id: data.conversationId, type: 'private', name: contact.remark || contact.username, avatar: contact.avatar, otherUser: contact });
    });
  };

  // 按首字母分组联系人
  const grouped = {};
  const filtered = contacts.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (c.remark || c.username || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
  });
  filtered.forEach(c => {
    const name = c.remark || c.username || '';
    const first = name[0]?.toUpperCase() || '#';
    const letter = /[A-Z]/.test(first) ? first : '#';
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(c);
  });
  const letters = Object.keys(grouped).sort((a, b) => a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b));

  const scrollToLetter = (l) => {
    const el = listRef.current?.querySelector(`[data-letter="${l}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', background: 'var(--bg-panel)' }}>
      <div className="wc-list" ref={listRef}>

        {/* 联系人主列表 */}
        {tab === 'contacts' && (
          <>
            {/* 功能入口 */}
            <EntryRow
              icon={<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>}
              color="#07C160" label="新的朋友" badge={requests.length}
              onClick={() => setTab('requests')}
            />
            <EntryRow
              icon={<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>}
              color="#1677FF" label="群聊" badge={0}
              onClick={() => setTab('groups')}
            />
            <EntryRow
              icon={<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>}
              color="#FF7A45" label="添加好友" badge={0}
              onClick={() => setShowAddFriend(true)}
            />

            <div style={{ height: 8, background: 'var(--divider)' }} />

            {/* 字母分组联系人 */}
            {letters.map(letter => (
              <div key={letter}>
                <div className="wc-contacts-alpha" data-letter={letter}>{letter}</div>
                {grouped[letter].map(c => (
                  <div key={c.id} className="wc-contact-item" onClick={() => setViewProfile(c.id)}>
                    <div style={{ position: 'relative' }}>
                      <Avatar src={c.avatar} name={c.remark || c.username} size={44}
                        style={{ borderRadius: 8 }}
                        online={onlineIds.has(c.id)} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="wc-contact-item-name">{c.remark || c.username}</div>
                      {c.remark && <div className="wc-contact-item-sub">{c.username}</div>}
                    </div>
                    {onlineIds.has(c.id) && (
                      <span style={{ fontSize: 11, color: '#07C160', flexShrink: 0 }}>在线</span>
                    )}
                  </div>
                ))}
              </div>
            ))}

            {contacts.length === 0 && !searchQuery && (
              <div className="cl-empty">
                <svg viewBox="0 0 48 48" width="48" height="48" fill="none" style={{ marginBottom: 12 }}>
                  <circle cx="24" cy="20" r="10" fill="#E8ECF0"/>
                  <path d="M8 40c0-8.84 7.16-16 16-16s16 7.16 16 16" stroke="#D0D7E3" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <div style={{ color: '#7A8694', fontSize: 14 }}>暂无联系人</div>
                <div style={{ color: '#B0BAC5', fontSize: 12, marginTop: 4 }}>通过搜索添加好友</div>
                <button className="cl-add-btn" onClick={() => setShowAddFriend(true)}>+ 添加好友</button>
              </div>
            )}
            {searchQuery && filtered.length === 0 && (
              <div className="cl-empty">
                <div style={{ color: '#7A8694', fontSize: 14 }}>未找到「{searchQuery}」</div>
              </div>
            )}
          </>
        )}

        {/* 新的朋友 */}
        {tab === 'requests' && (
          <>
            <SectionHeader title="新的朋友" onBack={() => setTab('contacts')} />
            {requests.length === 0 && (
              <div className="cl-empty">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="#D0D7E3" style={{ marginBottom: 10 }}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
                <div style={{ color: '#7A8694', fontSize: 14 }}>暂无新申请</div>
              </div>
            )}
            {requests.map(r => (
              <div key={r.id} className="req-item">
                <Avatar src={r.avatar || r.from?.avatar} name={r.username || r.from?.username} size={46} style={{ borderRadius: 8, flexShrink: 0 }} />
                <div className="req-info">
                  <div className="req-name">{r.username || r.from?.username}</div>
                  <div className="req-msg">{r.message || '请求添加您为好友'}</div>
                </div>
                <div className="req-btns">
                  <button className="req-accept" onClick={() => handleRequest(r.id, 'accepted')}>接受</button>
                  <button className="req-reject" onClick={() => handleRequest(r.id, 'rejected')}>拒绝</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* 群聊列表 */}
        {tab === 'groups' && (
          <>
            <SectionHeader title={`群聊 (${groups.length})`} onBack={() => setTab('contacts')} />
            {groups.map(g => (
              <div key={g.id} className="wc-contact-item"
                onClick={() => onStartChat({ id: g.id, type: 'group', name: g.name, avatar: g.avatar || '', members: [] })}>
                <GroupAvatar members={g.members || []} avatar={g.avatar} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wc-contact-item-name">{g.name}</div>
                  <div className="wc-contact-item-sub">{g.memberCount} 人</div>
                </div>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="#C7C7CC">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
              </div>
            ))}
            {groups.length === 0 && (
              <div className="cl-empty">
                <div style={{ color: '#7A8694', fontSize: 14 }}>还没有群聊</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 字母索引 */}
      {tab === 'contacts' && letters.length > 0 && (
        <div className="wc-alpha-index">
          {letters.map(l => (
            <span key={l} className="wc-alpha-char"
              onClick={() => { scrollToLetter(l); setActiveChar(l); setTimeout(() => setActiveChar(null), 800); }}>
              {l}
            </span>
          ))}
        </div>
      )}
      {activeChar && <div className="wc-alpha-bubble">{activeChar}</div>}

      {/* 添加好友弹窗 */}
      {showAddFriend && <AddFriendModal onClose={() => setShowAddFriend(false)} />}

      {/* 查看联系人资料 */}
      {viewProfile && (
        <UserProfile
          userId={viewProfile}
          onClose={() => setViewProfile(null)}
          onStartChat={(conv) => { setViewProfile(null); onStartChat(conv); }}
          onFriendAdded={fetchContacts}
        />
      )}
    </div>
  );
}

function EntryRow({ icon, color, label, badge, onClick }) {
  return (
    <div className="wc-contact-item" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <span className="wc-contact-item-name">{label}</span>
      </div>
      {badge > 0 && (
        <span style={{ background: '#FA5151', color: '#fff', borderRadius: 9, fontSize: 10, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', marginRight: 4 }}>
          {badge}
        </span>
      )}
      <svg viewBox="0 0 24 24" width="14" height="14" fill="#C7C7CC" style={{ flexShrink: 0 }}>
        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
      </svg>
    </div>
  );
}

function SectionHeader({ title, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)' }}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--green)', fontSize: 13, cursor: 'pointer', marginRight: 8 }}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/></svg>
        返回
      </button>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{title}</span>
    </div>
  );
}
