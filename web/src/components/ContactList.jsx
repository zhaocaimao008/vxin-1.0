import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import UserProfile from './UserProfile';
import { GroupAvatar } from './GroupInfo';
import { useSocket } from '../contexts/SocketContext';
import AddFriendModal from './AddFriendModal';

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
            {/* 新的朋友：仅在有待处理请求时出现（无请求则隐藏，保持纯净） */}
            {requests.length > 0 && (
              <div className="wc-contact-item" style={{ cursor: 'pointer' }} onClick={() => setTab('requests')}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: '#07C160', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wc-contact-item-name">新的朋友</div>
                </div>
                <span style={{ background: '#FA5151', color: '#fff', fontSize: 11, minWidth: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>{requests.length}</span>
              </div>
            )}

            {/* 文件传输助手 */}
            <EntryRow
              icon={<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>}
              color="#10AEFF" label="文件传输助手" badge={0}
              onClick={async () => {
                try {
                  const { data } = await axios.get('/api/messages/file-helper');
                  onStartChat({ id: data.conversationId, type: 'filehelper', name: '文件传输助手', avatar: '' });
                } catch {}
              }}
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
          onFriendDeleted={() => { setViewProfile(null); fetchContacts(); }}
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
