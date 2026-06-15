import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { mediaUrl } from '../utils/url';

const IcoChat = () => (
  <svg viewBox="0 0 24 24">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
  </svg>
);

const IcoContacts = () => (
  <svg viewBox="0 0 24 24">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
  </svg>
);

const IcoDiscover = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.65-11.15l-7.07 2.83-2.83 7.07 7.07-2.83 2.83-7.07zM12 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
  </svg>
);

const IcoProfile = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);

const TABS = [
  { key: 'chats',    Icon: IcoChat,     label: '消息' },
  { key: 'contacts', Icon: IcoContacts, label: '通讯录' },
  { key: 'discover', Icon: IcoDiscover, label: '发现' },
  { key: 'profile',  Icon: IcoProfile,  label: '我' },
];

export default function Sidebar({ tab, onTabChange, badges = {} }) {
  const { user } = useAuth();
  const letter = (user?.username || '?')[0].toUpperCase();

  return (
    <div className="wc-sidebar">
      {/* 头像 */}
      <div className="wc-sidebar-avatar" onClick={() => onTabChange('profile')} title={user?.username || ''}>
        {user?.avatar
          ? <img src={mediaUrl(user.avatar)} alt="" className="wc-sidebar-avatar-img" />
          : <div className="wc-sidebar-avatar-inner">{letter}</div>
        }
      </div>

      {/* 导航 */}
      <div className="wc-sidebar-nav">
        <div className="wc-sidebar-spacer" />
        <div className="wc-sidebar-btns">
          {TABS.map(({ key, Icon, label }) => {
            const count = badges[key] || 0;
            return (
              <div
                key={key}
                className={`wc-sidebar-btn${tab === key ? ' active' : ''}`}
                onClick={() => onTabChange(key)}
                title={label}
              >
                <div className="icon"><Icon /></div>
                {count > 0 && (
                  <span className="wc-sidebar-badge">{count > 99 ? '99+' : count}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
