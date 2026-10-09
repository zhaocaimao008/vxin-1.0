import React, { useState } from 'react';
import { IcoUserPlus, IcoUsers, IcoCopy } from './Icons';
import { copyToClipboard } from '../utils/clipboard';
import './WelcomeActions.css';

export default function WelcomeActions({ user, onAddFriend, onCreateGroup, compact = false }) {
  const [feedback, setFeedback] = useState('');
  const id = user?.wechat_id;
  const copy = async (invitation = false) => {
    const text = invitation ? `在 v信 搜索我的 v信号 ${id}，即可添加我为好友。` : String(id);
    const ok = await copyToClipboard(text);
    setFeedback(ok ? (invitation ? '邀请信息已复制，可以粘贴分享给好友' : 'v信号已复制') : '复制失败，请长按或选中 v信号手动复制');
  };
  return (
    <section className={`vx-welcome${compact ? ' vx-welcome--compact' : ''}`} aria-label="开始使用 v信">
      {compact && <h3>开始你的第一段对话</h3>}
      <p className="vx-welcome-desc">添加朋友，或邀请熟悉的人加入群聊。</p>
      <div className="vx-welcome-actions">
        <button type="button" className="vx-welcome-primary" onClick={onAddFriend}><IcoUserPlus size={18} />添加好友</button>
        <button type="button" onClick={onCreateGroup}><IcoUsers size={18} />创建群聊</button>
      </div>
      {id && <div className="vx-welcome-identity">
        <span>我的 v信号 <strong>{id}</strong></span>
        <button type="button" aria-label="复制我的 v信号" onClick={() => copy()}><IcoCopy size={16} />复制</button>
        <button type="button" onClick={() => copy(true)}>复制邀请信息</button>
      </div>}
      <p className="vx-welcome-feedback" role="status" aria-live="polite">{feedback}</p>
    </section>
  );
}
