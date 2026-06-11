import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import ContactList from '../components/ContactList';
import Profile from '../components/Profile';
import Moments from '../components/Moments';
import CallHistory from '../components/CallHistory';
import Collections from '../components/Collections';
import GlobalSearch from '../components/GlobalSearch';
import AddFriendModal from '../components/AddFriendModal';
import Avatar from '../components/Avatar';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { usePushNotification } from '../hooks/usePushNotification';

function WcEmpty() {
  return (
    <div className="wc-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <svg viewBox="0 0 80 64" style={{ width: 80, height: 64, marginBottom: 18 }}>
        <rect x="4" y="8" width="50" height="34" rx="8" fill="#EEF2F8"/>
        <rect x="8" y="15" width="30" height="3" rx="1.5" fill="#B8C4D4"/>
        <rect x="8" y="22" width="22" height="3" rx="1.5" fill="#B8C4D4"/>
        <rect x="8" y="29" width="26" height="3" rx="1.5" fill="#B8C4D4"/>
        <path d="M4 42l8-8" stroke="#EEF2F8" strokeWidth="2"/>
        <circle cx="60" cy="46" r="16" fill="#1A2033"/>
        <path d="M53 46l5 5 9-9" stroke="#07C160" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>选择一个会话开始聊天</p>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>安全、高效的企业级通讯</p>
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
const IcoSettings = () => (
  <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
);

const IcoMoments = () => (
  <svg viewBox="0 0 24 24"><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>
);
const IcoCall = () => (
  <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
);
const IcoStar = () => (
  <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
);

const TABS = [
  { key: 'chats',     Icon: IcoChat,     label: '消息' },
  { key: 'contacts',  Icon: IcoContacts, label: '通讯录' },
  { key: 'moments',   Icon: IcoMoments,  label: '朋友圈', feature: 'moments' },
  { key: 'calls',     Icon: IcoCall,     label: '通话' },
  { key: 'favorites', Icon: IcoStar,     label: '收藏',   feature: 'collect' },
  { key: 'settings',  Icon: IcoSettings, label: '设置' },
];


/* ── 左上角头像 — 点击展开账号切换/添加下拉面板 ── */
function AccountSwitcher() {
  const { user, accounts, login, switchAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
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
      login(data.user);
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

          {/* 个人资料卡片 */}
          <div onClick={() => setShowProfile(v => !v)}
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
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>个人资料</span>
            <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, fill: 'var(--text-tertiary)', flexShrink: 0, transform: showProfile ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
          </div>

          {/* 资料详情（展开时显示） */}
          {showProfile && (
            <div style={{ padding: '10px 14px 14px', borderTop: '1px solid var(--border-color)', fontSize: 13 }}>
              {/* v信号 */}
              {user?.wechat_id && (
                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>v信号</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 500 }}>{user.wechat_id}</span>
                </div>
              )}
              {/* 手机号 */}
              {user?.phone && (
                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>手机号</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 500 }}>{user.phone}</span>
                </div>
              )}
              {/* 二维码 */}
              {user?.id && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>二维码</div>
                  <div style={{ padding: 8, background: 'var(--bg-input)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
                    <img src="/api/users/me/qrcode" alt="我的二维码" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 4 }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 群成员行（带 hover） ── */
function CgMemberRow({ contact: c, checked, onToggle }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px', cursor: 'pointer', background: hovered ? 'var(--bg-hover)' : 'transparent', transition: 'background .1s' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${checked ? '#07C160' : 'var(--border-color)'}`, background: checked ? '#07C160' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .12s' }}>
        {checked && <svg viewBox="0 0 24 24" width="12" height="12" fill="#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
      </div>
      <Avatar src={c.avatar} name={c.remark || c.username} size={40} style={{ borderRadius: 8, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: checked ? 500 : 400 }}>{c.remark || c.username}</div>
        {c.remark && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{c.username}</div>}
      </div>
    </div>
  );
}

/* ── Create Group Modal ── */
function CreateGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef(null);

  useEffect(() => {
    axios.get('/api/users/contacts').then(r => setContacts(r.data)).catch(() => {});
    setTimeout(() => nameRef.current?.focus(), 80);
  }, []);

  const toggle = (id) => setSelected(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  const create = async () => {
    if (!name.trim()) { setError('请输入群名称'); return; }
    if (selected.size === 0) { setError('请至少选择一位成员'); return; }
    setLoading(true); setError('');
    try {
      const { data } = await axios.post('/api/messages/conversation/group', { name: name.trim(), memberIds: [...selected] });
      onCreated({ id: data.conversationId, type: 'group', name: name.trim(), avatar: '', members: [] });
    } catch (err) {
      setError(err.response?.data?.error || '创建失败，请重试');
      setLoading(false);
    }
  };

  const filtered = contacts.filter(c => {
    if (!contactSearch.trim()) return true;
    const q = contactSearch.toLowerCase();
    return (c.remark || c.username || '').toLowerCase().includes(q);
  });

  const selectedContacts = contacts.filter(c => selected.has(c.id));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,.52)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 480, maxWidth: '94vw', maxHeight: '80vh', background: 'var(--bg-msg-other)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.28)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)' }}
        onClick={e => e.stopPropagation()}>

        {/* 标题栏 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 14px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>发起群聊</span>
          <button onClick={onClose} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', background: 'transparent' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* 群名称输入 */}
        <div style={{ padding: '14px 18px 10px', flexShrink: 0, borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 7, fontWeight: 500 }}>群名称</div>
          <input
            ref={nameRef}
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            placeholder="请输入群名称"
            maxLength={30}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border-color)', fontSize: 14, color: 'var(--text-primary)', background: 'var(--bg-search)', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = '#07C160'}
            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
          />
        </div>

        {/* 已选成员 chips */}
        {selectedContacts.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 18px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
            {selectedContacts.map(c => (
              <div key={c.id} onClick={() => toggle(c.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 4px', background: 'rgba(7,193,96,.12)', borderRadius: 99, cursor: 'pointer', border: '1px solid rgba(7,193,96,.25)' }}>
                <Avatar src={c.avatar} name={c.remark || c.username} size={20} style={{ borderRadius: 4 }} />
                <span style={{ fontSize: 12, color: '#07C160', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.remark || c.username}</span>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="#07C160"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </div>
            ))}
          </div>
        )}

        {/* 联系人搜索 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '10px 18px 6px', padding: '7px 10px', background: 'var(--bg-search)', borderRadius: 8, border: '1px solid var(--border-color)', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            value={contactSearch}
            onChange={e => setContactSearch(e.target.value)}
            placeholder="搜索联系人"
            style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', background: 'none', border: 'none', outline: 'none' }}
          />
        </div>

        {/* 联系人列表 */}
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '2px 18px 6px', flexShrink: 0 }}>
          选择成员（已选 {selected.size} 人）
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 20px', color: 'var(--text-tertiary)', fontSize: 13 }}>
              {contacts.length === 0 ? '暂无联系人' : '未找到相关联系人'}
            </div>
          )}
          {filtered.map(c => {
            const isChecked = selected.has(c.id);
            return (
              <CgMemberRow key={c.id} contact={c} checked={isChecked} onToggle={() => toggle(c.id)} />
            );
          })}
        </div>

        {/* 底部操作 */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
          {error && (
            <div style={{ padding: '6px 10px', background: 'rgba(250,81,81,.08)', border: '1px solid rgba(250,81,81,.2)', borderRadius: 8, color: '#FA5151', fontSize: 12, marginBottom: 10 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid var(--border-color)', fontSize: 14, color: 'var(--text-secondary)', background: 'var(--bg-search)', cursor: 'pointer', fontWeight: 500 }}>
              取消
            </button>
            <button onClick={create} disabled={loading || selected.size === 0}
              style={{ flex: 2, padding: '11px 0', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: loading || selected.size === 0 ? 'not-allowed' : 'pointer', background: loading || selected.size === 0 ? 'rgba(7,193,96,.4)' : '#07C160', color: '#fff' }}>
              {loading ? '创建中…' : `创建群聊${selected.size > 0 ? `（${selected.size}人）` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState('chats');
  const [features, setFeatures] = useState({ moments: true, collect: true });
  const [netSearchQ, setNetSearchQ] = useState(null); // null=关闭；字符串=带词打开网络搜索
  const [activeConv, setActiveConv] = useState(null);
  const [unread, setUnread] = useState({});
  const [friendReqCount, setFriendReqCount] = useState(0);
  const [search, setSearch] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addMenuPos, setAddMenuPos] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [addFriendRequest, setAddFriendRequest] = useState(0);
  const { socket, reconnectCount, registerUnreadCleared } = useSocket();
  const { user, updateUser } = useAuth();
  usePushNotification(user);
  const activeConvIdRef = useRef(null);
  const addBtnRef = useRef(null);
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

  // 功能开关：后台可隐藏朋友圈/收藏。若当前所在 tab 被关闭则退回消息页
  useEffect(() => {
    axios.get('/api/config').then(r => {
      const f = r.data?.features || {};
      setFeatures(f);
      setTab(prev => ((prev === 'moments' && f.moments === false) || (prev === 'favorites' && f.collect === false)) ? 'chats' : prev);
    }).catch(() => {});
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

  // 通知权限由 usePushNotification 统一申请，此处无需重复请求

  const showNotification = useCallback((title, body, icon) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: title,
        renotify: true,
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onMsg = (msg) => {
      const isActiveConv = msg.conversation_id === activeConvIdRef.current;
      setUnread(prev => {
        if (isActiveConv) return prev;
        return { ...prev, [msg.conversation_id]: (prev[msg.conversation_id] || 0) + 1 };
      });
      // 不在当前会话 或 窗口不可见时，推送浏览器通知
      if (!isActiveConv || document.hidden) {
        const bodyText =
          msg.type === 'image' ? '[图片]' :
          msg.type === 'voice' ? '[语音消息]' :
          msg.type === 'file'  ? '[文件]' :
          msg.type === 'video' ? '[视频]' :
          (msg.content || '').slice(0, 80) || '发来了一条消息';
        showNotification(msg.senderName || '新消息', bodyText, msg.senderAvatar);
      }
    };
    const onFriendReq = (data) => {
      setFriendReqCount(prev => prev + 1);
      const name = data?.from?.username || data?.username || '有人';
      showNotification('新的好友申请', `${name} 请求添加您为好友`);
    };
    const onFriendAccepted = (data) => {
      const name = data?.accepter?.username || '对方';
      showNotification('好友申请已通过', `${name} 已通过你的好友申请`);
    };
    socket.on('new_message', onMsg);
    socket.on('new_friend_request', onFriendReq);
    socket.on('friend_request_accepted', onFriendAccepted);
    return () => {
      socket.off('new_message', onMsg);
      socket.off('new_friend_request', onFriendReq);
      socket.off('friend_request_accepted', onFriendAccepted);
    };
  }, [socket, showNotification]);

  // 被踢出群时：清除当前活跃会话 + 清零未读（ChatWindow 可能未挂载，需在此兜底）
  useEffect(() => {
    if (!socket) return;
    const onGroupKicked = ({ conversationId }) => {
      setActiveConv(prev => (prev?.id === conversationId ? null : prev));
      setUnread(prev => { const n = { ...prev }; delete n[conversationId]; return n; });
    };
    socket.on('group_kicked', onGroupKicked);
    return () => socket.off('group_kicked', onGroupKicked);
  }, [socket]);

  const handleSelectConv = useCallback((conv) => {
    setActiveConv(conv);
    setUnread(prev => ({ ...prev, [conv.id]: 0 }));
    setTab('chats');
  }, []);

  const handleTabChange = (t) => {
    setTab(t);
    setSearch('');
    if (t !== 'chats') setActiveConv(null);
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
      case 'moments':
        return <Moments />;
      case 'calls':
        return <CallHistory />;
      case 'favorites':
        return <Collections />;
      case 'profile':
      case 'settings':
        return <Profile />;
      default:
        return null;
    }
  };

  const toggleAddMenu = () => {
    if (showAddMenu) {
      setShowAddMenu(false);
      setAddMenuPos(null);
    } else {
      const rect = addBtnRef.current?.getBoundingClientRect();
      if (rect) setAddMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
      setShowAddMenu(true);
    }
  };
  const closeAddMenu = () => { setShowAddMenu(false); setAddMenuPos(null); };

  const handleCreateGroup = () => {
    closeAddMenu();
    setShowCreateGroup(true);
  };

  const handleAddFriend = () => {
    closeAddMenu();
    if (tab !== 'contacts') handleTabChange('contacts');
    setAddFriendRequest(n => n + 1);
  };

  return (
    <div className={`wc-app${isMobile ? ' wc-mobile' : ''}`}>

      {/* 左侧导航栏 */}
      <div className="wc-sidebar">
        <AccountSwitcher />
        {/* Tab 按钮紧跟头像，不用 spacer 下推，防止小屏被裁切 */}
        <div className="wc-sidebar-btns">
          {TABS.filter(t => !t.feature || features[t.feature] !== false).map(({ key, Icon, label }) => {
            const count = badges[key] || 0;
            return (
              <div key={key}
                className={`wc-sidebar-btn${tab === key ? ' active' : ''}`}
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
              <button ref={addBtnRef} className="wc-icon-btn" title="发起" onClick={toggleAddMenu}>
                <IcoAdd />
              </button>
            </div>

            <div className="wc-panel-content">
              {search.trim() ? (
                <GlobalSearch
                  query={search}
                  onSelectConv={(conv) => { (isMobile ? handleMobileSelectConv : handleSelectConv)(conv); setSearch(''); }}
                  onNetworkSearch={(q) => setNetSearchQ(q || search)}
                />
              ) : renderMain()}
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

      {/* + 号下拉菜单（position:fixed 避免 backdrop-filter 堆叠层问题） */}
      {showAddMenu && addMenuPos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 800 }} onClick={closeAddMenu} />
          <div style={{
            position: 'fixed',
            top: addMenuPos.top,
            right: addMenuPos.right,
            zIndex: 801,
            background: 'var(--bg-msg-other)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.1)',
            overflow: 'hidden',
            minWidth: 168,
          }}>
            <AddDropItem
              icon={<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>}
              label="发起群聊"
              onClick={handleCreateGroup}
            />
            <div style={{ height: 1, background: 'var(--border-color)' }} />
            <AddDropItem
              icon={<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>}
              label="添加朋友"
              onClick={handleAddFriend}
            />
          </div>
        </>
      )}

      {/* 发起群聊弹窗 */}
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={(conv) => { setShowCreateGroup(false); handleSelectConv(conv); }}
        />
      )}

      {/* 主搜索框「去网络搜索」兜底：带关键词打开添加好友 */}
      {netSearchQ !== null && (
        <AddFriendModal initialQuery={netSearchQ} onClose={() => setNetSearchQ(null)} />
      )}
    </div>
  );
}

function AddDropItem({ icon, label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', background: hovered ? 'var(--bg-hover)' : 'transparent', transition: 'background .1s' }}>
      <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{label}</span>
    </div>
  );
}
