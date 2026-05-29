import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import EmojiPicker from './EmojiPicker';
import GroupInfo, { GroupAvatar } from './GroupInfo';
import UserProfile from './UserProfile';
import ForwardModal from './ForwardModal';
import CallModal from './CallModal';
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
  const [myGroupRole, setMyGroupRole] = useState('member'); // 'owner'|'admin'|'member'
  const [groupSettings, setGroupSettings] = useState({ mute_all: 0, no_private_chat: 0 });
  const [showUserProfile, setShowUserProfile] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  // 多选模式
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedMsgs, setSelectedMsgs] = useState(new Set());
  // 置顶消息
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPinnedDetail, setShowPinnedDetail] = useState(false);
  const [atList, setAtList] = useState(null); // members for @ mention
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // 通话状态
  const [activeCall, setActiveCall] = useState(null);
  // 搜索消息
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearchQ, setMsgSearchQ] = useState('');
  const [msgSearchResults, setMsgSearchResults] = useState([]);
  const [msgSearching, setMsgSearching] = useState(false);
  // 位置
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationInfo, setLocationInfo] = useState(null); // {lat, lng, address}
  const [locating, setLocating] = useState(false);
  // 红包
  const [showRedPacketModal, setShowRedPacketModal] = useState(false);
  const [redPacketForm, setRedPacketForm] = useState({ amount: 100, count: 1, greeting: '恭喜发财，大吉大利' });
  const [showRedPacketDetail, setShowRedPacketDetail] = useState(null); // packetId
  const [redPacketDetailData, setRedPacketDetailData] = useState(null);
  const [claiming, setClaiming] = useState(false);
  // 名片
  const [showContactCardModal, setShowContactCardModal] = useState(false);
  const [cardContacts, setCardContacts] = useState([]);
  const [cardSearch, setCardSearch] = useState('');
  const [cardLoading, setCardLoading] = useState(false);
  // 撤回重新编辑
  const recalledContentRef = useRef({}); // msgId -> originalContent
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimer = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const textareaRef = useRef(null);
  const { socket } = useSocket();
  const { user } = useAuth();

  // 搜索消息
  const searchMessages = useCallback(async (q) => {
    if (!q.trim()) { setMsgSearchResults([]); return; }
    setMsgSearching(true);
    try {
      const { data } = await axios.get(`/api/messages/conversation/${conversation.id}/search`, { params: { q } });
      setMsgSearchResults(data);
    } catch { setMsgSearchResults([]); }
    setMsgSearching(false);
  }, [conversation.id]);

  // 发起通话
  const startCall = useCallback((type) => {
    if (conversation.type !== 'private') return;
    const remoteUser = { id: conversation.otherUser?.id, name: conversation.name, avatar: conversation.avatar };
    socket?.emit('call:request', {
      to: conversation.otherUser?.id,
      type,
      caller: { id: user.id, name: user.username, avatar: user.avatar },
    });
    setActiveCall({ type, direction: 'outgoing', remoteUser, remoteId: conversation.otherUser?.id });
  }, [socket, conversation, user]);

  // 监听来电（本 ChatWindow 对应的联系人打来的电话）
  useEffect(() => {
    if (!socket) return;
    const onIncoming = ({ from, type, caller }) => {
      // 只响应当前打开的私聊对方
      if (from !== conversation.otherUser?.id) return;
      setActiveCall({ type, direction: 'incoming', remoteUser: { id: from, name: caller?.name, avatar: caller?.avatar }, remoteId: from });
    };
    socket.on('call:incoming', onIncoming);
    return () => socket.off('call:incoming', onIncoming);
  }, [socket, conversation.otherUser?.id]);

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
    setMultiSelect(false);
    setSelectedMsgs(new Set());
    setPinnedMessages([]);
    // 加载置顶消息
    axios.get(`/api/messages/conversation/${conversation.id}/pinned-messages`).then(r => setPinnedMessages(r.data)).catch(() => {});

    fetchMessages().then(data => {
      setMessages(data);
      setHasMore(data.length === 40);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
    });

    socket?.emit('join_conversation', { conversationId: conversation.id });

    if (conversation.type === 'group') {
      // 获取群详情：成员列表、我的角色、管理设置
      axios.get(`/api/messages/conversation/${conversation.id}/info`).then(r => {
        setMembers(r.data.members || []);
        setMyGroupRole(r.data.myRole || 'member');
        setGroupSettings({ mute_all: r.data.mute_all || 0, no_private_chat: r.data.no_private_chat || 0 });
      }).catch(() => {});
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
      setMessages(prev => {
        const target = prev.find(m => m.id === msgId);
        if (target && target.sender_id === user.id && target.type === 'text' && !target.deleted) {
          recalledContentRef.current[msgId] = target.content;
        }
        return prev.map(m => m.id === msgId ? { ...m, deleted: 1, content: '消息已撤回' } : m);
      });
    };
    const onEdited = ({ msgId, content }) => {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content, edited: 1 } : m));
    };
    const onReaction = ({ msgId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reactions } : m));
    };
    const onRead = ({ userId: uid, conversationId, readAt }) => {
      if (conversationId !== conversation.id || uid === user.id) return;
      if (conversation.type === 'private') {
        setMessages(prev => {
          const copy = [...prev];
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].sender_id === user.id) { copy[i] = { ...copy[i], _read: true }; break; }
          }
          return copy;
        });
      } else {
        // 群聊：重新计算已读数（简单做法：增加每条<=readAt的消息readCount）
        setMessages(prev => prev.map(m =>
          m.sender_id !== uid && m.created_at <= readAt
            ? { ...m, readCount: (m.readCount || 0) + 1 }
            : m
        ));
      }
    };
    const onRedPacketClaimed = ({ packetId }) => {
      // 刷新当前展示的红包详情
      setShowRedPacketDetail(prev => { if (prev === packetId) { loadRedPacketDetail(packetId); } return prev; });
    };
    const onGroupUpdated = ({ id }) => {
      if (id === conversation.id) {
        axios.get(`/api/messages/conversation/${conversation.id}/info`).then(r => {
          setMembers(r.data.members || []);
          setMyGroupRole(r.data.myRole || 'member');
          setGroupSettings({ mute_all: r.data.mute_all || 0, no_private_chat: r.data.no_private_chat || 0 });
        }).catch(() => {});
      }
    };
    const onPinned = (data) => {
      if (data.convId !== conversation.id) return;
      setPinnedMessages(prev => {
        if (prev.find(p => p.msgId === data.msgId)) return prev;
        return [{ msgId: data.msgId, content: data.content, type: data.type, pinnedByName: data.pinnedBy }, ...prev];
      });
    };
    const onUnpinned = ({ msgId, convId }) => {
      if (convId !== conversation.id) return;
      setPinnedMessages(prev => prev.filter(p => p.msgId !== msgId));
    };
    const onGroupSettingsUpdated = (data) => {
      if (data.id === conversation.id) {
        setGroupSettings(prev => ({ ...prev, mute_all: data.mute_all ?? prev.mute_all, no_private_chat: data.no_private_chat ?? prev.no_private_chat }));
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
    socket.on('message_edited', onEdited);
    socket.on('message_reaction', onReaction);
    socket.on('message_read', onRead);
    socket.on('red_packet_claimed', onRedPacketClaimed);
    socket.on('group_updated', onGroupUpdated);
    socket.on('group_kicked', onGroupKicked);
    socket.on('group_dismissed', onGroupDismissed);
    socket.on('group_settings_updated', onGroupSettingsUpdated);
    socket.on('message_pinned', onPinned);
    socket.on('message_unpinned', onUnpinned);
    return () => {
      socket.off('new_message', onMsg);
      socket.off('typing', onTyping);
      socket.off('stop_typing', onStopTyping);
      socket.off('message_deleted', onDeleted);
      socket.off('message_edited', onEdited);
      socket.off('message_reaction', onReaction);
      socket.off('message_read', onRead);
      socket.off('red_packet_claimed', onRedPacketClaimed);
      socket.off('group_updated', onGroupUpdated);
      socket.off('group_kicked', onGroupKicked);
      socket.off('group_dismissed', onGroupDismissed);
      socket.off('group_settings_updated', onGroupSettingsUpdated);
      socket.off('message_pinned', onPinned);
      socket.off('message_unpinned', onUnpinned);
    };
  }, [socket, conversation.id, user.id, messages, onClose]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    // ── 编辑模式：提交编辑 ──
    if (editingMsg) {
      if (input.trim() === editingMsg.content) { cancelEdit(); return; }
      try {
        await axios.put(`/api/messages/${editingMsg.id}/edit`, { content: input.trim() });
        cancelEdit();
      } catch (e) { alert(e.response?.data?.error || '编辑失败'); }
      return;
    }

    // ── 普通发送 ──
    if (!socket) return;
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

  const startEdit = (msg) => {
    setEditingMsg({ id: msg.id, content: msg.content });
    setInput(msg.content);
    setReplyTo(null);
    setTimeout(() => { textareaRef.current?.focus(); textareaRef.current?.select(); }, 50);
  };

  const cancelEdit = () => {
    setEditingMsg(null);
    setInput('');
    textareaRef.current?.focus();
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
        setReplyTo(msg); setEditingMsg(null);
        textareaRef.current?.focus();
        break;

      case 'copy':
        if (msg.type === 'text') navigator.clipboard.writeText(msg.content).catch(() => {});
        else alert('只有文字消息可以复制');
        break;

      case 'edit':
        if (msg.sender_id !== user.id) { alert('只能编辑自己的消息'); return; }
        if (msg.type !== 'text') { alert('只能编辑文字消息'); return; }
        if ((Math.floor(Date.now() / 1000) - msg.created_at) > 120) { alert('超过2分钟，无法编辑'); return; }
        startEdit(msg);
        break;

      case 'forward':
        setForwardMsg(msg);
        break;

      case 'multiselect':
        setMultiSelect(true);
        setSelectedMsgs(new Set([msg.id]));
        break;

      case 'pin': {
        const already = pinnedMessages.some(p => p.msgId === msg.id);
        if (already) {
          await axios.delete(`/api/messages/conversation/${conversation.id}/pin-message/${msg.id}`).catch(e => alert(e.response?.data?.error || '操作失败'));
        } else {
          await axios.post(`/api/messages/conversation/${conversation.id}/pin-message`, { msgId: msg.id }).catch(e => alert(e.response?.data?.error || '操作失败'));
        }
        break;
      }

      case 'collect':
        await axios.post(`/api/messages/${msg.id}/collect`).catch(() => {});
        break;

      case 'delete': {
        const now = Math.floor(Date.now() / 1000);
        const isOwn = msg.sender_id === user.id;
        const inTime = (now - msg.created_at) <= 120;
        const isAdmin = myGroupRole === 'owner' || myGroupRole === 'admin';
        if (isOwn && inTime) {
          if (confirm('确认撤回这条消息？')) {
            await axios.delete(`/api/messages/${msg.id}`, { data: { forEveryone: true } }).catch(() => {});
          }
        } else if (!isOwn && isAdmin && conversation.type === 'group') {
          if (confirm('删除该消息（对全员生效）？')) {
            await axios.delete(`/api/messages/${msg.id}`, { data: { forEveryone: true } }).catch(() => {});
          }
        } else if (isOwn && !inTime) {
          alert('超过2分钟，无法撤回');
        }
        break;
      }

      default:
        if (action.startsWith('react:')) {
          await axios.post(`/api/messages/${msg.id}/react`, { emoji: action.replace('react:', '') }).catch(() => {});
        }
    }
  };

  // 多选辅助
  const toggleMsgSelect = (msgId) => {
    setSelectedMsgs(prev => { const s = new Set(prev); s.has(msgId) ? s.delete(msgId) : s.add(msgId); return s; });
  };
  const multiForward = () => {
    const msgs = messages.filter(m => selectedMsgs.has(m.id));
    if (msgs.length === 1) { setForwardMsg(msgs[0]); setMultiSelect(false); setSelectedMsgs(new Set()); }
    else alert('请逐条转发（每次选一条）');
  };
  const multiDelete = async () => {
    if (!confirm(`确认撤回/删除选中的 ${selectedMsgs.size} 条消息？`)) return;
    await axios.post('/api/messages/batch-delete', { msgIds: [...selectedMsgs], conversationId: conversation.id }).catch(e => alert(e.response?.data?.error || '操作失败'));
    setMultiSelect(false); setSelectedMsgs(new Set());
  };

  const playVoice = (url) => {
    new Audio(url).play();
  };

  // 获取当前位置
  const openLocationModal = () => {
    setLocating(true);
    setLocationInfo(null);
    setShowLocationModal(true);
    if (!navigator.geolocation) {
      setLocationInfo({ lat: 0, lng: 0, address: '设备不支持定位' });
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      let address = `${lat}, ${lng}`;
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=zh`);
        const data = await r.json();
        address = data.display_name || address;
      } catch {}
      setLocationInfo({ lat, lng, address });
      setLocating(false);
    }, () => {
      setLocationInfo({ lat: 0, lng: 0, address: '获取位置失败' });
      setLocating(false);
    }, { timeout: 10000 });
  };

  const sendLocation = () => {
    if (!locationInfo) return;
    socket?.emit('send_message', {
      conversationId: conversation.id,
      content: JSON.stringify(locationInfo),
      type: 'location',
    });
    setShowLocationModal(false);
    setShowMore(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // 发红包
  const sendRedPacket = async () => {
    try {
      await axios.post('/api/messages/red-packet/send', {
        conversationId: conversation.id,
        totalAmount: redPacketForm.amount,
        totalCount: redPacketForm.count,
        greeting: redPacketForm.greeting,
      });
      setShowRedPacketModal(false);
      setShowMore(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) { alert(e.response?.data?.error || '发送失败'); }
  };

  const loadRedPacketDetail = async (packetId) => {
    try {
      const { data } = await axios.get(`/api/messages/red-packet/${packetId}`);
      setRedPacketDetailData(data);
    } catch {}
  };

  const claimRedPacket = async (packetId) => {
    if (claiming) return;
    setClaiming(true);
    try {
      const { data } = await axios.post(`/api/messages/red-packet/${packetId}/claim`);
      alert(`🎉 恭喜领到 ${data.amount} 金币！`);
      loadRedPacketDetail(packetId);
    } catch (e) {
      const msg = e.response?.data?.error || '领取失败';
      if (e.response?.data?.amount) {
        alert(`您已领取过，金额：${e.response.data.amount} 金币`);
      } else {
        alert(msg);
      }
    }
    setClaiming(false);
  };

  // 打开名片选人弹窗
  const openContactCardModal = async () => {
    setShowContactCardModal(true);
    setCardSearch('');
    if (cardContacts.length === 0) {
      setCardLoading(true);
      try {
        const { data } = await axios.get('/api/users/contacts');
        setCardContacts(data);
      } catch {}
      setCardLoading(false);
    }
  };

  // 发送名片
  const sendContactCard = (contact) => {
    const content = JSON.stringify({
      userId: contact.id,
      username: contact.remark || contact.username,
      realName: contact.username,
      avatar: contact.avatar || '',
      bio: contact.bio || '',
      wechat_id: contact.wechat_id || '',
    });
    socket?.emit('send_message', { conversationId: conversation.id, content, type: 'contact_card' });
    setShowContactCardModal(false);
    setShowMore(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
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
      const recalled = recalledContentRef.current[msg.id];
      return (
        <div key={msg.id} style={{ textAlign: 'center', margin: '4px 0' }}>
          <span style={{ fontSize: 12, color: '#B2B2B2' }}>
            {msg.sender_id === user.id ? '你撤回了一条消息' : `"${msg.senderName}"撤回了一条消息`}
          </span>
          {recalled && (
            <span
              style={{ fontSize: 12, color: '#07C160', marginLeft: 8, cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => { setInput(recalled); textareaRef.current?.focus(); delete recalledContentRef.current[msg.id]; }}
            >重新编辑</span>
          )}
        </div>
      );
    }

    const isMine = msg.sender_id === user.id;
    const showRead = isMine && msg._read && conversation.type === 'private';
    const isLastMine = isMine && !messages.slice(idx + 1).find(m => m.sender_id === user.id && !m.deleted);

    // 禁私聊权限判断：非管理员/群主 无法点击其他普通成员头像
    const canClickAvatar = (() => {
      if (isMine || conversation.type !== 'group') return true;
      if (!groupSettings.no_private_chat) return true;          // 未开启禁私聊
      if (myGroupRole === 'owner' || myGroupRole === 'admin') return true; // 管理员不受限
      // 普通成员：检查对方是否也是普通成员
      const senderMember = members.find(m => m.id === msg.sender_id);
      return senderMember?.role === 'owner' || senderMember?.role === 'admin'; // 只能点管理员
    })();

    const handleAvatarClick = () => {
      if (!canClickAvatar) {
        // 给出一个轻提示（不打断体验）
        const tip = document.createElement('div');
        tip.textContent = '群主已开启禁止私聊';
        Object.assign(tip.style, { position:'fixed', bottom:'80px', left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,.6)', color:'#fff', padding:'7px 16px', borderRadius:'4px', fontSize:'13px', zIndex:'9999', pointerEvents:'none' });
        document.body.appendChild(tip);
        setTimeout(() => document.body.removeChild(tip), 2000);
        return;
      }
      if (!isMine) setShowUserProfile(msg.sender_id);
    };

    return (
      <div
        key={msg.id}
        className={`wc-msg-row${isMine ? ' mine' : ''}${multiSelect ? ' multiselect-row' : ''}`}
        onClick={multiSelect ? () => toggleMsgSelect(msg.id) : undefined}
        style={multiSelect ? { cursor: 'pointer' } : {}}
      >
        {/* 多选复选框 */}
        {multiSelect && (
          <div style={{ display: 'flex', alignItems: 'center', marginRight: 8, flexShrink: 0, alignSelf: 'center' }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, border: `2px solid ${selectedMsgs.has(msg.id) ? '#07C160' : '#D9D9D9'}`, background: selectedMsgs.has(msg.id) ? '#07C160' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .1s' }}>
              {selectedMsgs.has(msg.id) && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✓</span>}
            </div>
          </div>
        )}
        <div className="wc-msg-avatar" onClick={!multiSelect ? handleAvatarClick : undefined} style={{ cursor: !multiSelect && canClickAvatar && !isMine ? 'pointer' : 'default' }}>
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
              {msg.type === 'text' && (
                <span>
                  {msg.content}
                  {msg.edited ? <span style={{ fontSize: 10, color: isMine ? 'rgba(0,0,0,.35)' : '#B2B2B2', marginLeft: 5 }}>已编辑</span> : null}
                </span>
              )}
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
              {msg.type === 'location' && (() => {
                let loc = {};
                try { loc = JSON.parse(msg.content); } catch {}
                const mapsUrl = `https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=16/${loc.lat}/${loc.lng}`;
                return (
                  <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 180, maxWidth: 240 }}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>📍</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>位置</div>
                        <div style={{ fontSize: 11, color: isMine ? 'rgba(255,255,255,0.8)' : '#888', lineHeight: 1.4, wordBreak: 'break-all' }}>{loc.address}</div>
                        <div style={{ fontSize: 11, color: isMine ? 'rgba(255,255,255,0.6)' : '#B2B2B2', marginTop: 3 }}>点击查看地图</div>
                      </div>
                    </div>
                  </a>
                );
              })()}
              {msg.type === 'contact_card' && (() => {
                let card = {};
                try { card = JSON.parse(msg.content); } catch {}
                return (
                  <div
                    style={{ background: isMine ? 'rgba(255,255,255,0.15)' : '#fff', border: `1px solid ${isMine ? 'rgba(255,255,255,0.3)' : '#E5E5E5'}`, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', minWidth: 200 }}
                    onClick={() => card.userId && setShowUserProfile(card.userId)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                      <Avatar src={card.avatar} name={card.username} size={42} style={{ borderRadius: 8, flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: isMine ? '#fff' : '#191919', marginBottom: 2 }}>{card.username}</div>
                        {card.wechat_id && <div style={{ fontSize: 11, color: isMine ? 'rgba(255,255,255,0.65)' : '#888' }}>微信号：{card.wechat_id}</div>}
                        {card.bio && !card.wechat_id && <div style={{ fontSize: 11, color: isMine ? 'rgba(255,255,255,0.65)' : '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.bio}</div>}
                      </div>
                    </div>
                    <div style={{ borderTop: `1px solid ${isMine ? 'rgba(255,255,255,0.2)' : '#F0F0F0'}`, padding: '6px 12px', fontSize: 12, color: isMine ? 'rgba(255,255,255,0.7)' : '#07C160', textAlign: 'center' }}>
                      个人名片
                    </div>
                  </div>
                );
              })()}
              {msg.type === 'red_packet' && (() => {
                let rp = {};
                try { rp = JSON.parse(msg.content); } catch {}
                return (
                  <div
                    style={{ background: isMine ? 'rgba(0,0,0,0.15)' : 'rgba(220,80,30,0.1)', border: `1px solid ${isMine ? 'rgba(255,255,255,0.3)' : '#FA8C16'}`, borderRadius: 8, padding: '10px 14px', cursor: 'pointer', minWidth: 180 }}
                    onClick={() => { setShowRedPacketDetail(rp.packetId); loadRedPacketDetail(rp.packetId); }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 28 }}>🧧</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: isMine ? '#fff' : '#D4380D' }}>{rp.greeting || '恭喜发财'}</div>
                        <div style={{ fontSize: 11, color: isMine ? 'rgba(255,255,255,0.7)' : '#888', marginTop: 2 }}>
                          共 {rp.totalCount} 个 · {rp.totalAmount} 金币 · 点击领取
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          {/* 群消息已读数 */}
          {conversation.type === 'group' && isMine && msg.readCount > 0 && (
            <div style={{ fontSize: 11, color: '#B2B2B2', textAlign: 'right', marginTop: 2, paddingRight: 4 }}>{msg.readCount}人已读</div>
          )}
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

  /* ── SVG icon helpers ── */
  const IcoVoiceCall = () => <svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>;
  const IcoVideoCall = () => <svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>;
  const IcoInfo = () => <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>;
  const IcoEmoji = () => <svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>;
  const IcoMic = () => <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93h2c0 3.31 2.69 6 6 6s6-2.69 6-6h2c0 4.08-3.06 7.44-7 7.93V19h3v2H9v-2h3v-3.07z"/></svg>;
  const IcoImage = () => <svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>;
  const IcoFile = () => <svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>;
  const IcoMore = () => <svg viewBox="0 0 24 24"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>;
  const IcoPerson = () => <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>;

  return (
    <div className="wc-chat">
      {/* ── 通话弹窗 ── */}
      {activeCall && (
        <CallModal
          socket={socket}
          user={user}
          call={activeCall}
          onClose={() => setActiveCall(null)}
        />
      )}
      {/* ── Header ── */}
      <div className="wc-chat-header">
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div className="wc-chat-header-name">
            {conversation.name || '聊天'}
            {memberCount
              ? <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 5 }}>({memberCount})</span>
              : null
            }
          </div>
          {conversation.type === 'private' && conversation.otherUser?.status === 'online' && (
            <div className="wc-chat-header-sub">在线</div>
          )}
        </div>
        <div className="wc-chat-header-right">
          {/* 搜索聊天记录 */}
          <button
            className={`wc-chat-header-btn${showMsgSearch ? ' active' : ''}`}
            title="搜索聊天记录"
            onClick={() => { setShowMsgSearch(v => !v); setMsgSearchQ(''); setMsgSearchResults([]); }}
          >
            <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          </button>
          {conversation.type === 'private' && <>
            <button className="wc-chat-header-btn" title="语音通话" onClick={() => startCall('audio')}><IcoVoiceCall /></button>
            <button className="wc-chat-header-btn" title="视频通话" onClick={() => startCall('video')}><IcoVideoCall /></button>
            <button className="wc-chat-header-btn" title="查看资料" onClick={() => setShowUserProfile(conversation.otherUser?.id)}><IcoPerson /></button>
          </>}
          <button
            className={`wc-chat-header-btn${showGroupInfo ? ' active' : ''}`}
            title={conversation.type === 'group' ? '群聊信息' : '更多'}
            onClick={() => setShowGroupInfo(v => !v)}
          ><IcoMore /></button>
        </div>
      </div>

      {/* ── 搜索消息面板 ── */}
      {showMsgSearch && (
        <div style={{ background: 'var(--bg-chat-header)', borderBottom: '1px solid rgba(0,0,0,.09)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', gap: 8 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-search)', borderRadius: 5, padding: '5px 10px', height: 28 }}>
              <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, fill: 'var(--text-tertiary)', flexShrink: 0 }}><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
              <input
                autoFocus
                value={msgSearchQ}
                onChange={e => { setMsgSearchQ(e.target.value); searchMessages(e.target.value); }}
                placeholder="搜索聊天记录..."
                style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', background: 'transparent' }}
                onKeyDown={e => e.key === 'Escape' && setShowMsgSearch(false)}
              />
              {msgSearchQ && <button style={{ color: 'var(--text-tertiary)', fontSize: 14 }} onClick={() => { setMsgSearchQ(''); setMsgSearchResults([]); }}>✕</button>}
            </div>
            <button style={{ color: '#07C160', fontSize: 13 }} onClick={() => setShowMsgSearch(false)}>关闭</button>
          </div>
          {/* 搜索结果 */}
          {msgSearchQ && (
            <div style={{ maxHeight: 220, overflowY: 'auto', borderTop: '1px solid rgba(0,0,0,.05)' }}>
              {msgSearching && <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: 'var(--text-tertiary)' }}>搜索中…</div>}
              {!msgSearching && msgSearchResults.length === 0 && msgSearchQ && (
                <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: 'var(--text-tertiary)' }}>未找到相关记录</div>
              )}
              {msgSearchResults.map(msg => {
                const q = msgSearchQ.toLowerCase();
                const idx = msg.content.toLowerCase().indexOf(q);
                return (
                  <div
                    key={msg.id}
                    style={{ display: 'flex', gap: 8, padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,.04)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                    onClick={() => {
                      // 跳转到该消息（添加到消息列表并高亮）
                      const exists = messages.find(m => m.id === msg.id);
                      if (!exists) setMessages(prev => [...prev, { ...msg, _highlighted: true }]);
                      setTimeout(() => {
                        const el = document.getElementById(`msg-${msg.id}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 100);
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--link-color)' }}>{msg.senderName}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {new Date(msg.created_at * 1000).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {idx >= 0 ? (
                          <>
                            {msg.content.slice(0, idx)}
                            <span style={{ color: '#07C160', fontWeight: 600 }}>{msg.content.slice(idx, idx + msgSearchQ.length)}</span>
                            {msg.content.slice(idx + msgSearchQ.length)}
                          </>
                        ) : msg.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 置顶消息 Banner ── */}
      {pinnedMessages.length > 0 && (
        <div style={{ background: '#FFFDE7', borderBottom: '1px solid #FFE082', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, cursor: 'pointer' }}
          onClick={() => setShowPinnedDetail(v => !v)}>
          <span style={{ fontSize: 11, color: '#FF8F00', fontWeight: 600, flexShrink: 0 }}>📌 置顶</span>
          <span style={{ fontSize: 13, color: '#555', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pinnedMessages[0]?.type === 'image' ? '[图片]' : pinnedMessages[0]?.content}
          </span>
          {pinnedMessages.length > 1 && <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>+{pinnedMessages.length - 1}</span>}
          <span style={{ fontSize: 12, color: '#B2B2B2', flexShrink: 0 }}>{showPinnedDetail ? '▲' : '▼'}</span>
        </div>
      )}
      {showPinnedDetail && pinnedMessages.length > 0 && (
        <div style={{ background: '#FFFDE7', borderBottom: '1px solid #FFE082', maxHeight: 180, overflowY: 'auto', flexShrink: 0 }}>
          {pinnedMessages.map(p => (
            <div key={p.msgId} style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', gap: 8, borderTop: '1px solid rgba(0,0,0,.04)' }}>
              <span style={{ fontSize: 20 }}>📌</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>{p.senderName} · 由{p.pinnedByName}置顶</div>
                <div style={{ fontSize: 13, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.type === 'image' ? '[图片]' : p.content}</div>
              </div>
              <button style={{ fontSize: 12, color: '#FA5151', padding: '2px 8px', border: '1px solid #FFCDD2', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
                onClick={e => { e.stopPropagation(); axios.delete(`/api/messages/conversation/${conversation.id}/pin-message/${p.msgId}`); }}>
                取消置顶
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div className="wc-messages" ref={messagesContainerRef} onScroll={handleScroll}>
          {loadingMore && (
            <div style={{ textAlign: 'center', padding: '6px 0', fontSize: 11, color: 'var(--text-tertiary)' }}>加载中...</div>
          )}
          {renderMessages()}
          {typingName && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 0 2px', marginTop: 4 }}>
              {typingName} 正在输入…
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {showGroupInfo && conversation.type === 'group' && (
          <GroupInfo
            conversation={conversation}
            currentUserId={user.id}
            onClose={() => setShowGroupInfo(false)}
            onLeave={() => { setShowGroupInfo(false); onClose?.(); }}
            onConvUpdate={(data) => {
              setConversation(prev => ({ ...prev, ...data }));
              if (data.mute_all !== undefined || data.no_private_chat !== undefined) {
                setGroupSettings(prev => ({ ...prev, ...data }));
              }
            }}
          />
        )}
        {showGroupInfo && conversation.type === 'private' && (
          <PrivateChatSettings
            conversation={conversation}
            onClose={() => setShowGroupInfo(false)}
            onConvUpdate={(data) => setConversation(prev => ({ ...prev, ...data }))}
          />
        )}
      </div>

      {/* User profile modal */}
      {showUserProfile && (
        <UserProfile
          userId={showUserProfile}
          onClose={() => setShowUserProfile(null)}
          onStartChat={() => setShowUserProfile(null)}
        />
      )}

      {/* ── 编辑模式指示条 ── */}
      {editingMsg && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#FFF8E1', padding:'6px 14px', borderTop:'1px solid #FFE082', gap:8 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, color:'#E65100', fontWeight:600, marginBottom:2 }}>编辑消息</div>
            <div style={{ fontSize:12, color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{editingMsg.content}</div>
          </div>
          <button style={{ color:'#888', fontSize:14, cursor:'pointer', padding:2 }} onClick={cancelEdit}>✕</button>
        </div>
      )}

      {/* ── Reply preview bar ── */}
      {replyTo && !editingMsg && (
        <div className="wc-reply-bar">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="wc-reply-bar-name">回复 {replyTo.senderName}</div>
            <div className="wc-reply-bar-text">
              {replyTo.type === 'image' ? '[图片]' : replyTo.type === 'voice' ? '[语音]' : replyTo.content}
            </div>
          </div>
          <button className="wc-reply-bar-close" onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

      {/* ── 转发弹窗 ── */}
      {forwardMsg && (
        <ForwardModal message={forwardMsg} onClose={() => setForwardMsg(null)} />
      )}

      {/* ── 多选模式底部工具栏 ── */}
      {multiSelect && (
        <div style={{ background: '#F5F5F5', borderTop: '1px solid rgba(0,0,0,.07)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <button style={{ fontSize: 14, color: '#07C160', padding: '6px 14px', border: '1px solid #07C160', borderRadius: 4, cursor: 'pointer' }} onClick={() => { setMultiSelect(false); setSelectedMsgs(new Set()); }}>取消</button>
          <span style={{ fontSize: 13, color: '#888' }}>已选 {selectedMsgs.size} 条</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ fontSize: 14, color: '#fff', background: '#07C160', padding: '6px 16px', borderRadius: 4, cursor: 'pointer', opacity: selectedMsgs.size === 0 ? 0.5 : 1 }} onClick={multiForward} disabled={selectedMsgs.size === 0}>转发</button>
            <button style={{ fontSize: 14, color: '#fff', background: '#FA5151', padding: '6px 16px', borderRadius: 4, cursor: 'pointer', opacity: selectedMsgs.size === 0 ? 0.5 : 1 }} onClick={multiDelete} disabled={selectedMsgs.size === 0}>撤回</button>
          </div>
        </div>
      )}

      {/* ── 全群禁言提示（普通成员被禁言时替换输入区） ── */}
      {!multiSelect && conversation.type === 'group' && groupSettings.mute_all && myGroupRole === 'member' ? (
        <div style={{ background: '#F5F5F5', borderTop: '1px solid rgba(0,0,0,.07)', padding: '14px 20px', textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: '#B2B2B2' }}>🔇 全员禁言已开启，只有群主和管理员可以发送消息</span>
        </div>
      ) : (
      /* ── Input area ── */
      <div className="wc-input-area">
        {/* Toolbar */}
        <div className="wc-input-toolbar">
          <button
            className={`wc-tool-btn${showEmoji ? ' active' : ''}`}
            title="表情"
            onClick={() => { setShowEmoji(v => !v); setShowMore(false); }}
          ><IcoEmoji /></button>

          <button
            className={`wc-tool-btn${voiceMode ? ' active' : ''}`}
            title={voiceMode ? '切换文字' : '语音输入'}
            onClick={() => setVoiceMode(v => !v)}
          ><IcoMic /></button>

          <label className="wc-tool-btn" title="图片" style={{ cursor: 'pointer' }}>
            <IcoImage />
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>

          <label className="wc-tool-btn" title="文件" style={{ cursor: 'pointer' }}>
            <IcoFile />
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>

          <button
            className={`wc-tool-btn${showMore ? ' active' : ''}`}
            title="更多"
            onClick={() => { setShowMore(v => !v); setShowEmoji(false); }}
          ><IcoMore /></button>
        </div>

        {/* Emoji panel */}
        {showEmoji && <EmojiPicker onSelect={e => { setInput(prev => prev + e); textareaRef.current?.focus(); }} />}

        {/* More panel */}
        {showMore && (
          <div className="wc-more-panel">
            {[
              { bg:'#2B2B2B', svg:<svg viewBox="0 0 24 24" style={{width:24,height:24,fill:'#fff'}}><path d="M12 15.2A3.2 3.2 0 008.8 12 3.2 3.2 0 0012 8.8 3.2 3.2 0 0115.2 12 3.2 3.2 0 0112 15.2M12 7a5 5 0 000 10A5 5 0 0012 7m0-5c0 0-8.02 0-9.5 1.5S1 7 1 12s0 8 1.5 9.5S7 23 12 23s8 0 9.5-1.5S23 17 23 12s0-8-1.5-9.5S17 1 12 1m0 20c-5 0-9-4-9-9s4-9 9-9 9 4 9 9-4 9-9 9z"/></svg>, label:'相机' },
              { bg:'#FF4D4F', svg:<svg viewBox="0 0 24 24" style={{width:24,height:24,fill:'#fff'}}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>, label:'位置', action:()=>{ setShowMore(false); openLocationModal(); } },
              { bg:'#52C41A', svg:<svg viewBox="0 0 24 24" style={{width:24,height:24,fill:'#fff'}}><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>, label:'名片', action:()=>{ setShowMore(false); openContactCardModal(); } },
              { bg:'#FA541C', svg:<svg viewBox="0 0 24 24" style={{width:24,height:24,fill:'#fff'}}><path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>, label:'红包', action:()=>{ setShowMore(false); setShowRedPacketModal(true); } },
              { bg:'#1890FF', svg:<svg viewBox="0 0 24 24" style={{width:24,height:24,fill:'#fff'}}><path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.05 15.96 0 13.5 0c-1.3 0-2.47.6-3.28 1.53L9 3 7.78 1.53C6.97.6 5.8 0 4.5 0 2.04 0 0 2.05 0 4.64c0 .48.11.92.18 1.36H0v2h20v-2zM20 10H4v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8z"/></svg>, label:'文件', action:()=>fileInputRef.current?.click() },
              { bg:'#13C2C2', svg:<svg viewBox="0 0 24 24" style={{width:24,height:24,fill:'#fff'}}><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>, label:'视频通话', action:()=>{ setShowMore(false); startCall('video'); } },
              { bg:'#07C160', svg:<svg viewBox="0 0 24 24" style={{width:24,height:24,fill:'#fff'}}><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>, label:'语音通话', action:()=>{ setShowMore(false); startCall('audio'); } },
              { bg:'#722ED1', svg:<svg viewBox="0 0 24 24" style={{width:24,height:24,fill:'#fff'}}><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>, label:'音乐' },
            ].map(item => (
              <div key={item.label} className="wc-more-item" onClick={item.action}>
                <div className="wc-more-icon" style={{ background: item.bg }}>{item.svg}</div>
                <span className="wc-more-label">{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Text / Voice input */}
        {!showEmoji && !showMore && (
          <>
            {voiceMode ? (
              <div style={{ padding: '4px 14px 8px' }}>
                <button
                  className={`wc-voice-btn${recording ? ' recording' : ''}`}
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                >
                  {recording ? '● 松开发送' : '按住说话'}
                </button>
              </div>
            ) : (
              <div className="wc-input-box" style={{ position: 'relative' }}>
                {atList && (
                  <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--border-color)', borderRadius: 4, boxShadow: '0 2px 12px rgba(0,0,0,.1)', zIndex: 100, maxHeight: 180, overflowY: 'auto' }}>
                    {atList.filter(m => m.id !== user.id).map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 14, transition: 'background .08s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                        onClick={() => insertAtMention(m)}>
                        <Avatar src={m.avatar} name={m.username} size={22} />
                        <span>{m.username}</span>
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
                  placeholder=""
                  rows={3}
                />
              </div>
            )}
            {!voiceMode && (
              <div className="wc-input-footer">
                <span className="wc-input-hint">Enter 发送，Shift+Enter 换行</span>
                <button
                  className={`wc-send-btn${input.trim() ? ' active' : ''}`}
                  onClick={sendMessage}
                  disabled={!input.trim()}
                >发送</button>
              </div>
            )}
          </>
        )}
      </div>
      )} {/* end mute_all conditional */}

      {/* ── 名片选人弹窗 ── */}
      {showContactCardModal && (
        <div className="wc-modal-overlay" onClick={e => e.target === e.currentTarget && setShowContactCardModal(false)}>
          <div className="wc-modal" style={{ width: 360, maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 16 }}>发送名片</span>
              <button style={{ color: '#888', fontSize: 18, cursor: 'pointer' }} onClick={() => setShowContactCardModal(false)}>✕</button>
            </div>
            {/* 搜索框 */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #F5F5F5', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F5F5F5', borderRadius: 5, padding: '6px 10px' }}>
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: '#B2B2B2', flexShrink: 0 }}><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                <input
                  autoFocus
                  value={cardSearch}
                  onChange={e => setCardSearch(e.target.value)}
                  placeholder="搜索联系人..."
                  style={{ flex: 1, fontSize: 13, background: 'transparent', color: '#333' }}
                />
                {cardSearch && <button style={{ color: '#B2B2B2', fontSize: 13 }} onClick={() => setCardSearch('')}>✕</button>}
              </div>
            </div>
            {/* 联系人列表 */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {cardLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#B2B2B2', fontSize: 13 }}>加载中...</div>
              ) : (() => {
                const filtered = cardContacts.filter(c => {
                  const q = cardSearch.toLowerCase();
                  return !q || (c.remark || c.username).toLowerCase().includes(q) || c.username.toLowerCase().includes(q);
                });
                if (filtered.length === 0) return (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#B2B2B2', fontSize: 13 }}>
                    {cardSearch ? '没有找到匹配的联系人' : '暂无联系人'}
                  </div>
                );
                return filtered.map(c => (
                  <div
                    key={c.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #F5F5F5', transition: 'background .08s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                    onClick={() => sendContactCard(c)}
                  >
                    <Avatar src={c.avatar} name={c.remark || c.username} size={40} style={{ borderRadius: 8, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: '#191919', fontWeight: 500 }}>{c.remark || c.username}</div>
                      {c.remark && <div style={{ fontSize: 12, color: '#B2B2B2' }}>{c.username}</div>}
                    </div>
                    <span style={{ fontSize: 12, color: '#07C160', flexShrink: 0 }}>发送</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── 位置选择弹窗 ── */}
      {showLocationModal && (
        <div className="wc-modal-overlay" onClick={e => e.target === e.currentTarget && setShowLocationModal(false)}>
          <div className="wc-modal" style={{ width: 340 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 16 }}>发送位置</span>
              <button style={{ color: '#888', fontSize: 18, cursor: 'pointer' }} onClick={() => setShowLocationModal(false)}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              {locating ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#B2B2B2', fontSize: 13 }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📍</div>
                  正在获取位置...
                </div>
              ) : locationInfo ? (
                <div>
                  <div style={{ background: '#F5F5F5', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 24, flexShrink: 0 }}>📍</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>我的位置</div>
                        <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{locationInfo.address}</div>
                        {locationInfo.lat !== 0 && (
                          <div style={{ fontSize: 11, color: '#B2B2B2', marginTop: 4 }}>{locationInfo.lat}, {locationInfo.lng}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={{ flex: 1, padding: '10px', background: '#F5F5F5', borderRadius: 6, fontSize: 14, color: '#555' }} onClick={() => { setLocationInfo(null); openLocationModal(); }}>重新定位</button>
                    <button style={{ flex: 1, padding: '10px', background: '#07C160', color: '#fff', borderRadius: 6, fontSize: 14, fontWeight: 500 }} onClick={sendLocation} disabled={locationInfo.lat === 0 && locationInfo.address === '获取位置失败'}>发送</button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <button style={{ padding: '12px 28px', background: '#07C160', color: '#fff', borderRadius: 6, fontSize: 14 }} onClick={openLocationModal}>获取当前位置</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 发红包弹窗 ── */}
      {showRedPacketModal && (
        <div className="wc-modal-overlay" onClick={e => e.target === e.currentTarget && setShowRedPacketModal(false)}>
          <div className="wc-modal" style={{ width: 340 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 16 }}>🧧 发红包</span>
              <button style={{ color: '#888', fontSize: 18, cursor: 'pointer' }} onClick={() => setShowRedPacketModal(false)}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              {conversation.type === 'group' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 6 }}>红包个数</label>
                  <input type="number" min={1} max={100} value={redPacketForm.count}
                    onChange={e => setRedPacketForm(f => ({ ...f, count: Math.max(1, Math.min(100, +e.target.value)) }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 14 }} />
                </div>
              )}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 6 }}>金额（金币）</label>
                <input type="number" min={1} max={20000} value={redPacketForm.amount}
                  onChange={e => setRedPacketForm(f => ({ ...f, amount: Math.max(1, Math.min(20000, +e.target.value)) }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 14 }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 6 }}>祝福语</label>
                <input value={redPacketForm.greeting} maxLength={30}
                  onChange={e => setRedPacketForm(f => ({ ...f, greeting: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #E5E5E5', borderRadius: 6, fontSize: 14 }} />
              </div>
              <button style={{ width: '100%', padding: '12px', background: '#FA5A00', color: '#fff', borderRadius: 6, fontSize: 15, fontWeight: 600 }} onClick={sendRedPacket}>
                塞入红包
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 红包详情弹窗 ── */}
      {showRedPacketDetail && (
        <div className="wc-modal-overlay" onClick={e => e.target === e.currentTarget && setShowRedPacketDetail(null)}>
          <div className="wc-modal" style={{ width: 360 }}>
            <div style={{ background: 'linear-gradient(135deg, #C0392B, #E74C3C)', padding: '20px 20px 16px', borderRadius: '8px 8px 0 0', position: 'relative' }}>
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>🧧 红包</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{redPacketDetailData?.greeting}</div>
              <button style={{ position: 'absolute', top: 12, right: 14, color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer' }} onClick={() => setShowRedPacketDetail(null)}>✕</button>
            </div>
            <div style={{ padding: 16 }}>
              {redPacketDetailData ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13, color: '#888' }}>
                    <span>共 {redPacketDetailData.total_count} 个 · {redPacketDetailData.total_amount} 金币</span>
                    <span>已领 {redPacketDetailData.claimed_count}/{redPacketDetailData.total_count}</span>
                  </div>
                  {!redPacketDetailData.myClaim && redPacketDetailData.claimed_count < redPacketDetailData.total_count && (
                    <button style={{ width: '100%', padding: '12px', background: '#FA5A00', color: '#fff', borderRadius: 6, fontSize: 15, fontWeight: 600, marginBottom: 14 }} onClick={() => claimRedPacket(showRedPacketDetail)} disabled={claiming}>
                      {claiming ? '领取中...' : '🧧 点击领取'}
                    </button>
                  )}
                  {redPacketDetailData.myClaim && (
                    <div style={{ background: '#FFF3E0', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#E65100', textAlign: 'center' }}>
                      已领取 {redPacketDetailData.myClaim.amount} 金币
                    </div>
                  )}
                  {redPacketDetailData.claims.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, color: '#B2B2B2', marginBottom: 8 }}>领取记录</div>
                      {redPacketDetailData.claims.map(c => (
                        <div key={c.user_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F5F5F5', fontSize: 13 }}>
                          <span style={{ color: '#333' }}>{c.username}</span>
                          <span style={{ color: '#FA5A00', fontWeight: 600 }}>{c.amount} 金币</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {redPacketDetailData.claimed_count >= redPacketDetailData.total_count && !redPacketDetailData.myClaim && (
                    <div style={{ textAlign: 'center', padding: '10px 0', color: '#B2B2B2', fontSize: 13 }}>红包已被领完</div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#B2B2B2', fontSize: 13 }}>加载中...</div>
              )}
            </div>
          </div>
        </div>
      )}

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
            <div className="wc-ctx-item" onClick={() => ctxAction('reply')}>回复</div>
            {/* 编辑：仅限自己的文字消息，2分钟内 */}
            {ctxMenu.msg.sender_id === user.id &&
             ctxMenu.msg.type === 'text' &&
             !ctxMenu.msg.deleted &&
             (Math.floor(Date.now()/1000) - ctxMenu.msg.created_at) <= 120 && (
              <div className="wc-ctx-item" onClick={() => ctxAction('edit')}>编辑</div>
            )}
            {ctxMenu.msg.type === 'text' && (
              <div className="wc-ctx-item" onClick={() => ctxAction('copy')}>复制</div>
            )}
            {/* 转发：所有类型消息都可转发 */}
            <div className="wc-ctx-item" onClick={() => ctxAction('forward')}>转发</div>
            <div className="wc-ctx-item" onClick={() => ctxAction('collect')}>收藏</div>
            <div className="wc-ctx-divider" />
            {/* 撤回：自己的消息2分钟内，或群主/管理员删除任意消息 */}
            {(ctxMenu.msg.sender_id === user.id ||
              ((myGroupRole === 'owner' || myGroupRole === 'admin') && conversation.type === 'group')
            ) && (
              <div className="wc-ctx-item danger" onClick={() => ctxAction('delete')}>
                {ctxMenu.msg.sender_id === user.id ? '撤回' : '删除'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PrivateChatSettings({ conversation, onClose, onConvUpdate }) {
  const [muted, setMuted] = useState(!!conversation.muted);
  const [pinned, setPinned] = useState(!!conversation.pinned);
  const [saving, setSaving] = useState(false);

  const toggleMute = async (val) => {
    setSaving(true);
    try {
      await axios.post(`/api/messages/conversation/${conversation.id}/mute`, { muted: val ? 1 : 0 });
      setMuted(val);
      onConvUpdate?.({ muted: val ? 1 : 0 });
    } catch { alert('操作失败'); }
    setSaving(false);
  };

  const togglePin = async (val) => {
    setSaving(true);
    try {
      await axios.post(`/api/messages/conversation/${conversation.id}/pin`, { pinned: val ? 1 : 0 });
      setPinned(val);
      onConvUpdate?.({ pinned: val ? 1 : 0 });
    } catch { alert('操作失败'); }
    setSaving(false);
  };

  const S = {
    panel: { width: 240, borderLeft: '1px solid #E0E0E0', background: '#F5F5F5', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 },
    header: { padding: '0 14px', height: 52, background: '#EDEDED', borderBottom: '1px solid #E0E0E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    section: { background: '#fff', marginBottom: 8 },
    row: { display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid #F5F5F5', gap: 10 },
    rowLabel: { flex: 1, fontSize: 14, color: '#191919' },
  };

  return (
    <div style={S.panel}>
      <div style={S.header}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>聊天设置</span>
        <button style={{ color: '#888', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 2 }} onClick={onClose}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ ...S.section, marginTop: 8 }}>
          <div style={{ ...S.row, borderBottom: '1px solid #F5F5F5' }}>
            <span style={S.rowLabel}>消息免打扰</span>
            <div onClick={() => !saving && toggleMute(!muted)} style={{ width: 44, height: 26, borderRadius: 13, background: muted ? '#07C160' : '#D8D8D8', position: 'relative', cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.2s', opacity: saving ? 0.5 : 1, flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 3, left: muted ? 21 : 3, width: 20, height: 20, borderRadius: 10, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.18s' }} />
            </div>
          </div>
          <div style={S.row}>
            <span style={S.rowLabel}>置顶聊天</span>
            <div onClick={() => !saving && togglePin(!pinned)} style={{ width: 44, height: 26, borderRadius: 13, background: pinned ? '#07C160' : '#D8D8D8', position: 'relative', cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.2s', opacity: saving ? 0.5 : 1, flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 3, left: pinned ? 21 : 3, width: 20, height: 20, borderRadius: 10, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.18s' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
