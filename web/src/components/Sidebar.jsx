import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';

/* 微信 PC 侧边栏导航图标 —— 参照官方截图复刻 */

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

/* 发现：指南针风格 */
const IcoDiscover = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1.41-5.17L16 12l-5.41-4.83L9 9l4 3-4 3 1.59 1.83z"/>
  </svg>
);

const IcoMe = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);

const IcoSettings = () => (
  <svg viewBox="0 0 24 24">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
  </svg>
);

const TABS = [
  { key: 'chats',    label: '微信',   Icon: IcoChat },
  { key: 'contacts', label: '通讯录', Icon: IcoContacts },
  { key: 'discover', label: '发现',   Icon: IcoDiscover },
  { key: 'profile',  label: '我',     Icon: IcoMe },
];

export default function Sidebar({ tab, onTabChange, badges = {} }) {
  const { user } = useAuth();

  return (
    <div className="wc-sidebar">
      {/* 头像 */}
      <div className="wc-sidebar-avatar">
        <Avatar src={user?.avatar} name={user?.username} size={34} />
      </div>

      {/* 主导航 */}
      <div className="wc-sidebar-nav">
        {TABS.map(({ key, label, Icon }) => {
          const count = badges[key] || 0;
          return (
            <div
              key={key}
              className={`wc-sidebar-btn${tab === key ? ' active' : ''}`}
              onClick={() => onTabChange(key)}
              title={label}
            >
              <div className="icon"><Icon /></div>
              <span className="label">{label}</span>
              {count > 0 && (
                <span className="wc-sidebar-badge">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 底部设置 */}
      <div className="wc-sidebar-bottom">
        <div className="wc-sidebar-btn" title="设置">
          <div className="icon"><IcoSettings /></div>
        </div>
      </div>
    </div>
  );
}
