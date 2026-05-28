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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="wc-panel-header">
        <span className="wc-panel-title">微信</span>
        <div style={{ position: 'relative' }}>
          <button className="wc-icon-btn" title="发起聊天" onClick={() => setShowNewMenu(v => !v)} style={{ fontSize: 22, color: '#555' }}>⊕</button>
          {showNewMenu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowNewMenu(false)} />
              <div style={{ position: 'absolute', right: 0, top: 34, background: '#3A3A3C', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', overflow: 'hidden', zIndex: 100, minWidth: 140 }}>
                <div className="wc-ctx-item" onClick={openCreateGroup}>👥 发起群聊</div>
                <div className="wc-ctx-divider" />
                <div className="wc-ctx-item" onClick={() => { setShowNewMenu(false); }}>➕ 添加朋友</div>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="wc-search-wrap">
        <div className="wc-search">
          <span className="wc-search-icon">🔍</span>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {conv.muted && <span style={{ fontSize: 10, color: '#B2B2B2' }}>🔕</span>}
                  <span className="wc-chat-item-preview">{previewMsg(conv)}</span>
                </div>
              </div>
              {conv.pinned && <span style={{ position: 'absolute', top: 6, right: 8, fontSize: 9, color: '#B2B2B2' }}>📌</span>}
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
              {ctxMenu.conv.pinned ? '取消置顶' : '📌 置顶'}
            </div>
            <div className="wc-ctx-item" onClick={() => mute(ctxMenu.conv, !ctxMenu.conv.muted)}>
              {ctxMenu.conv.muted ? '取消免打扰' : '🔕 免打扰'}
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
