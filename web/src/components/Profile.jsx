import React, { useState, useRef } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import { useAuth } from '../contexts/AuthContext';

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
        <div style={{ color: '#C7C7CC', fontSize: 18 }}>›</div>
      </div>

      {/* 朋友圈入口 */}
      <div className="wc-menu-section">
        <div className="wc-menu-item" onClick={() => onNavigate?.('moments')}>
          <div className="wc-menu-icon" style={{ background: '#07C16022' }}>🌐</div>
          <span className="wc-menu-label">朋友圈</span>
          <span className="wc-menu-arrow">›</span>
        </div>
      </div>

      {/* Main menu */}
      <div className="wc-menu-section">
        {[
          { icon: '⭐', color: '#FAAD14', label: '收藏', action: () => setShowCollections(true) },
          { icon: '🖼️', color: '#1890FF', label: '照片与视频', action: () => {} },
          { icon: '💳', color: '#52C41A', label: '卡包', action: () => {} },
          { icon: '😊', color: '#FA8C16', label: '表情', action: () => {} },
        ].map(item => (
          <div key={item.label} className="wc-menu-item" onClick={item.action}>
            <div className="wc-menu-icon" style={{ background: item.color + '22' }}>{item.icon}</div>
            <span className="wc-menu-label">{item.label}</span>
            <span className="wc-menu-arrow">›</span>
          </div>
        ))}
      </div>

      {/* Settings */}
      <div className="wc-menu-section">
        <div className="wc-menu-item" onClick={() => setShowSettings(true)}>
          <div className="wc-menu-icon" style={{ background: '#F5F5F5' }}>⚙️</div>
          <span className="wc-menu-label">设置</span>
          <span className="wc-menu-arrow">›</span>
        </div>
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
