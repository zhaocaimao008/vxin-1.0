import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import EmojiPicker from './EmojiPicker';
import GroupInfo, { GroupAvatar } from './GroupInfo';
import UserProfile from './UserProfile';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { format, formatFull } from '../utils/time';

const REACTIONS = ['👍','❤️','😄','😮','😢','🙏'];

export default function ChatWindow({ conversation: initialConv, onClose }) {
  const [conversation, setConversation] = useState(initialConv);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typingName, setTypingName] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [members, setMembers] = useState([]);
  const [showUserProfile, setShowUserProfile] = useState(null); // userId
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, msg }
  const [atList, setAtList] = useState(null); // members for @ mention
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimer = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const textareaRef = useRef(null);
  const { socket } = useSocket();
  const { user } = useAuth();

  const fetchMessages = useCallback(async (before = null) => {
    const params = { limit: 40 };
    if (before) params.before = before;
    const { data } = await axios.get(`/api/messages/${conversation.id}`, { params });
    return data;
  }, [conversation.id]);

  // Sync conversation prop changes
  useEffect(() => { setConversation(initialConv); }, [initialConv]);

  useEffect(() => {
    setMessages([]);
    setReplyTo(null);
    setShowEmoji(false);
    setShowMore(false);
    setVoiceMode(false);
    setHasMore(true);
    setShowGroupInfo(false);

    fetchMessages().then(data => {
      setMessages(data);
      setHasMore(data.length === 40);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
    });

    socket?.emit('join_conversation', { conversationId: conversation.id });

    if (conversation.type === 'group') {
      axios.get(`/api/messages/conversation/${conversation.id}/members`).then(r => setMembers(r.data)).catch(() => {});
    }

    // Mark as read
    axios.post(`/api/messages/conversation/${conversation.id}/read`).catch(() => {});
  }, [conversation.id, fetchMessages, socket, conversation.type]);

  // Scroll to bottom when new messages come in
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isAtBottom) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load more on scroll to top
  const handleScroll = useCallback(async () => {
    const container = messagesContainerRef.current;
    if (!container || loadingMore || !hasMore) return;
    if (container.scrollTop < 60 && messages.length > 0) {
      setLoadingMore(true);
      const oldest = messages[0]?.created_at;
      const data = await fetchMessages(oldest);
      if (data.length === 0) { setHasMore(false); }
      else {
        const prevScrollHeight = container.scrollHeight;
        setMessages(prev => [...data, ...prev]);
        setTimeout(() => {
          container.scrollTop = container.scrollHeight - prevScrollHeight;
        }, 0);
      }
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, messages, fetchMessages]);

  useEffect(() => {
    if (!socket) return;
    const onMsg = (msg) => {
      if (msg.conversation_id !== conversation.id) return;
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Mark as read
      axios.post(`/api/messages/conversation/${conversation.id}/read`).catch(() => {});
    };
    const onTyping = ({ userId, conversationId }) => {
      if (conversationId !== conversation.id || userId === user.id) return;
      const m = messages.find(m => m.sender_id === userId);
      setTypingName(m?.senderName || '对方');
    };
    const onStopTyping = ({ conversationId }) => {
      if (conversationId === conversation.id) setTypingName('');
    };
    const onDeleted = ({ msgId }) => {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted: 1, content: '消息已撤回' } : m));
    };
    const onReaction = ({ msgId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m));
    };
    const onRead = ({ userId: uid, conversationId }) => {
      if (conversationId !== conversation.id || uid === user.id) return;
      setMessages(prev => {
        const copy = [...prev];
        // mark last message as read
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].sender_id === user.id) {
            copy[i] = { ...copy[i], _read: true };
            break;
          }
        }
        return copy;
      });
    };
    const onGroupUpdated = ({ id }) => {
      if (id === conversation.id) {
        axios.get(`/api/messages/conversation/${conversation.id}/members`).then(r => setMembers(r.data)).catch(() => {});
      }
    };
    const onGroupKicked = ({ conversationId }) => {
      if (conversationId === conversation.id) onClose?.();
    };
    const onGroupDismissed = ({ conversationId }) => {
      if (conversationId === conversation.id) { alert('群聊已解散'); onClose?.(); }
    };
    socket.on('new_message', onMsg);
    socket.on('typing', onTyping);
    socket.on('stop_typing', onStopTyping);
    socket.on('message_deleted', onDeleted);
    socket.on('message_reaction', onReaction);
    socket.on('message_read', onRead);
    socket.on('group_updated', onGroupUpdated);
    socket.on('group_kicked', onGroupKicked);
    socket.on('group_dismissed', onGroupDismissed);
    return () => {
      socket.off('new_message', onMsg);
      socket.off('typing', onTyping);
      socket.off('stop_typing', onStopTyping);
      socket.off('message_deleted', onDeleted);
      socket.off('message_reaction', onReaction);
      socket.off('message_read', onRead);
      socket.off('group_updated', onGroupUpdated);
      socket.off('group_kicked', onGroupKicked);
      socket.off('group_dismissed', onGroupDismissed);
    };
  }, [socket, conversation.id, user.id, messages, onClose]);

  const sendMessage = () => {
    if (!input.trim() || !socket) return;
    socket.emit('send_message', {
      conversationId: conversation.id,
      content: input.trim(),
      type: 'text',
      reply_to_id: replyTo?.id || null
    });
    setInput('');
    setReplyTo(null);
    setShowEmoji(false);
    socket.emit('stop_typing', { conversationId: conversation.id });
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleKeyDown = (e) => {
    // @ mention
    if (e.key === '@' && conversation.type === 'group') {
      setAtList(members);
    } else if (atList) {
      setAtList(null);
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
      return;
    }
    socket?.emit('typing', { conversationId: conversation.id });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket?.emit('stop_typing', { conversationId: conversation.id }), 2000);
  };

  const insertAtMention = (member) => {
    setInput(prev => prev + `@${member.username} `);
    setAtList(null);
    textareaRef.current?.focus();
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    if (replyTo) fd.append('reply_to_id', replyTo.id);
    try {
      await axios.post(`/api/messages/${conversation.id}/upload`, fd);
      setReplyTo(null);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { alert('上传失败'); }
    e.target.value = '';
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        if (blob.size < 1000) return; // too short
        const fd = new FormData();
        fd.append('file', blob, 'voice.webm');
        try {
          await axios.post(`/api/messages/${conversation.id}/upload`, fd);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch { alert('发送失败'); }
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch { alert('无法访问麦克风'); }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const handleContextMenu = (e, msg) => {
    if (msg.deleted) return;
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 320);
    setCtxMenu({ x, y, msg });
  };

  const closeCtx = () => setCtxMenu(null);

  const ctxAction = async (action) => {
    const msg = ctxMenu?.msg;
    if (!msg) return;
    closeCtx();
    switch (action) {
      case 'reply':
        setReplyTo(msg);
        textareaRef.current?.focus();
        break;
      case 'copy':
        navigator.clipboard.writeText(msg.content).catch(() => {});
        break;
      case 'delete':
        if (confirm('确认撤回这条消息？')) {
          await axios.delete(`/api/messages/${msg.id}`, { data: { forEveryone: true } }).catch(() => {});
        }
        break;
      case 'collect':
        await axios.post(`/api/messages/${msg.id}/collect`).catch(() => {});
        break;
      default:
        if (action.startsWith('react:')) {
          const emoji = action.replace('react:', '');
          await axios.post(`/api/messages/${msg.id}/react`, { emoji }).catch(() => {});
        }
    }
  };

  const playVoice = (url) => {
    new Audio(url).play();
  };

  // Time dividers
  const renderMessages = () => {
    const items = [];
    let lastTime = 0;
    messages.forEach((msg, idx) => {
      if (msg.created_at - lastTime > 300) {
        items.push(
          <div key={`t_${msg.id}`} className="wc-msg-time">
            <span>{formatFull(msg.created_at * 1000)}</span>
          </div>
        );
        lastTime = msg.created_at;
      }
      items.push(renderMessage(msg, idx));
    });
    return items;
  };

  const renderMessage = (msg, idx) => {
    if (msg.deleted) {
      return (
        <div key={msg.id} style={{ textAlign: 'center', margin: '4px 0' }}>
          <span style={{ fontSize: 12, color: '#B2B2B2' }}>
            {msg.sender_id === user.id ? '你撤回了一条消息' : `"${msg.senderName}"撤回了一条消息`}
          </span>
        </div>
      );
    }

    const isMine = msg.sender_id === user.id;
    const showRead = isMine && msg._read && conversation.type === 'private';
    const isLastMine = isMine && !messages.slice(idx + 1).find(m => m.sender_id === user.id && !m.deleted);

    return (
      <div key={msg.id} className={`wc-msg-row${isMine ? ' mine' : ''}`}>
        <div className="wc-msg-avatar">
          <Avatar src={msg.senderAvatar} name={msg.senderName} size={38} />
        </div>
        <div className="wc-msg-body">
          {!isMine && conversation.type === 'group' && (
            <div className="wc-msg-sender">{msg.senderName}</div>
          )}
          <div className="wc-msg-bubble-wrap">
            {showRead && isLastMine && <div className="wc-msg-read">已读</div>}
            <div
              className={`wc-msg-bubble ${isMine ? 'mine' : 'other'}`}
              onContextMenu={e => handleContextMenu(e, msg)}
            >
              {msg.replyTo && (
                <div className="wc-msg-reply">
                  <div className="wc-msg-reply-name">{msg.replyTo.senderName}</div>
                  <div className="wc-msg-reply-text">
                    {msg.replyTo.type === 'image' ? '[图片]' : msg.replyTo.type === 'voice' ? '[语音]' : msg.replyTo.content}
                  </div>
                </div>
              )}
              {msg.type === 'text' && <span>{msg.content}</span>}
              {msg.type === 'image' && (
                <img src={msg.file_url} alt="" className="wc-msg-image" onClick={() => window.open(msg.file_url)} />
              )}
              {msg.type === 'voice' && (
                <div className="wc-msg-voice" onClick={() => playVoice(msg.file_url)}>
                  <span>🎵</span>
                  <span style={{ fontSize: 14 }}>语音</span>
                </div>
              )}
              {msg.type === 'file' && (
                <a href={msg.file_url} download={msg.content} className="wc-msg-file" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="wc-msg-file-icon">📄</div>
                  <div>
                    <div className="wc-msg-file-name">{msg.content}</div>
                    <div className="wc-msg-file-size">点击下载</div>
                  </div>
                </a>
              )}
            </div>
          </div>
          {msg.reactions?.length > 0 && (
            <div className="wc-reactions">
              {msg.reactions.map(r => (
                <div
                  key={r.emoji}
                  className={`wc-reaction-pill${r.userIds.includes(user.id) ? ' mine' : ''}`}
                  onClick={() => axios.post(`/api/messages/${msg.id}/react`, { emoji: r.emoji })}
                >
                  <span>{r.emoji}</span>
                  {r.count > 1 && <span>{r.count}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const memberCount = conversation.type === 'group' ? (members.length || '') : null;

  return (
    <div className="wc-chat">
      {/* Header */}
      <div className="wc-chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {conversation.type === 'group'
            ? <GroupAvatar members={members} size={36} />
            : <Avatar src={conversation.otherUser?.avatar || conversation.avatar} name={conversation.name} size={36} />
          }
          <div>
            <div className="wc-chat-header-name">
              {conversation.name || '聊天'}
              {memberCount ? <span style={{ fontSize: 13, color: '#888', fontWeight: 400, marginLeft: 6 }}>({memberCount})</span> : null}
            </div>
            {conversation.type === 'private' && conversation.otherUser?.status === 'online' && (
              <div className="wc-chat-header-sub">在线</div>
            )}
          </div>
        </div>
        <div className="wc-chat-header-right">
          {conversation.type === 'private' && <>
            <button className="wc-chat-header-btn" title="语音通话">📞</button>
            <button className="wc-chat-header-btn" title="视频通话">📹</button>
            <button className="wc-chat-header-btn" title="查看资料" onClick={() => setShowUserProfile(conversation.otherUser?.id)}>👤</button>
          </>}
          <button
            className={`wc-chat-header-btn${showGroupInfo ? ' active' : ''}`}
            title={conversation.type === 'group' ? '群聊信息' : '更多'}
            onClick={() => setShowGroupInfo(v => !v)}
          >•••</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Messages */}
        <div className="wc-messages" ref={messagesContainerRef} onScroll={handleScroll}>
          {loadingMore && <div style={{ textAlign: 'center', padding: 8, fontSize: 12, color: '#B2B2B2' }}>加载中...</div>}
          {renderMessages()}
          {typingName && (
            <div style={{ fontSize: 12, color: '#B2B2B2', padding: '4px 0' }}>{typingName} 正在输入...</div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Group info panel */}
        {showGroupInfo && conversation.type === 'group' && (
          <GroupInfo
            conversation={conversation}
            currentUserId={user.id}
            onClose={() => setShowGroupInfo(false)}
            onLeave={() => { setShowGroupInfo(false); onClose?.(); }}
            onConvUpdate={(data) => setConversation(prev => ({ ...prev, ...data }))}
          />
        )}
      </div>

      {/* User profile modal */}
      {showUserProfile && (
        <UserProfile
          userId={showUserProfile}
          onClose={() => setShowUserProfile(null)}
          onStartChat={(conv) => { setShowUserProfile(null); }}
        />
      )}

      {/* Reply bar */}
      {replyTo && (
        <div className="wc-reply-bar">
          <div>
            <div className="wc-reply-bar-name">回复 {replyTo.senderName}</div>
            <div className="wc-reply-bar-text">
              {replyTo.type === 'image' ? '[图片]' : replyTo.type === 'voice' ? '[语音]' : replyTo.content}
            </div>
          </div>
          <button className="wc-reply-bar-close" onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

      {/* Input area */}
      <div className="wc-input-area">
        <div className="wc-input-toolbar">
          <button className={`wc-tool-btn${showEmoji ? ' active' : ''}`} title="表情" onClick={() => { setShowEmoji(!showEmoji); setShowMore(false); }}>
            😊
          </button>
          <button className={`wc-tool-btn${voiceMode ? ' active' : ''}`} title="语音" onClick={() => setVoiceMode(!voiceMode)}>
            🎤
          </button>
          <label className="wc-tool-btn" title="图片" style={{ cursor: 'pointer' }}>
            🖼️
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>
          <label className="wc-tool-btn" title="文件" style={{ cursor: 'pointer' }}>
            📎
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>
          <button className={`wc-tool-btn${showMore ? ' active' : ''}`} title="更多" onClick={() => { setShowMore(!showMore); setShowEmoji(false); }}>
            ＋
          </button>
        </div>

        {showEmoji && <EmojiPicker onSelect={e => setInput(prev => prev + e)} />}

        {showMore && (
          <div className="wc-more-panel">
            {[
              { icon: '📷', label: '相机', action: () => {} },
              { icon: '📍', label: '位置', action: () => {} },
              { icon: '👤', label: '名片', action: () => {} },
              { icon: '📅', label: '红包', action: () => {} },
              { icon: '📁', label: '文件', action: () => fileInputRef.current?.click() },
              { icon: '📹', label: '视频通话', action: () => {} },
              { icon: '📞', label: '语音通话', action: () => {} },
              { icon: '🎵', label: '音乐', action: () => {} },
            ].map(item => (
              <div key={item.label} className="wc-more-item" onClick={item.action}>
                <div className="wc-more-icon">{item.icon}</div>
                <span className="wc-more-label">{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {!showEmoji && !showMore && (
          <>
            {voiceMode ? (
              <div style={{ padding: '4px 12px 10px' }}>
                <button
                  className={`wc-voice-btn${recording ? ' recording' : ''}`}
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                >
                  {recording ? '🔴 松开发送' : '按住说话'}
                </button>
              </div>
            ) : (
              <div className="wc-input-box">
                {/* @mention dropdown */}
                {atList && (
                  <div style={{ position: 'absolute', bottom: '100%', left: 12, background: '#fff', border: '1px solid #E5E5E5', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 160, zIndex: 100, maxHeight: 200, overflowY: 'auto' }}>
                    {atList.filter(m => m.id !== user.id).map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer' }} onClick={() => insertAtMention(m)}>
                        <Avatar src={m.avatar} name={m.username} size={24} />
                        <span style={{ fontSize: 14 }}>{m.username}</span>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  className="wc-textarea"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息..."
                  rows={3}
                />
              </div>
            )}
            {!voiceMode && (
              <div className="wc-input-footer">
                <button className="wc-send-btn" onClick={sendMessage} disabled={!input.trim()}>发送</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <>
          <div className="wc-ctx-overlay" onClick={closeCtx} />
          <div className="wc-ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
            <div className="wc-ctx-emoji-row">
              {REACTIONS.map(e => (
                <span key={e} className="wc-ctx-emoji" onClick={() => ctxAction(`react:${e}`)}>{e}</span>
              ))}
            </div>
            <div className="wc-ctx-divider" />
            <div className="wc-ctx-item" onClick={() => ctxAction('reply')}>↩ 回复</div>
            {ctxMenu.msg.type === 'text' && (
              <div className="wc-ctx-item" onClick={() => ctxAction('copy')}>📋 复制</div>
            )}
            <div className="wc-ctx-item" onClick={() => ctxAction('collect')}>⭐ 收藏</div>
            <div className="wc-ctx-divider" />
            {ctxMenu.msg.sender_id === user.id && (
              <div className="wc-ctx-item danger" onClick={() => ctxAction('delete')}>🗑 撤回</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
