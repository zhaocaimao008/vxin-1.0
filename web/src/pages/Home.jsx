import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import ContactList from '../components/ContactList';
import Discover from '../components/Discover';
import Profile from '../components/Profile';
import Avatar from '../components/Avatar';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

function WcEmpty() {
  return (
    <div className="wc-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#FFFFFF' }}>
      <svg viewBox="0 0 80 64" style={{ width: 80, height: 64, marginBottom: 18 }}>
        {/* 企业风格插图：消息气泡 + 对勾 */}
        <rect x="4" y="8" width="50" height="34" rx="8" fill="#EEF2F8"/>
        <rect x="8" y="15" width="30" height="3" rx="1.5" fill="#B8C4D4"/>
        <rect x="8" y="22" width="22" height="3" rx="1.5" fill="#B8C4D4"/>
        <rect x="8" y="29" width="26" height="3" rx="1.5" fill="#B8C4D4"/>
        <path d="M4 42l8-8" stroke="#EEF2F8" strokeWidth="2"/>
        <circle cx="60" cy="46" r="16" fill="#1A2033"/>
        <path d="M53 46l5 5 9-9" stroke="#07C160" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <p style={{ fontSize: 14, fontWeight: 500, color: '#1F2D3D', marginBottom: 6 }}>选择一个会话开始聊天</p>
      <p style={{ fontSize: 12, color: '#7A8694' }}>安全、高效的企业级通讯</p>
    </div>
  );
}

/* ── SVG Icons ── */
const IcoChat = () => (
  <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>
);
const IcoContacts = () => (
  <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
);
const IcoDiscover = () => (
  <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.65-11.15l-7.07 2.83-2.83 7.07 7.07-2.83 2.83-7.07zM12 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>
);
const IcoProfile = () => (
  <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
);
const IcoSearch = () => (
  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'currentColor' }}>
    <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
  </svg>
);
const IcoQR = () => (
  <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'currentColor' }}>
    <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM13 13h2v2h-2zM15 15h2v2h-2zM13 17h2v2h-2zM17 13h2v2h-2zM19 15h2v2h-2zM17 17h2v2h-2zM19 19h2v2h-2zM15 19h2v2h-2z"/>
  </svg>
);
const IcoAdd = () => (
  <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'currentColor' }}>
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
  </svg>
);
const IcoAddAccount = () => (
  <svg viewBox="0 0 24 24"><path d="M13 8c0-2.21-1.79-4-4-4S5 5.79 5 8s1.79 4 4 4 4-1.79 4-4zm-2 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-4 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm8 0v3h3v3h2v-3h3v-2h-3v-3h-2v3h-3z"/></svg>
);

const TABS = [
  { key: 'chats',    Icon: IcoChat,     label: '消息' },
  { key: 'contacts', Icon: IcoContacts, label: '通讯录' },
  { key: 'discover', Icon: IcoDiscover, label: '发现' },
  { key: 'profile',  Icon: IcoProfile,  label: '我' },
];

/* ── 左上角头像 — 点击展开账号切换/添加下拉面板 ── */
function AccountSwitcher({ onNavigate }) {
  const { user, accounts, login, switchAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ phone: '', password: '' });
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const phoneRef = useRef(null);
  const containerRef = useRef(null);
  const letter = (user?.username || '?')[0].toUpperCase();

  /* 点外部关闭，不用全屏遮罩（遮罩会挡住头像按钮本身） */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) { setShowForm(false); setErr(''); setForm({ phone: '', password: '' }); }
  }, [open]);

  const doSwitch = (id) => {
    if (id === user?.id) return;
    if (switchAccount(id)) window.location.reload();
  };

  const doAdd = async (e) => {
    e.preventDefault();
    if (!form.phone || !form.password) { setErr('请填写手机号和密码'); return; }
    setErr(''); setSubmitting(true);
    try {
      const { data } = await axios.post('/api/auth/login', form);
      login(data.token, data.user);
      window.location.reload();
    } catch (ex) {
      setErr(ex.response?.data?.error || '手机号或密码错误');
      setSubmitting(false);
    }
  };

  const toggleForm = (e) => {
    e.stopPropagation();
    setShowForm(v => !v);
    setErr('');
    setForm({ phone: '', password: '' });
    if (!showForm) setTimeout(() => phoneRef.current?.focus(), 80);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* 头像按钮 */}
      <div className="wc-sidebar-avatar" onClick={() => setOpen(v => !v)} title="账号切换"
        style={{ cursor: 'pointer', width: '100%' }}>
        <div className="wc-sidebar-avatar-inner"
          style={{ outline: open ? '2.5px solid rgba(255,255,255,.9)' : '2.5px solid transparent', outlineOffset: 2, transition: 'outline-color .15s', overflow: 'hidden' }}>
          {user?.avatar
            ? <img src={user.avatar} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
            : letter
          }
        </div>
      </div>

      {/* 下拉面板（fixed 定位，不受 sidebar overflow 影响） */}
      {open && (
        <div style={{
          position: 'fixed',
          left: 'calc(var(--nav-w) + 6px)',
          top: 8,
          width: 260,
          zIndex: 300,
          borderRadius: 14,
          background: 'var(--glass-bg-strong)',
          backdropFilter: 'blur(28px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.3)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 8px 32px rgba(0,0,0,.22)',
          overflow: 'hidden',
        }}>

          {/* 账号列表 */}
          {accounts.map((a) => {
            const active = a.id === user?.id;
            return (
              <div key={a.id} onClick={() => { if (!active) doSwitch(a.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '11px 14px',
                  cursor: active ? 'default' : 'pointer',
                  borderBottom: '1px solid var(--border-color)',
                  background: active ? 'rgba(7,193,96,.06)' : 'transparent',
                  transition: 'background .12s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = active ? 'rgba(7,193,96,.06)' : 'transparent'; }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar src={a.user?.avatar} name={a.user?.username} size={38} />
                  {active && (
                    <div style={{ position: 'absolute', bottom: -1, right: -1, width: 13, height: 13, borderRadius: '50%', background: '#07C160', border: '2px solid var(--glass-bg-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 24 24" style={{ width: 7, height: 7, fill: '#fff' }}><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: active ? 500 : 400, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.user?.username || '未命名'}
                  </div>
                  {a.user?.phone && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>{a.user.phone}</div>}
                </div>
                {active
                  ? <span style={{ fontSize: 11, color: '#07C160', background: 'rgba(7,193,96,.12)', padding: '2px 7px', borderRadius: 99, flexShrink: 0 }}>当前</span>
                  : <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>切换</span>
                }
              </div>
            );
          })}

          {/* 添加账户行 */}
          <div onClick={toggleForm}
            style={{
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '11px 14px', cursor: 'pointer',
              borderBottom: showForm ? '1px solid var(--border-color)' : 'none',
              transition: 'background .12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', border: `1.5px dashed ${showForm ? '#07C160' : 'var(--text-tertiary)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'border-color .15s' }}>
              <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, fill: showForm ? '#07C160' : 'var(--text-tertiary)', transition: 'fill .15s' }}>
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </div>
            <span style={{ flex: 1, fontSize: 14, color: showForm ? '#07C160' : 'var(--text-primary)', transition: 'color .15s' }}>添加账户</span>
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'var(--text-tertiary)', transform: showForm ? 'rotate(90deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}>
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
          </div>

          {/* 添加账户表单 */}
          {showForm && (
            <div style={{ padding: '4px 14px 14px' }}>
              <div style={{ margin: '8px 0', padding: '7px 10px', background: 'rgba(7,193,96,.08)', borderRadius: 8, border: '1px solid rgba(7,193,96,.18)' }}>
                <span style={{ fontSize: 12, color: '#07C160', lineHeight: 1.5 }}>添加后旧账号不会退出，可随时切换</span>
              </div>
              <form onSubmit={doAdd} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <input ref={phoneRef} type="tel" placeholder="手机号" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  style={{ padding: '10px 12px', borderRadius: 9, border: '1px solid var(--border-color)', fontSize: 14, background: 'var(--bg-search)', color: 'var(--text-primary)', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = '#07C160'}
                  onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
                <input type="password" placeholder="密码" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  style={{ padding: '10px 12px', borderRadius: 9, border: '1px solid var(--border-color)', fontSize: 14, background: 'var(--bg-search)', color: 'var(--text-primary)', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = '#07C160'}
                  onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
                {err && <div style={{ padding: '5px 9px', background: 'rgba(250,81,81,.08)', borderRadius: 7, border: '1px solid rgba(250,81,81,.2)', color: '#FA5151', fontSize: 12 }}>{err}</div>}
                <button type="submit" disabled={submitting}
                  style={{ padding: '11px 0', background: submitting ? 'rgba(7,193,96,.6)' : '#07C160', color: '#fff', borderRadius: 9, fontSize: 14, fontWeight: 600, letterSpacing: .3 }}>
                  {submitting ? '登录中...' : '登录并切换'}
                </button>
              </form>
            </div>
          )}

          {/* 个人信息入口 */}
          <div onClick={() => { setOpen(false); onNavigate(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px', cursor: 'pointer',
              borderTop: '1px solid var(--border-color)',
              transition: 'background .12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
            <svg viewBox="0 0 24 24" style={{ width: 15, height: 15, fill: 'var(--text-secondary)', flexShrink: 0 }}>
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>个人信息与设置</span>
            <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, fill: 'var(--text-tertiary)', flexShrink: 0 }}>
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Create Group Modal ── */
function CreateGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get('/api/users/contacts').then(r => setContacts(r.data)).catch(() => {});
  }, []);

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

export default function Home() {
  const [tab, setTab] = useState('chats');
  const [activeConv, setActiveConv] = useState(null);
  const [unread, setUnread] = useState({});
  const [friendReqCount, setFriendReqCount] = useState(0);
  const [search, setSearch] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [addFriendRequest, setAddFriendRequest] = useState(0);
  const { socket, reconnectCount, registerUnreadCleared } = useSocket();
  const { user } = useAuth();
  const activeConvIdRef = useRef(null);
  useEffect(() => { activeConvIdRef.current = activeConv?.id ?? null; }, [activeConv?.id]);

  useEffect(() => {
    const handler = (e) => {
      const { conversationId } = e.detail || {};
      if (!conversationId) return;
      axios.get('/api/messages/conversations').then(r => {
        const conv = r.data.find(c => c.id === conversationId);
        if (conv) handleSelectConv(conv);
      }).catch(() => {});
    };
    window.addEventListener('vxin:open-conversation', handler);
    return () => window.removeEventListener('vxin:open-conversation', handler);
  }, []);

  useEffect(() => {
    axios.get('/api/users/friend-requests').then(r => setFriendReqCount(r.data.length));
  }, []);

  const fetchUnreadCounts = useCallback(() => {
    axios.get('/api/messages/unread-counts').then(({ data }) => setUnread(data)).catch(() => {});
  }, []);

  useEffect(() => { fetchUnreadCounts(); }, [fetchUnreadCounts]);
  useEffect(() => { if (reconnectCount === 0) return; fetchUnreadCounts(); }, [reconnectCount, fetchUnreadCounts]);
  useEffect(() => {
    window.addEventListener('focus', fetchUnreadCounts);
    return () => window.removeEventListener('focus', fetchUnreadCounts);
  }, [fetchUnreadCounts]);

  useEffect(() => {
    registerUnreadCleared(({ conversationId }) => {
      setUnread(prev => {
        if (!prev[conversationId]) return prev;
        const next = { ...prev }; delete next[conversationId]; return next;
      });
    });
  }, [registerUnreadCleared]);

  useEffect(() => {
    if (!socket) return;
    const onMsg = (msg) => {
      setUnread(prev => {
        if (msg.conversation_id === activeConvIdRef.current) return prev;
        return { ...prev, [msg.conversation_id]: (prev[msg.conversation_id] || 0) + 1 };
      });
    };
    const onFriendReq = () => setFriendReqCount(prev => prev + 1);
    socket.on('new_message', onMsg);
    socket.on('new_friend_request', onFriendReq);
    return () => { socket.off('new_message', onMsg); socket.off('new_friend_request', onFriendReq); };
  }, [socket]);

  const handleSelectConv = useCallback((conv) => {
    setActiveConv(conv);
    setUnread(prev => ({ ...prev, [conv.id]: 0 }));
    setTab('chats');
  }, []);

  const handleTabChange = (t) => {
    setTab(t);
    setSearch('');
    if (t === 'contacts') setFriendReqCount(0);
  };

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  const badges = { chats: totalUnread, contacts: friendReqCount };

  const isMobile = window.innerWidth < 768;
  const [showPanel, setShowPanel] = useState(true);
  const [showChat, setShowChat] = useState(false);

  const handleMobileSelectConv = useCallback((conv) => {
    handleSelectConv(conv);
    if (isMobile) { setShowPanel(false); setShowChat(true); }
  }, [handleSelectConv, isMobile]);

  const handleMobileBack = useCallback(() => { setShowPanel(true); setShowChat(false); }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) { setShowPanel(true); setShowChat(false); }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const renderMain = () => {
    switch (tab) {
      case 'chats':
        return <ChatList onSelectConv={isMobile ? handleMobileSelectConv : handleSelectConv} activeConvId={activeConv?.id} unread={unread} searchQuery={search} />;
      case 'contacts':
        return <ContactList onStartChat={(conv) => handleSelectConv(conv)} searchQuery={search} addFriendRequest={addFriendRequest} />;
      case 'discover':
        return <Discover />;
      case 'profile':
        return <Profile />;
      default:
        return null;
    }
  };

  const handleCreateGroup = () => {
    setShowAddMenu(false);
    setShowCreateGroup(true);
  };

  const handleAddFriend = () => {
    setShowAddMenu(false);
    if (tab !== 'contacts') handleTabChange('contacts');
    setAddFriendRequest(n => n + 1);
  };

  return (
    <div className={`wc-app${isMobile ? ' wc-mobile' : ''}`}>

      {/* 左侧导航栏 */}
      <div className="wc-sidebar">
        <AccountSwitcher onNavigate={() => handleTabChange('profile')} />
        {/* Tab 按钮紧跟头像，不用 spacer 下推，防止小屏被裁切 */}
        <div className="wc-sidebar-btns">
          {TABS.map(({ key, Icon, label }) => {
            const count = badges[key] || 0;
            return (
              <div key={key} className={`wc-sidebar-btn${tab === key ? ' active' : ''}`}
                onClick={() => handleTabChange(key)} title={label}>
                <div className="icon"><Icon /></div>
                <span className="wc-sidebar-label">{label}</span>
                {count > 0 && (
                  <span className="wc-sidebar-badge">{count > 99 ? '99+' : count}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="wc-main">

        {/* 面板区（固定顶栏 + 内容） */}
        {(!isMobile || showPanel) && (
          <div className="wc-panel">

            {/* 固定顶栏：搜索 + 二维码 + 添加 */}
            <div className="wc-panel-topbar">
              <div className="wc-search">
                <span className="wc-search-icon"><IcoSearch /></span>
                <input
                  placeholder="搜索"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && tab === 'contacts' && setAddFriendRequest(n => n + 1)}
                />
                {search && (
                  <button style={{ color: 'var(--text-tertiary)', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
                    onClick={() => setSearch('')}>✕</button>
                )}
              </div>

              {/* 二维码按钮 */}
              <button className="wc-icon-btn" title="我的二维码" onClick={() => setShowQR(true)}>
                <IcoQR />
              </button>

              {/* 添加按钮 */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button className="wc-icon-btn" title="发起" onClick={() => setShowAddMenu(v => !v)}>
                  <IcoAdd />
                </button>
                {showAddMenu && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowAddMenu(false)} />
                    <div className="wc-ctx-menu" style={{ position: 'absolute', right: 0, top: 34, minWidth: 148, zIndex: 100 }}>
                      <div className="wc-ctx-item" onClick={handleCreateGroup}>
                        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'currentColor', flexShrink: 0 }}>
                          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                        </svg>
                        发起群聊
                      </div>
                      <div className="wc-ctx-divider" />
                      <div className="wc-ctx-item" onClick={handleAddFriend}>
                        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'currentColor', flexShrink: 0 }}>
                          <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                        添加朋友
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="wc-panel-content">
              {renderMain()}
            </div>
          </div>
        )}

        {/* 聊天区 */}
        {(!isMobile || showChat) && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeConv
              ? <ChatWindow conversation={activeConv} onClose={isMobile ? handleMobileBack : () => setActiveConv(null)} />
              : <WcEmpty />
            }
          </div>
        )}
      </div>

      {/* 二维码弹窗 */}
      {showQR && (
        <div className="wc-modal-overlay" onClick={() => setShowQR(false)}>
          <div className="wc-modal" style={{ maxWidth: 280, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div className="wc-modal-header">
              <span className="wc-modal-title">我的二维码</span>
              <button className="wc-modal-close" onClick={() => setShowQR(false)}>✕</button>
            </div>
            <div className="wc-modal-body" style={{ padding: '20px 20px 24px' }}>
              <img src="/api/users/me/qrcode" alt="我的二维码"
                style={{ width: 200, height: 200, borderRadius: 8, display: 'block', margin: '0 auto' }} />
              <p style={{ marginTop: 14, color: 'var(--text-tertiary)', fontSize: 13 }}>扫描二维码添加我为好友</p>
            </div>
          </div>
        </div>
      )}

      {/* 发起群聊弹窗 */}
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={(conv) => { setShowCreateGroup(false); handleSelectConv(conv); }}
        />
      )}
    </div>
  );
}
