import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import UserProfile from './UserProfile';
import { GroupAvatar } from './GroupInfo';
import { useSocket } from '../contexts/SocketContext';

export default function ContactList({ onStartChat }) {
  const [contacts, setContacts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState('contacts');
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [activeChar, setActiveChar] = useState(null);
  const [viewProfile, setViewProfile] = useState(null); // userId
  const listRef = useRef(null);
  const { socket } = useSocket();

  const fetchContacts = useCallback(() =>
    axios.get('/api/users/contacts').then(r => setContacts(r.data)), []);
  const fetchRequests = useCallback(() =>
    axios.get('/api/users/friend-requests').then(r => setRequests(r.data)), []);
  const fetchGroups = useCallback(() =>
    axios.get('/api/messages/my-groups').then(r => setGroups(r.data)), []);

  useEffect(() => {
    fetchContacts();
    fetchRequests();
    fetchGroups();
  }, [fetchContacts, fetchRequests, fetchGroups]);

  useEffect(() => {
    if (!socket) return;
    const onOnline = ({ userId }) => setOnlineIds(prev => new Set([...prev, userId]));
    const onOffline = ({ userId }) => setOnlineIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
    const onFriendReq = (req) => setRequests(prev => [req, ...prev]);
    const onAccepted = () => fetchContacts();
    const onNewConv = () => fetchGroups();
    const onGroupUpdated = () => fetchGroups();
    socket.on('user_online', onOnline);
    socket.on('user_offline', onOffline);
    socket.on('new_friend_request', onFriendReq);
    socket.on('friend_request_accepted', onAccepted);
    socket.on('new_conversation', onNewConv);
    socket.on('group_updated', onGroupUpdated);
    return () => {
      socket.off('user_online', onOnline);
      socket.off('user_offline', onOffline);
      socket.off('new_friend_request', onFriendReq);
      socket.off('friend_request_accepted', onAccepted);
      socket.off('new_conversation', onNewConv);
      socket.off('group_updated', onGroupUpdated);
    };
  }, [socket, fetchContacts, fetchGroups]);

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    const { data } = await axios.get(`/api/users/search?q=${encodeURIComponent(search)}`);
    setSearchResults(data);
    setTab('search');
    setSearching(false);
  };

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

  const openGroup = (group) => {
    onStartChat({ id: group.id, type: 'group', name: group.name, avatar: group.avatar || '', members: [] });
  };

  // Group contacts alphabetically
  const grouped = {};
  contacts.forEach(c => {
    const name = c.remark || c.username || '';
    const first = name[0]?.toUpperCase() || '#';
    const letter = /[A-Z一-鿿]/.test(first) ? first : '#';
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(c);
  });
  const letters = Object.keys(grouped).sort((a, b) => a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b, 'zh-CN'));

  const scrollToLetter = (letter) => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-letter="${letter}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const SpecialIcon = ({ type }) => {
    if (type === 'new') return (
      <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: '#fff' }}>
        <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
      </svg>
    );
    if (type === 'group') return (
      <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: '#fff' }}>
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
      </svg>
    );
    return (
      <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: '#fff' }}>
        <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
      </svg>
    );
  };

  const specials = [
    { id: 'new_friends', iconType: 'new', bg: '#07C160', label: '新的朋友', badge: requests.length, action: () => setTab('requests') },
    { id: 'groups', iconType: 'group', bg: '#1DA1F2', label: '群聊', action: () => setTab('groups') },
    { id: 'tags', iconType: 'tag', bg: '#FF7A45', label: '标签', action: () => {} },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div className="wc-panel-topbar">
        <div className="wc-search">
          <span className="wc-search-icon">
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'currentColor' }}>
              <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </span>
          <input
            placeholder="搜索"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
          />
          {search && (
            <button style={{ color: 'var(--text-tertiary)', fontSize: 14, lineHeight: 1 }} onClick={() => { setSearch(''); setTab('contacts'); }}>✕</button>
          )}
        </div>
        <button className="wc-icon-btn" title="添加好友" onClick={() => setTab('search')} style={{ flexShrink: 0 }}>⊕</button>
      </div>

      <div className="wc-list" ref={listRef}>

        {/* Contacts tab */}
        {tab === 'contacts' && <>
          {specials.map(s => (
            <div key={s.id} className="wc-contact-item" onClick={s.action}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <SpecialIcon type={s.iconType} />
              </div>
              <div style={{ flex: 1 }}>
                <span className="wc-contact-item-name">{s.label}</span>
              </div>
              {s.badge > 0 && (
                <span style={{ background: '#FA5151', color: '#fff', borderRadius: 9, fontSize: 10, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', marginRight: 4 }}>
                  {s.badge}
                </span>
              )}
              <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: '#C7C7CC', flexShrink: 0 }}><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </div>
          ))}
          <div style={{ height: 8, background: '#F5F5F5' }} />

          {letters.map(letter => (
            <div key={letter}>
              <div className="wc-contacts-alpha" data-letter={letter}>{letter}</div>
              {grouped[letter].map(c => (
                <div
                  key={c.id}
                  className="wc-contact-item"
                  onClick={() => setViewProfile(c.id)}
                  onContextMenu={e => { e.preventDefault(); setViewProfile(c.id); }}
                >
                  <div style={{ position: 'relative' }}>
                    <Avatar src={c.avatar} name={c.remark || c.username} size={44} online={onlineIds.has(c.id)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="wc-contact-item-name">{c.remark || c.username}</div>
                    {(c.remark || c.bio) && (
                      <div className="wc-contact-item-sub">{c.remark ? c.username : c.bio}</div>
                    )}
                  </div>
                  {onlineIds.has(c.id) && <span style={{ fontSize: 10, color: '#07C160' }}>在线</span>}
                </div>
              ))}
            </div>
          ))}
          {contacts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#B2B2B2', fontSize: 13 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
              暂无联系人，搜索添加好友
            </div>
          )}
        </>}

        {/* Groups tab */}
        {tab === 'groups' && (
          <>
            <div style={{ padding: '8px 16px 6px', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#888' }}>我的群聊 ({groups.length})</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ fontSize: 13, color: '#07C160' }} onClick={() => setShowCreateGroup(true)}>+ 发起</button>
                <button style={{ fontSize: 13, color: '#07C160' }} onClick={() => setTab('contacts')}>返回</button>
              </div>
            </div>
            {groups.map(g => (
              <div key={g.id} className="wc-contact-item" onClick={() => openGroup(g)}>
                <GroupAvatar members={g.members || []} size={44} />
                <div style={{ flex: 1 }}>
                  <div className="wc-contact-item-name">{g.name}</div>
                  <div className="wc-contact-item-sub">{g.memberCount}人</div>
                </div>
                <span style={{ color: '#C7C7CC', fontSize: 18 }}>›</span>
              </div>
            ))}
            {groups.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#B2B2B2', fontSize: 13 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
                还没有群聊
                <div style={{ marginTop: 12 }}>
                  <button style={{ padding: '8px 20px', background: '#07C160', color: '#fff', borderRadius: 8, fontSize: 14 }} onClick={() => setShowCreateGroup(true)}>
                    发起群聊
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Requests tab */}
        {tab === 'requests' && (
          <>
            <div style={{ padding: '8px 16px', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#888' }}>新的朋友</span>
              <button style={{ fontSize: 13, color: '#07C160' }} onClick={() => setTab('contacts')}>返回</button>
            </div>
            {requests.map(r => (
              <div key={r.id} className="wc-contact-item" style={{ alignItems: 'flex-start' }}>
                <Avatar src={r.avatar || r.from?.avatar} name={r.username || r.from?.username} size={46} />
                <div style={{ flex: 1 }}>
                  <div className="wc-contact-item-name">{r.username || r.from?.username}</div>
                  <div className="wc-contact-item-sub">{r.message || '申请加您为好友'}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, paddingTop: 2 }}>
                  <button style={{ padding: '6px 14px', background: '#07C160', color: '#fff', borderRadius: 5, fontSize: 13, fontWeight: 500 }} onClick={() => handleRequest(r.id, 'accepted')}>接受</button>
                  <button style={{ padding: '6px 10px', background: '#F5F5F5', color: '#555', borderRadius: 5, fontSize: 13, border: '1px solid #E5E5E5' }} onClick={() => handleRequest(r.id, 'rejected')}>拒绝</button>
                </div>
              </div>
            ))}
            {requests.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#B2B2B2', fontSize: 13 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>👤</div>
                暂无新申请
              </div>
            )}
          </>
        )}

        {/* Search tab */}
        {tab === 'search' && (
          <>
            <div style={{ padding: '8px 16px', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#888' }}>搜索结果</span>
              <button style={{ fontSize: 13, color: '#07C160' }} onClick={() => { setTab('contacts'); setSearch(''); }}>返回</button>
            </div>
            {searching && <div style={{ textAlign: 'center', padding: 20, color: '#B2B2B2' }}>搜索中...</div>}
            {!searching && searchResults.map(u => (
              <div key={u.id} className="wc-contact-item" onClick={() => setViewProfile(u.id)}>
                <Avatar src={u.avatar} name={u.username} size={46} />
                <div style={{ flex: 1 }}>
                  <div className="wc-contact-item-name">{u.username}</div>
                  <div className="wc-contact-item-sub">{u.wechat_id ? `微信号: ${u.wechat_id}` : u.phone}</div>
                </div>
                <span style={{ color: '#C7C7CC', fontSize: 18 }}>›</span>
              </div>
            ))}
            {!searching && searchResults.length === 0 && search && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#B2B2B2', fontSize: 13 }}>未找到用户</div>
            )}
          </>
        )}
      </div>

      {/* Alphabet index */}
      {tab === 'contacts' && letters.length > 0 && (
        <div className="wc-alpha-index">
          {letters.map(l => (
            <span key={l} className="wc-alpha-char" onClick={() => { scrollToLetter(l); setActiveChar(l); setTimeout(() => setActiveChar(null), 800); }}>
              {l}
            </span>
          ))}
        </div>
      )}
      {activeChar && <div className="wc-alpha-bubble">{activeChar}</div>}

      {/* User profile modal */}
      {viewProfile && (
        <UserProfile
          userId={viewProfile}
          onClose={() => setViewProfile(null)}
          onStartChat={(conv) => { setViewProfile(null); onStartChat(conv); }}
          onFriendAdded={fetchContacts}
        />
      )}

      {/* Create group modal */}
      {showCreateGroup && (
        <CreateGroupModal
          contacts={contacts}
          onClose={() => setShowCreateGroup(false)}
          onCreated={(conv) => { setShowCreateGroup(false); fetchGroups(); onStartChat(conv); }}
        />
      )}
    </div>
  );
}

function CreateGroupModal({ contacts, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const toggle = (id) => setSelected(prev => {
    const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s;
  });

  const create = async () => {
    if (!name.trim()) return alert('请输入群名称');
    if (selected.size === 0) return alert('请至少选择一位成员');
    setLoading(true);
    try {
      const { data } = await axios.post('/api/messages/conversation/group', { name: name.trim(), memberIds: [...selected] });
      onCreated({ id: data.conversationId, type: 'group', name: name.trim(), avatar: '', members: [] });
    } catch (err) { alert(err.response?.data?.error || '创建失败'); }
    setLoading(false);
  };

  return (
    <div className="wc-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="wc-modal wide">
        <div className="wc-modal-header">
          <span className="wc-modal-title">发起群聊</span>
          <button className="wc-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="wc-modal-body">
          <div className="wc-modal-field">
            <label>群名称</label>
            <input className="wc-modal-input" placeholder="请输入群名称" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div style={{ padding: '4px 20px 8px', fontSize: 13, color: '#888' }}>选择联系人（已选 {selected.size} 人）</div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {contacts.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#B2B2B2', fontSize: 13 }}>暂无联系人</div>}
            {contacts.map(c => (
              <div key={c.id} className="wc-group-member-item" onClick={() => toggle(c.id)}>
                <div className={`wc-group-check${selected.has(c.id) ? ' checked' : ''}`}>{selected.has(c.id) ? '✓' : ''}</div>
                <Avatar src={c.avatar} name={c.remark || c.username} size={38} />
                <div>
                  <div style={{ fontSize: 15 }}>{c.remark || c.username}</div>
                  {c.remark && <div style={{ fontSize: 12, color: '#B2B2B2' }}>{c.username}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="wc-modal-footer">
          <button className="wc-modal-btn secondary" onClick={onClose}>取消</button>
          <button className="wc-modal-btn primary" onClick={create} disabled={loading || selected.size === 0}>
            {loading ? '创建中...' : `创建群聊 (${selected.size}人)`}
          </button>
        </div>
      </div>
    </div>
  );
}
