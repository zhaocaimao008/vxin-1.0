import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';

/*
  微信 Windows PC 导航图标
  ─────────────────────────
  viewBox 24×24，fill 继承 color
  路径尽量轻薄，接近微信原版线条感
  渲染尺寸：20×20px（CSS 控制）
*/

const IcoChat = () => (
  <svg viewBox="0 0 24 24">
    {/* 微信风格：带圆角的对话气泡 */}
    <path d="M20 2H4C2.9 2 2 2.9 2 4v13c0 1.1.9 2 2 2h3v3l3.6-3H20c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 13H4V4h16v11z"/>
  </svg>
);

const IcoContacts = () => (
  <svg viewBox="0 0 24 24">
    {/* 两个人形轮廓 */}
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05C16.19 13.85 17 15.02 17 16.5V19h6v-2.5C23 14.17 18.33 13 16 13z"/>
  </svg>
);

const IcoDiscover = () => (
  <svg viewBox="0 0 24 24">
    {/* 指南针/罗盘 */}
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13v2l4 4-4 4v2h2v-2l4-4-4-4V7h-2zm-2 2H7v2h2V9zm0 4H7v2h2v-2z"/>
    {/* 简化为菱形指针 */}
  </svg>
);

// 更接近微信"发现"图标的罗盘
const IcoDiscoverClean = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-11.5l-5 2.5-2.5 5 5-2.5 2.5-5z"/>
  </svg>
);

const IcoMe = () => (
  <svg viewBox="0 0 24 24">
    {/* 单人轮廓 */}
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);

const IcoSettings = () => (
  <svg viewBox="0 0 24 24">
    {/* 齿轮 */}
    <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
  </svg>
);

const TABS = [
  { key: 'chats',    label: '微信',   Icon: IcoChat },
  { key: 'contacts', label: '通讯录', Icon: IcoContacts },
  { key: 'discover', label: '发现',   Icon: IcoDiscoverClean },
  { key: 'profile',  label: '我',     Icon: IcoMe },
];

export default function Sidebar({ tab, onTabChange, badges = {} }) {
  const { user } = useAuth();

  return (
    <div className="wc-sidebar">

      {/* 顶部头像 */}
      <div className="wc-sidebar-avatar">
        <Avatar src={user?.avatar} name={user?.username} size={32} />
      </div>

      {/* 4 个主导航 tab */}
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

      {/* 底部设置按钮 */}
      <div className="wc-sidebar-bottom">
        <div className="wc-sidebar-btn" title="设置">
          <div className="icon"><IcoSettings /></div>
        </div>
      </div>

    </div>
  );
}
