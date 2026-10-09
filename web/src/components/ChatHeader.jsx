import React, { memo } from 'react';
import { IcoChevronLeft, IcoMore, IcoPhone, IcoSearchSm, IcoVideo } from './Icons';
import Avatar from './Avatar';
import { GroupAvatar } from './GroupAvatar';

/* ── ChatWindow 顶栏 ─────────────────────────────────────────────────
   memo 化：父组件高频 setState 时顶栏不重渲染。 */


function ChatHeader({
  conversation,
  memberCount,
  features = {},
  showGroupInfo,
  showSearch,
  onClose,
  onOpenUserProfile,
  onStartCall,
  onStartGroupCall,
  onToggleGroupInfo,
  onToggleSearch,
}) {
  const isPrivate = conversation.type === 'private';
  const isGroup   = conversation.type === 'group';

  const avatarEl = isGroup
    ? <GroupAvatar members={conversation.members || []} avatar={conversation.avatar} size={34} />
    : <Avatar
        src={conversation.otherUser?.avatar || conversation.avatar}
        name={conversation.name}
        size={34}
        onClick={isPrivate && conversation.otherUser?.id
          ? () => onOpenUserProfile(conversation.otherUser.id)
          : undefined}
      />;

  return (
    <div className="wc-chat-header">
      {/* 桌面端不渲染返回按钮（CSS 已隐藏，此处仅移动端展示） */}
      <button className="wc-chat-header-back wc-back-btn" onClick={onClose} title="返回" aria-label="返回">
        <IcoChevronLeft size={28} />
      </button>

      {/* 头像（桌面端点击头像可打开资料卡）*/}
      <div className="wc-chat-header-avatar" aria-hidden="true">
        {avatarEl}
      </div>

      <div className="wc-header-name-container">
        {isPrivate && conversation.otherUser?.id ? (
          <div
            className="wc-chat-header-name wc-chat-header-name-clickable"
            data-testid="chat-title"
            role="button" tabIndex={0}
            title="点击查看资料"
            onClick={() => onOpenUserProfile(conversation.otherUser.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenUserProfile(conversation.otherUser.id); } }}
          >
            {conversation.name || '聊天'}
          </div>
        ) : (
          <div className="wc-chat-header-name" data-testid="chat-title">
            {conversation.name || '聊天'}
            {memberCount ? <span className="wc-header-member-count">({memberCount})</span> : null}
          </div>
        )}
        {isPrivate && conversation.otherUser?.status === 'online' && (
          <div className="wc-chat-header-sub">在线</div>
        )}
      </div>

      <div className="wc-chat-header-right">
        {isPrivate && <>
          <button className="wc-chat-header-btn" data-testid="chat-call-audio-btn" title="语音通话" aria-label="语音通话" onClick={() => onStartCall('audio')}><IcoPhone size={20} /></button>
          <button className="wc-chat-header-btn" data-testid="chat-call-video-btn" title="视频通话" aria-label="视频通话" onClick={() => onStartCall('video')}><IcoVideo size={20} /></button>
        </>}
        {isGroup && <>
          {features.groupVoiceCall !== false && <button className="wc-chat-header-btn" title="群语音通话" aria-label="群语音通话" onClick={() => onStartGroupCall('audio')}><IcoPhone size={20} /></button>}
          {features.groupVideoCall !== false && <button className="wc-chat-header-btn" title="群视频通话" aria-label="群视频通话" onClick={() => onStartGroupCall('video')}><IcoVideo size={20} /></button>}
        </>}
        <button
          className={`wc-chat-header-btn${showSearch ? ' active' : ''}`}
          title="搜索聊天记录"
          aria-label="搜索聊天记录"
          aria-pressed={showSearch}
          data-testid="chat-search-btn"
          onClick={onToggleSearch}
        ><IcoSearchSm size={20} /></button>
        <button
          className={`wc-chat-header-btn${showGroupInfo ? ' active' : ''}`}
          title={isGroup ? '群聊信息' : '聊天信息'}
          aria-label={isGroup ? '群聊信息' : '聊天信息'}
          aria-pressed={showGroupInfo}
          data-testid="chat-group-info-btn"
          onClick={onToggleGroupInfo}
        ><IcoMore size={20} /></button>
      </div>
    </div>
  );
}

export default memo(ChatHeader);
