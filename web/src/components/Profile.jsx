import React, { useState, useRef } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import { useAuth } from '../contexts/AuthContext';

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: '#C7C7CC', flexShrink: 0 }}>
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
  </svg>
);

function MenuItem({ bg, icon, label, onClick }) {
  return (
    <div className="wc-menu-item" onClick={onClick}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <span className="wc-menu-label">{label}</span>
      <ChevronRight />
    </div>
  );
}

export default function Profile({ onNavigate }) {
  const { user, updateUser, logout } = useAuth();
  const [showEdit, setShowEdit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const fileRef = useRef(null);

  const uploadAvatar = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('avatar', file);
    const { data } = await axios.post('/api/users/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    updateUser({ avatar: data.avatar });
    e.target.value = '';
  };

  if (showEdit) return <EditProfile user={user} updateUser={updateUser} onBack={() => setShowEdit(false)} />;
  if (showSettings) return <Settings user={user} logout={logout} onBack={() => setShowSettings(false)} />;
  if (showCollections) return <Collections onBack={() => setShowCollections(false)} />;

  return (
    <div className="wc-profile">
      {/* Profile card */}
      <div className="wc-profile-card" onClick={() => setShowEdit(true)}>
        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
          <Avatar src={user?.avatar} name={user?.username} size={64} />
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
        </div>
        <div className="wc-profile-info">
          <div className="wc-profile-name">{user?.username}</div>
          <div className="wc-profile-wid">
            {user?.wechat_id ? `微信号: ${user.wechat_id}` : `手机号: ${user?.phone}`}
          </div>
          {user?.bio && <div style={{ fontSize: 13, color: '#888', marginTop: 3 }}>{user.bio}</div>}
        </div>
        <ChevronRight />
      </div>

      {/* 朋友圈入口 */}
      <div className="wc-menu-section">
        <MenuItem
          bg="#07C160" label="朋友圈" onClick={() => onNavigate?.('moments')}
          icon={<svg viewBox="0 0 24 24" style={{ width: 17, height: 17, fill: '#fff' }}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>}
        />
      </div>

      {/* 功能菜单 */}
      <div className="wc-menu-section">
        <MenuItem bg="#FAAD14" label="收藏" onClick={() => setShowCollections(true)}
          icon={<svg viewBox="0 0 24 24" style={{ width: 17, height: 17, fill: '#fff' }}><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>}
        />
        <MenuItem bg="#1890FF" label="照片与视频" onClick={() => {}}
          icon={<svg viewBox="0 0 24 24" style={{ width: 17, height: 17, fill: '#fff' }}><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>}
        />
        <MenuItem bg="#52C41A" label="卡包" onClick={() => {}}
          icon={<svg viewBox="0 0 24 24" style={{ width: 17, height: 17, fill: '#fff' }}><path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>}
        />
        <MenuItem bg="#FA8C16" label="表情" onClick={() => {}}
          icon={<svg viewBox="0 0 24 24" style={{ width: 17, height: 17, fill: '#fff' }}><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>}
        />
      </div>

      {/* 设置 */}
      <div className="wc-menu-section">
        <MenuItem bg="#8C8C8C" label="设置" onClick={() => setShowSettings(true)}
          icon={<svg viewBox="0 0 24 24" style={{ width: 17, height: 17, fill: '#fff' }}><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>}
        />
      </div>
    </div>
  );
}

function EditProfile({ user, updateUser, onBack }) {
  const [form, setForm] = useState({ username: user?.username || '', bio: user?.bio || '', wechat_id: user?.wechat_id || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true); setError('');
    try {
      const { data } = await axios.put('/api/users/profile', form);
      updateUser(data);
      onBack();
    } catch (err) { setError(err.response?.data?.error || '保存失败'); }
    setSaving(false);
  };

  return (
    <div className="wc-profile" style={{ overflowY: 'auto' }}>
      <div className="wc-panel-header" style={{ background: '#fff' }}>
        <button style={{ color: '#07C160', fontSize: 15 }} onClick={onBack}>‹ 返回</button>
        <span className="wc-panel-title">编辑资料</span>
        <button style={{ color: '#07C160', fontSize: 15, fontWeight: 500 }} onClick={save} disabled={saving}>{saving ? '保存中' : '保存'}</button>
      </div>
      <div style={{ background: '#fff', margin: '12px 0' }}>
        {[
          { key: 'username', label: '昵称', placeholder: '请输入昵称' },
          { key: 'wechat_id', label: '微信号', placeholder: '设置微信号（字母、数字、下划线）' },
          { key: 'bio', label: '签名', placeholder: '填写个性签名' },
        ].map(({ key, label, placeholder }) => (
          <div key={key} className="wc-menu-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
            <input
              style={{ width: '100%', fontSize: 15, color: '#191919', outline: 'none', border: 'none', padding: 0, background: 'transparent' }}
              value={form[key]}
              placeholder={placeholder}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      {error && <div style={{ color: '#FA5151', fontSize: 13, textAlign: 'center', padding: 8 }}>{error}</div>}
    </div>
  );
}

function Settings({ user, logout, onBack }) {
  return (
    <div className="wc-settings">
      <div className="wc-panel-header" style={{ background: '#fff' }}>
        <button style={{ color: '#07C160', fontSize: 15 }} onClick={onBack}>‹ 返回</button>
        <span className="wc-panel-title">设置</span>
        <div style={{ width: 40 }} />
      </div>
      <div style={{ paddingTop: 12 }}>
        {[
          { icon: '🔐', color: '#FA5151', label: '账号与安全', sub: user?.phone },
          { icon: '🔒', color: '#1890FF', label: '隐私' },
          { icon: '🔔', color: '#52C41A', label: '新消息通知' },
          { icon: '💬', color: '#FA8C16', label: '聊天' },
          { icon: '📡', color: '#9B59B6', label: '通用' },
          { icon: '❓', color: '#1ABC9C', label: '帮助与反馈' },
          { icon: '📋', color: '#888', label: '关于微信' },
        ].map(item => (
          <div key={item.label} className="wc-menu-item" style={{ background: '#fff', margin: 0 }}>
            <div className="wc-menu-icon" style={{ background: item.color + '22' }}>{item.icon}</div>
            <div style={{ flex: 1 }}>
              <div className="wc-menu-label">{item.label}</div>
              {item.sub && <div style={{ fontSize: 12, color: '#888' }}>{item.sub}</div>}
            </div>
            <span className="wc-menu-arrow">›</span>
          </div>
        ))}
      </div>
      <button className="wc-logout-btn" onClick={() => { if (confirm('确认退出登录？')) logout(); }}>
        退出登录
      </button>
    </div>
  );
}

function Collections({ onBack }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    axios.get('/api/users/me/collections').then(r => setItems(r.data));
  }, []);

  const typeIcon = (type) => ({ text: '📝', image: '🖼️', file: '📄', voice: '🎵' }[type] || '📎');
  const { format } = require('../utils/time');

  return (
    <div className="wc-settings">
      <div className="wc-panel-header" style={{ background: '#fff' }}>
        <button style={{ color: '#07C160', fontSize: 15 }} onClick={onBack}>‹ 返回</button>
        <span className="wc-panel-title">收藏</span>
        <div style={{ width: 40 }} />
      </div>
      <div style={{ paddingTop: 8 }}>
        {items.map(item => (
          <div key={item.id} className="wc-collection-item">
            <div className="wc-collection-icon">{typeIcon(item.type)}</div>
            <div>
              <div className="wc-collection-content">{item.type === 'image' ? '[图片]' : item.content}</div>
              <div className="wc-collection-time">{format(item.created_at * 1000)}</div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#B2B2B2', fontSize: 13 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⭐</div>
            暂无收藏
          </div>
        )}
      </div>
    </div>
  );
}
