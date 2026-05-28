import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';

const TABS = [
  { key: 'chats',    icon: '💬', label: '微信' },
  { key: 'contacts', icon: '👥', label: '通讯录' },
  { key: 'discover', icon: '🔍', label: '发现' },
  { key: 'profile',  icon: '👤', label: '我' },
];

export default function Sidebar({ tab, onTabChange, badges = {} }) {
  const { user } = useAuth();

  return (
    <div className="wc-sidebar">
      <div className="wc-sidebar-avatar">
        <Avatar src={user?.avatar} name={user?.username} size={34} />
      </div>
      <div className="wc-sidebar-nav">
        {TABS.map(t => {
          const count = badges[t.key] || 0;
          return (
            <div key={t.key} className={`wc-sidebar-btn${tab === t.key ? ' active' : ''}`} onClick={() => onTabChange(t.key)}>
              <span className="icon">{t.icon}</span>
              <span className="label">{t.label}</span>
              {count > 0 && <span className="wc-sidebar-badge">{count > 99 ? '99+' : count}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
