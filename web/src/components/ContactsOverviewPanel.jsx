import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import UserProfile from './UserProfile';
import './ContactsOverviewPanel.css';
import { useSocketCore } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { showToast, showConfirm } from '../utils/toast';
import { seedOnlineIds, filterContactsByStatus } from '../utils/contactsStatus';

const IcoMessage = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z" /></svg>
);
const IcoVideoCall = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg>
);
const IcoMore = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
);

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'online', label: '在线' },
  { key: 'offline', label: '离线' },
];

// 桌面 Web(≥768)专属的联系人「全部联系人」详情面板，对齐 Web联系人页.jpg 右栏。
// 独立拉取数据而非复用 ContactList 内部 state：ContactList 服务全平台单栏视图，
// 避免为了共享几行状态牵动它现有、已在跑的逻辑。
export default function ContactsOverviewPanel({ onStartChat, onStartCall }) {
  const [contacts, setContacts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [filter, setFilter] = useState('all');
  const [viewProfile, setViewProfile] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, contact }
  const [busyId, setBusyId] = useState(null);
  const { socket } = useSocketCore();
  const { user } = useAuth();

  const fetchContacts = useCallback(() =>
    axios.get('/api/users/contacts').then(r => {
      const list = Array.isArray(r.data) ? r.data : [];
      setContacts(list);
      setOnlineIds(prev => seedOnlineIds(prev, list));
    }).catch(() => setContacts([]))
      .finally(() => setLoaded(true)), []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  useEffect(() => {
    if (!socket) return;
    const onOnline = ({ userId }) => setOnlineIds(prev => new Set([...prev, userId]));
    const onOffline = ({ userId }) => setOnlineIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
    socket.on('user_online', onOnline);
    socket.on('user_offline', onOffline);
    return () => {
      socket.off('user_online', onOnline);
      socket.off('user_offline', onOffline);
    };
  }, [socket]);

  useEffect(() => {
    const handler = () => fetchContacts();
    window.addEventListener('vxin:remark-changed', handler);
    return () => window.removeEventListener('vxin:remark-changed', handler);
  }, [fetchContacts]);

  const filtered = useMemo(() => filterContactsByStatus(contacts, onlineIds, filter), [contacts, onlineIds, filter]);
  const onlineCount = useMemo(() => contacts.filter(c => onlineIds.has(c.id)).length, [contacts, onlineIds]);

  const openMenu = (e, contact) => {
    e.stopPropagation();
    const MENU_W = 160, MENU_H = 160;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - MENU_W);
    const y = Math.min(rect.bottom + 4, window.innerHeight - MENU_H);
    setCtxMenu({ x: Math.max(8, x), y: Math.max(8, y), contact });
  };
  const closeMenu = () => setCtxMenu(null);

  const messageContact = async (contact) => {
    try {
      const { data } = await axios.post('/api/messages/conversation/private', { userId: contact.id });
      onStartChat?.({ id: data.conversationId, type: 'private', name: contact.remark || contact.username, avatar: contact.avatar, otherUser: contact });
    } catch (e) {
      showToast(e.response?.data?.error || '打开会话失败，请重试', 'error');
    }
  };

  const callContact = (contact) => {
    const remoteUser = { id: contact.id, name: contact.remark || contact.username, avatar: contact.avatar };
    socket?.emit('call:request', {
      to: contact.id,
      type: 'video',
      caller: { id: user.id, name: user.username, avatar: user.avatar },
    });
    onStartCall?.({ type: 'video', direction: 'outgoing', remoteUser, remoteId: contact.id });
  };

  const blockContact = async (contact) => {
    closeMenu();
    if (!await showConfirm(`确认将「${contact.remark || contact.username}」加入黑名单？`)) return;
    setBusyId(contact.id);
    try {
      await axios.post(`/api/users/block/${contact.id}`);
      showToast('已加入黑名单');
    } catch (e) {
      showToast(e.response?.data?.error || '操作失败，请重试', 'error');
    }
    setBusyId(null);
  };

  const deleteContact = async (contact) => {
    closeMenu();
    if (!await showConfirm(`确认删除好友「${contact.remark || contact.username}」？`)) return;
    setBusyId(contact.id);
    try {
      await axios.delete(`/api/users/contacts/${contact.id}`);
      setContacts(prev => prev.filter(c => c.id !== contact.id));
    } catch (e) {
      showToast(e.response?.data?.error || '删除失败，请重试', 'error');
    }
    setBusyId(null);
  };

  return (
    <div className="cop-panel">
      <div className="cop-header">
        <div className="cop-title">全部联系人（{contacts.length}）</div>
      </div>
      <div className="cop-tabs" role="tablist" aria-label="联系人状态筛选">
        {TABS.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={filter === t.key}
            className={`cop-tab${filter === t.key ? ' active' : ''}`}
            onClick={() => setFilter(t.key)}>
            {t.label}{t.key === 'online' && onlineCount > 0 ? ` ${onlineCount}` : ''}
          </button>
        ))}
      </div>

      <div className="cop-list">
        {!loaded && (
          <div aria-hidden="true" className="cop-skeleton-pad">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="cop-skel-row" />)}
          </div>
        )}
        {loaded && filtered.length === 0 && (
          <div className="cop-empty" role="status">
            {filter === 'all' ? '暂无联系人' : filter === 'online' ? '暂无在线联系人' : '暂无离线联系人'}
          </div>
        )}
        {filtered.map(c => {
          const online = onlineIds.has(c.id);
          return (
            <div key={c.id} className="cop-row" onClick={() => setViewProfile(c.id)}
              role="button" tabIndex={0}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setViewProfile(c.id))}>
              <Avatar src={c.avatar} name={c.remark || c.username} size={44} style={{ borderRadius: 'var(--radius-sm)' }} />
              <div className="cop-info">
                <div className="cop-name">{c.remark || c.username}</div>
                <div className="cop-username">{c.username}</div>
                {c.bio && <div className="cop-bio">{c.bio}</div>}
              </div>
              <div className={`cop-status${online ? ' online' : ''}`}>
                <span className="cop-status-dot" />
                {online ? '在线' : '离线'}
              </div>
              <div className="cop-actions">
                <button type="button" className="cop-action-btn" title="发消息" aria-label="发消息"
                  disabled={busyId === c.id}
                  onClick={e => { e.stopPropagation(); messageContact(c); }}><IcoMessage /></button>
                <button type="button" className="cop-action-btn" title="视频通话" aria-label="视频通话"
                  disabled={busyId === c.id}
                  onClick={e => { e.stopPropagation(); callContact(c); }}><IcoVideoCall /></button>
                <button type="button" className="cop-action-btn" title="更多" aria-label="更多"
                  disabled={busyId === c.id}
                  onClick={e => openMenu(e, c)}><IcoMore /></button>
              </div>
            </div>
          );
        })}
      </div>

      {ctxMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 'calc(var(--z-top) - 1)' }}
            onClick={closeMenu} onContextMenu={e => { e.preventDefault(); closeMenu(); }} />
          <div className="wc-ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y, zIndex: 'var(--z-top)' }}
            role="menu" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); } }}>
            <button type="button" className="wc-ctx-item" role="menuitem"
              onClick={() => { closeMenu(); setViewProfile(ctxMenu.contact.id); }}>查看资料</button>
            <button type="button" className="wc-ctx-item" role="menuitem"
              onClick={() => { closeMenu(); messageContact(ctxMenu.contact); }}>发消息</button>
            <div className="wc-ctx-divider" />
            <button type="button" className="wc-ctx-item" role="menuitem"
              onClick={() => blockContact(ctxMenu.contact)}>加入黑名单</button>
            <button type="button" className="wc-ctx-item danger" role="menuitem"
              onClick={() => deleteContact(ctxMenu.contact)}>删除好友</button>
          </div>
        </>
      )}

      {viewProfile && (
        <UserProfile
          userId={viewProfile}
          onClose={() => setViewProfile(null)}
          onStartChat={(conv) => { setViewProfile(null); onStartChat?.(conv); }}
          onFriendAdded={fetchContacts}
          onFriendDeleted={() => { setViewProfile(null); fetchContacts(); }}
        />
      )}
    </div>
  );
}
