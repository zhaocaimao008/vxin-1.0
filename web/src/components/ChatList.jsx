import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import { GroupAvatar } from './GroupInfo';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { format } from '../utils/time';

export default function ChatList({ onSelectConv, activeConvId, unread = {} }) {
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  const [ctxMenu, setCtxMenu] = useState(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [contacts, setContacts] = useState([]);
  const { socket } = useSocket();
  const { user } = useAuth();

  const fetchConvs = useCallback(async () => {
    const { data } = await axios.get('/api/messages/conversations');
    setConversations(data);
  }, []);

  useEffect(() => { fetchConvs(); }, [fetchConvs]);

  useEffect(() => {
    if (!socket) return;
    const onMsg = (msg) => {
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === msg.conversation_id);
        if (idx === -1) { fetchConvs(); return prev; }
        const updated = [...prev];
        updated[idx] = { ...updated[idx], lastMessage: msg.content, lastMessageType: msg.type, lastTime: msg.created_at, lastSenderName: msg.senderName };
        return [...updated].sort((a, b) => (b.pinned - a.pinned) || ((b.lastTime || 0) - (a.lastTime || 0)));
      });
    };
    const onNewConv = (conv) => {
      setConversations(prev => {
        if (prev.find(c => c.id === conv.id)) return prev;
        socket.emit('join_conversation', { conversationId: conv.id });
        return [conv, ...prev];
      });
    };
    socket.on('new_message', onMsg);
    socket.on('new_conversation', onNewConv);
    return () => { socket.off('new_message', onMsg); socket.off('new_conversation', onNewConv); };
  }, [socket, fetchConvs]);

  const pin = async (conv, pinned) => {
    await axios.post(`/api/messages/conversation/${conv.id}/pin`, { pinned });
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, pinned: pinned ? 1 : 0 } : c)
      .sort((a, b) => (b.pinned - a.pinned) || ((b.lastTime || 0) - (a.lastTime || 0))));
    setCtxMenu(null);
  };

  const mute = async (conv, muted) => {
    await axios.post(`/api/messages/conversation/${conv.id}/mute`, { muted });
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, muted: muted ? 1 : 0 } : c));
    setCtxMenu(null);
  };

  const filtered = conversations.filter(c => (c.name || '').toLowerCase().includes(search.toLowerCase()));

  const previewMsg = (conv) => {
    if (!conv.lastMessage) return '';
    if (conv.lastMessageType === 'image') return '[图片]';
    if (conv.lastMessageType === 'voice') return '[语音]';
    if (conv.lastMessageType === 'file') return '[文件]';
    if (conv.type === 'group' && conv.lastSenderName && conv.lastSenderName !== user?.username)
      return `${conv.lastSenderName}: ${conv.lastMessage}`;
    return conv.lastMessage;
  };

  const openCreateGroup = () => {
    axios.get('/api/users/contacts').then(r => { setContacts(r.data); setShowCreateGroup(true); });
    setShowNewMenu(false);
  };

  const IcoAdd = () => (
    <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'currentColor' }}>
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
    </svg>
  );
  const IcoSearch = () => (
    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'currentColor' }}>
      <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    </svg>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-panel)' }}>
      <div className="wc-panel-header">
        <span className="wc-panel-title">微信</span>
        <div style={{ position: 'relative' }}>
          <button className="wc-icon-btn" title="发起聊天" onClick={() => setShowNewMenu(v => !v)}>
            <IcoAdd />
          </button>
          {showNewMenu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowNewMenu(false)} />
              <div className="wc-ctx-menu" style={{ position: 'absolute', right: 0, top: 30, minWidth: 148 }}>
                <div className="wc-ctx-item" onClick={openCreateGroup}>
                  <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'currentColor', flexShrink: 0 }}><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                  发起群聊
                </div>
                <div className="wc-ctx-divider" />
                <div className="wc-ctx-item" onClick={() => setShowNewMenu(false)}>
                  <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'currentColor', flexShrink: 0 }}><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  添加朋友
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="wc-search-wrap">
        <div className="wc-search">
          <span className="wc-search-icon"><IcoSearch /></span>
          <input placeholder="搜索" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="wc-list">
        {filtered.map(conv => {
          const count = unread[conv.id] || 0;
          return (
            <div
              key={conv.id}
              className={`wc-chat-item${conv.id === activeConvId ? ' active' : ''}${conv.pinned ? ' pinned' : ''}`}
              onClick={() => onSelectConv(conv)}
              onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, conv }); }}
              style={{ background: conv.pinned && conv.id !== activeConvId ? '#F9F9F9' : undefined }}
            >
              <div className="wc-chat-item-avatar">
                {conv.type === 'group'
                  ? <GroupAvatar members={conv.members || []} size={46} />
                  : <Avatar src={conv.avatar} name={conv.name} size={46} />
                }
                {count > 0 && <span className={`wc-chat-item-badge${conv.muted ? ' muted' : ''}`}>{count > 99 ? '99+' : count}</span>}
              </div>
              <div className="wc-chat-item-info">
                <div className="wc-chat-item-row1">
                  <span className="wc-chat-item-name">{conv.name || '未知'}</span>
                  <span className="wc-chat-item-time">{conv.lastTime ? format(conv.lastTime * 1000) : ''}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {conv.muted && (
                    <svg viewBox="0 0 24 24" style={{ width: 11, height: 11, fill: 'var(--text-tertiary)', flexShrink: 0 }}>
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                    </svg>
                  )}
                  <span className="wc-chat-item-preview">{previewMsg(conv)}</span>
                </div>
              </div>
              {conv.pinned && (
                <svg viewBox="0 0 24 24" style={{ position: 'absolute', top: 7, right: 8, width: 10, height: 10, fill: 'var(--text-tertiary)' }}>
                  <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>
                </svg>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#B2B2B2', fontSize: 13 }}>暂无聊天</div>
        )}
      </div>

      {ctxMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setCtxMenu(null)} />
          <div className="wc-ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999 }}>
            <div className="wc-ctx-item" onClick={() => pin(ctxMenu.conv, !ctxMenu.conv.pinned)}>
              {ctxMenu.conv.pinned ? '取消置顶' : '置顶聊天'}
            </div>
            <div className="wc-ctx-item" onClick={() => mute(ctxMenu.conv, !ctxMenu.conv.muted)}>
              {ctxMenu.conv.muted ? '取消免打扰' : '消息免打扰'}
            </div>
          </div>
        </>
      )}

      {/* Create group from chat list */}
      {showCreateGroup && (
        <CreateGroupFromChatList
          contacts={contacts}
          onClose={() => setShowCreateGroup(false)}
          onCreated={(conv) => { setShowCreateGroup(false); onSelectConv(conv); }}
        />
      )}
    </div>
  );
}

function CreateGroupFromChatList({ contacts, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const toggle = (id) => setSelected(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });

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
                <span style={{ fontSize: 15 }}>{c.remark || c.username}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="wc-modal-footer">
          <button className="wc-modal-btn secondary" onClick={onClose}>取消</button>
          <button className="wc-modal-btn primary" onClick={create} disabled={loading || selected.size === 0}>
            {loading ? '创建中...' : `创建 (${selected.size}人)`}
          </button>
        </div>
      </div>
    </div>
  );
}
