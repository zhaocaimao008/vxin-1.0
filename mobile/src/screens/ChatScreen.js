import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  Image, KeyboardAvoidingView, Platform, ActivityIndicator,
  ActionSheetIOS, Alert, Clipboard, Pressable, Modal, ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import CallScreen from './CallScreen';
import { getServerUrl } from '../config';

const { width: SW } = Dimensions.get('window');

const C = {
  nav: '#1A2033',
  green: '#07C160',
  greenLight: '#E8F8EE',
  bg: '#EDEDED',
  bgCard: '#FFFFFF',
  bgInput: '#ECEEF2',
  text: '#1F2D3D',
  textSub: '#7A8694',
  textTip: '#B0BAC5',
  border: '#E8ECF0',
  red: '#FA5151',
  radius: 8,
  radiusLg: 12,
};

const QUICK_EMOJIS = ['👍','❤️','😂','😮','😢','🙏','🔥','👏'];
const FULL_EMOJIS  = ['😀','😂','🤣','😊','😍','🥰','😎','🤩','😏','😒','😢','😭','😤','😡','🤔','🤗','😴','🥳','🎉','❤️','💕','💔','🔥','⭐','💯','✅','🎁','🎂','👍','👎','👏','🤝','🙏','💪','🤞'];

function Avatar({ src, name, size = 38, radius }) {
  const colors = ['#1ABC9C', '#3498DB', '#9B59B6', '#E67E22', '#E74C3C', '#07C160'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash));
  const bg = colors[Math.abs(hash) % colors.length];
  const r = radius ?? size * 0.22;
  if (src) return <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: r }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '600' }}>{(name || '?')[0].toUpperCase()}</Text>
    </View>
  );
}

function fmtSize(b) {
  if (!b) return '';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen({ route, navigation }) {
  const { conversation } = route.params;
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [replyTo, setReplyTo]         = useState(null);
  const [editingId, setEditingId]     = useState(null);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [sending, setSending]         = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [pinnedMsg, setPinnedMsg]     = useState(null);
  const [activeCall, setActiveCall]   = useState(null);
  const [showEmoji, setShowEmoji]     = useState(false);
  const [lightbox, setLightbox]       = useState(null); // uri string
  const [reactionTarget, setReactionTarget] = useState(null); // msgId
  const [members, setMembers]         = useState([]);
  const [mentionSearch, setMentionSearch] = useState(null); // null = not showing
  const [mentionResults, setMentionResults] = useState([]);
  const flatListRef = useRef(null);
  const inputRef    = useRef(null);
  const pendingAcks = useRef({});
  const typingTimer = useRef(null);
  const isTypingRef = useRef(false);
  const { user } = useAuth();
  const { socket } = useSocket();
  const insets = useSafeAreaInsets();

  // Header
  useLayoutEffect(() => {
    const sub = conversation.type === 'group' && conversation.memberCount ? ` (${conversation.memberCount})` : '';
    navigation.setOptions({
      title: (conversation.name || '聊天') + sub,
      headerStyle: { backgroundColor: C.bgCard },
      headerTitleStyle: { fontSize: 17, fontWeight: '600', color: C.text },
    });
  }, [navigation, conversation]);

  // Load messages + members
  useEffect(() => {
    setLoadingMsgs(true);
    const baseUrl = getServerUrl();
    const token = axios.defaults.headers.common.Authorization;
    axios.get(`/api/messages/conversation/${conversation.id}?limit=60`)
      .then(r => {
        const data = r.data?.messages || r.data?.data || r.data || [];
        setMessages(Array.isArray(data) ? data : []);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
    axios.post(`/api/messages/conversation/${conversation.id}/read`).catch(() => {});

    if (conversation.type === 'group') {
      axios.get(`/api/groups/${conversation.groupId || conversation.id}/members`)
        .then(r => setMembers(r.data?.members || r.data || []))
        .catch(() => {});
    }

    // Load pinned message
    axios.get(`/api/conversations/${conversation.id}/pin`)
      .then(r => setPinnedMsg(r.data?.message || null))
      .catch(() => {});
  }, [conversation.id]);

  // Socket events
  useEffect(() => {
    if (!socket) return;
    socket.emit('join_conversation', { conversationId: conversation.id });

    const onNewMsg = (msg) => {
      const cid = msg.conversationId || msg.conversation_id;
      if (cid !== conversation.id) return;
      setMessages(prev => {
        if (msg.tempId && pendingAcks.current[msg.tempId]) {
          delete pendingAcks.current[msg.tempId];
          return prev.map(m => m._tempId === msg.tempId ? { ...msg, _status: 'sent' } : m);
        }
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    const onRecalled = ({ messageId, conversationId }) => {
      if (conversationId !== conversation.id) return;
      setMessages(prev => prev.map(m =>
        String(m.id) === String(messageId) ? { ...m, recalled: true, content: '[消息已撤回]' } : m
      ));
    };

    const onEdited = (msg) => {
      if ((msg.conversationId || msg.conversation_id) !== conversation.id) return;
      setMessages(prev => prev.map(m => String(m.id) === String(msg.id) ? { ...m, ...msg } : m));
    };

    const onReaction = (data) => {
      if (data.conversationId !== conversation.id) return;
      setMessages(prev => prev.map(m => {
        if (String(m.id) !== String(data.messageId)) return m;
        const reactions = (m.reactions || []).filter(r => !(r.userId === data.userId && r.emoji === data.emoji));
        if (data.action !== 'remove') reactions.push({ userId: data.userId, emoji: data.emoji });
        return { ...m, reactions };
      }));
    };

    const onTyping = ({ userId, conversationId, isTyping: on, username }) => {
      if (conversationId !== conversation.id || userId === user?.id) return;
      setTypingUsers(prev => on
        ? (prev.find(u => u.id === userId) ? prev : [...prev, { id: userId, username }])
        : prev.filter(u => u.id !== userId)
      );
    };

    const onPinned = ({ conversationId, message }) => {
      if (conversationId === conversation.id) setPinnedMsg(message);
    };

    const onRead = (data) => {
      if (data.conversationId !== conversation.id) return;
      setMessages(prev => prev.map(m =>
        String(m.id) === String(data.messageId)
          ? { ...m, readBy: [...(m.readBy || []), data.userId] }
          : m
      ));
    };

    const onIncomingCall = ({ from, type, caller }) => {
      if (from !== conversation.id && from !== conversation.otherUser?.id) return;
      setActiveCall({ type, direction: 'incoming',
        remoteUser: { id: from, name: caller?.name || caller?.username, avatar: caller?.avatar },
        remoteId: from });
    };

    socket.on('new_message', onNewMsg);
    socket.on('message_recalled', onRecalled);
    socket.on('message_edited', onEdited);
    socket.on('message_reaction', onReaction);
    socket.on('typing', onTyping);
    socket.on('pinned_message', onPinned);
    socket.on('message_read', onRead);
    socket.on('call:incoming', onIncomingCall);

    return () => {
      socket.off('new_message', onNewMsg);
      socket.off('message_recalled', onRecalled);
      socket.off('message_edited', onEdited);
      socket.off('message_reaction', onReaction);
      socket.off('typing', onTyping);
      socket.off('pinned_message', onPinned);
      socket.off('message_read', onRead);
      socket.off('call:incoming', onIncomingCall);
    };
  }, [socket, conversation.id, user?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  // ── Send text ──────────────────────────────────────────────────────────────

  const sendText = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    stopTyping();

    if (editingId) {
      setEditingId(null);
      axios.put(`/api/messages/${editingId}`, { content: text }).catch(e => Alert.alert('编辑失败', e.message));
      setMessages(prev => prev.map(m => String(m.id) === String(editingId) ? { ...m, content: text } : m));
      return;
    }

    const replyRef = replyTo;
    setReplyTo(null);
    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      _tempId: tempId, id: tempId,
      conversationId: conversation.id,
      senderId: user.id,
      senderNickname: user.nickname || user.username,
      senderAvatar: user.avatar,
      content: text, type: 'text',
      replyTo: replyRef || null,
      createdAt: new Date().toISOString(),
      _status: 'sending',
    };
    setMessages(prev => [...prev, optimistic]);
    pendingAcks.current[tempId] = true;

    socket?.emit('send_message', {
      conversationId: conversation.id,
      content: text, type: 'text',
      replyToMessageId: replyRef?.id || null,
      tempId,
    }, (ack) => {
      delete pendingAcks.current[tempId];
      setMessages(prev => prev.map(m =>
        m._tempId === tempId
          ? (ack?.success && ack?.message ? { ...ack.message, _status: 'sent' } : { ...m, _status: 'failed' })
          : m
      ));
    });
  }, [input, socket, replyTo, editingId, conversation.id, user]);

  // ── Upload helper ──────────────────────────────────────────────────────────

  const uploadAndSend = async (fileObj, msgType) => {
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('file', fileObj);
      const { data: presign } = await axios.post('/api/upload/presign', {
        filename: fileObj.name, contentType: fileObj.type, ext: fileObj.name?.split('.').pop()
      });
      // Upload to R2
      await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': fileObj.type }, body: fileObj });
      const fileUrl = presign.fileUrl;
      socket?.emit('send_message', {
        conversationId: conversation.id,
        type: msgType,
        content: fileUrl,
        fileUrl,
        fileName: fileObj.name,
        fileSize: fileObj.size,
      });
    } catch {
      // Fallback: multipart form upload
      try {
        const fd = new FormData();
        fd.append('file', fileObj);
        const { data } = await axios.post('/api/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        const fileUrl = data.url || data.fileUrl;
        socket?.emit('send_message', {
          conversationId: conversation.id,
          type: msgType, content: fileUrl, fileUrl,
          fileName: fileObj.name, fileSize: fileObj.size,
        });
      } catch (err2) { Alert.alert('上传失败', err2.message || '请重试'); }
    } finally { setSending(false); }
  };

  const sendImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('需要权限', '请允许访问相册');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets[0];
    await uploadAndSend({ uri: asset.uri, type: asset.mimeType || 'image/jpeg', name: asset.fileName || 'photo.jpg', size: asset.fileSize }, 'image');
  };

  const sendCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('需要权限', '请允许访问相机');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets[0];
    await uploadAndSend({ uri: asset.uri, type: asset.mimeType || 'image/jpeg', name: 'camera.jpg', size: asset.fileSize }, 'image');
  };

  const sendFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      await uploadAndSend({ uri: asset.uri, type: asset.mimeType || 'application/octet-stream', name: asset.name, size: asset.size }, 'file');
    } catch (err) { Alert.alert('选择文件失败', err.message); }
  };

  // ── Typing ─────────────────────────────────────────────────────────────────

  const handleInputChange = (text) => {
    setInput(text);
    handleTypingStart();
    // @mention detection
    const cursor = text.length;
    const atIdx = text.lastIndexOf('@');
    if (atIdx >= 0 && conversation.type === 'group') {
      const q = text.slice(atIdx + 1).toLowerCase();
      const results = members.filter(m => (m.nickname || m.username || '').toLowerCase().startsWith(q)).slice(0, 6);
      setMentionSearch(q);
      setMentionResults(results);
    } else {
      setMentionSearch(null);
    }
  };

  const handleTypingStart = () => {
    if (!socket) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing', { conversationId: conversation.id, isTyping: true });
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, 3000);
  };

  const stopTyping = () => {
    if (isTypingRef.current && socket) {
      isTypingRef.current = false;
      socket.emit('typing', { conversationId: conversation.id, isTyping: false });
    }
    clearTimeout(typingTimer.current);
  };

  // ── Long-press menu ────────────────────────────────────────────────────────

  const onLongPress = (msg) => {
    const isMe = msg.senderId === user?.id || msg.sender_id === user?.id;
    const ageMs = Date.now() - new Date(msg.createdAt || msg.created_at * 1000).getTime();
    const canRecall = isMe && ageMs < 120000 && !msg.recalled;
    const canEdit   = isMe && msg.type === 'text' && ageMs < 120000 && !msg.recalled;

    const options = [
      ...(msg.type === 'text' ? ['复制'] : []),
      '回复',
      '表情回应',
      '转发',
      '置顶',
      ...(canEdit   ? ['编辑'] : []),
      ...(canRecall ? ['撤回'] : []),
      '取消',
    ];
    const cancel = options.length - 1;
    const destructive = canRecall ? options.indexOf('撤回') : -1;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: destructive >= 0 ? destructive : undefined, cancelButtonIndex: cancel },
        (idx) => handleMenuAction(options[idx], msg)
      );
    } else {
      Alert.alert('消息操作', '', [
        ...options.filter(o => o !== '取消').map(label => ({
          text: label,
          style: label === '撤回' ? 'destructive' : 'default',
          onPress: () => handleMenuAction(label, msg),
        })),
        { text: '取消', style: 'cancel' },
      ]);
    }
  };

  const handleMenuAction = (action, msg) => {
    switch (action) {
      case '复制':
        Clipboard.setString(msg.content || '');
        break;
      case '回复':
        setReplyTo({ id: msg.id, senderNickname: msg.senderNickname || msg.senderName, content: msg.content, type: msg.type });
        inputRef.current?.focus();
        break;
      case '表情回应':
        setReactionTarget(msg.id);
        break;
      case '转发':
        Alert.alert('转发', '暂不支持转发到其他对话，消息内容已复制', [
          { text: '复制内容', onPress: () => Clipboard.setString(msg.content || '') },
          { text: '取消', style: 'cancel' },
        ]);
        break;
      case '置顶':
        axios.post(`/api/conversations/${conversation.id}/pin`, { messageId: msg.id })
          .then(() => setPinnedMsg(msg))
          .catch(e => Alert.alert('置顶失败', e.response?.data?.message || e.message));
        break;
      case '编辑':
        setEditingId(msg.id);
        setInput(msg.content || '');
        inputRef.current?.focus();
        break;
      case '撤回':
        Alert.alert('撤回消息', '确认撤回？', [
          { text: '取消', style: 'cancel' },
          { text: '撤回', style: 'destructive', onPress: () => {
            axios.delete(`/api/messages/${msg.id}`)
              .then(() => setMessages(prev => prev.map(m =>
                String(m.id) === String(msg.id) ? { ...m, recalled: true, content: '[消息已撤回]' } : m
              )))
              .catch(e => Alert.alert('撤回失败', e.response?.data?.message || e.message));
          }},
        ]);
        break;
    }
  };

  const sendReaction = (emoji) => {
    if (!reactionTarget) return;
    setReactionTarget(null);
    axios.post(`/api/messages/${reactionTarget}/reactions`, { emoji }).catch(() => {});
  };

  const sendSticker = (url) => {
    socket?.emit('send_message', { conversationId: conversation.id, type: 'sticker', content: url, fileUrl: url });
  };

  const startCall = (type) => {
    const targetId = conversation.type === 'group' ? conversation.id : (conversation.otherUser?.id || conversation.partnerId || conversation.id);
    if (!targetId) return;
    socket?.emit('call:request', { to: targetId, type, caller: { id: user.id, name: user.nickname || user.username, avatar: user.avatar } });
    setActiveCall({ type, direction: 'outgoing',
      remoteUser: conversation.type === 'group'
        ? { id: targetId, name: conversation.name }
        : { id: targetId, name: conversation.otherUser?.nickname || conversation.otherUser?.username || conversation.name, avatar: conversation.otherUser?.avatar },
      remoteId: targetId });
  };

  // ── Render message ─────────────────────────────────────────────────────────

  const renderItem = useCallback(({ item: msg }) => {
    const isMe = String(msg.senderId || msg.sender_id) === String(user?.id);

    if (msg.type === 'system') {
      return <View style={S.systemWrap}><Text style={S.systemText}>{msg.content}</Text></View>;
    }

    const bubbleContent = () => {
      if (msg.recalled) {
        return <Text style={S.recalledText}>{isMe ? '你撤回了一条消息' : '对方撤回了一条消息'}</Text>;
      }
      switch (msg.type) {
        case 'image':
          return (
            <TouchableOpacity onPress={() => setLightbox(msg.fileUrl || msg.file_url || msg.content)}>
              <Image source={{ uri: msg.fileUrl || msg.file_url || msg.content }} style={S.msgImage} resizeMode="cover" />
            </TouchableOpacity>
          );
        case 'file':
          return (
            <View style={S.fileRow}>
              <View style={S.fileIcon}><Text style={S.fileIconText}>📄</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[S.fileName, isMe && { color: '#fff' }]} numberOfLines={2}>{msg.fileName || msg.content}</Text>
                <Text style={[S.fileSize, isMe && { color: 'rgba(255,255,255,.7)' }]}>{fmtSize(msg.fileSize)}</Text>
              </View>
            </View>
          );
        case 'voice':
          return (
            <View style={S.voiceRow}>
              <Text style={{ fontSize: 16 }}>🎙</Text>
              <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
                {[8, 14, 10, 14, 8].map((h, i) => (
                  <View key={i} style={{ width: 3, height: h, backgroundColor: isMe ? 'rgba(255,255,255,.8)' : C.green, borderRadius: 2 }} />
                ))}
              </View>
              <Text style={[S.voiceDur, isMe && { color: 'rgba(255,255,255,.9)' }]}>{msg.duration || 0}"</Text>
            </View>
          );
        case 'sticker':
          return <Image source={{ uri: msg.fileUrl || msg.content }} style={S.stickerImg} resizeMode="contain" />;
        case 'contact': {
          let card = {};
          try { card = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content; } catch (_) {}
          return (
            <View style={S.contactCard}>
              <Avatar src={card.avatar} name={card.nickname || card.username || '?'} size={40} radius={20} />
              <View>
                <Text style={[S.contactName, isMe && { color: '#fff' }]}>{card.nickname || card.username}</Text>
                <Text style={[S.contactHint, isMe && { color: 'rgba(255,255,255,.7)' }]}>个人名片</Text>
              </View>
            </View>
          );
        }
        default:
          return <Text style={[S.msgText, isMe && S.msgTextMe]}>{msg.content}</Text>;
      }
    };

    // Reactions display
    const grouped = {};
    (msg.reactions || []).forEach(r => {
      if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
      grouped[r.emoji].count++;
      if (String(r.userId) === String(user?.id)) grouped[r.emoji].mine = true;
    });

    return (
      <Pressable onLongPress={() => !msg.recalled && onLongPress(msg)} delayLongPress={350}>
        <View style={[S.msgRow, isMe ? S.msgRowMe : S.msgRowOther]}>
          {!isMe && <View style={S.avatarCol}><Avatar src={msg.senderAvatar || msg.sender_avatar} name={msg.senderNickname || msg.senderName || '?'} size={36} /></View>}
          <View style={[S.bubbleCol, isMe ? S.bubbleColMe : S.bubbleColOther]}>
            {!isMe && conversation.type === 'group' && (
              <Text style={S.senderName}>{msg.senderNickname || msg.senderName}</Text>
            )}
            {msg.replyTo && (
              <View style={[S.quoteBox, isMe ? S.quoteBoxMe : S.quoteBoxOther]}>
                <Text style={S.quoteName} numberOfLines={1}>{msg.replyTo.senderNickname || msg.replyTo.senderName}</Text>
                <Text style={S.quoteText} numberOfLines={1}>
                  {msg.replyTo.type === 'image' ? '[图片]' : msg.replyTo.type === 'voice' ? '[语音]' : (msg.replyTo.content || '')}
                </Text>
              </View>
            )}
            <View style={[S.bubble, msg.recalled ? S.bubbleRecalled : (isMe ? S.bubbleMe : S.bubbleOther)]}>
              {bubbleContent()}
            </View>
            {Object.keys(grouped).length > 0 && (
              <View style={S.reactionsRow}>
                {Object.entries(grouped).map(([emoji, { count, mine }]) => (
                  <TouchableOpacity key={emoji} style={[S.reactionPill, mine && S.reactionPillMine]}
                    onPress={() => sendReaction(emoji)}>
                    <Text style={{ fontSize: 13 }}>{emoji}</Text>
                    {count > 1 && <Text style={S.reactionCount}>{count}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={[S.timeRow, isMe && { justifyContent: 'flex-end' }]}>
              <Text style={S.timeText}>{fmtTime(msg.createdAt || msg.created_at)}</Text>
              {isMe && msg.readBy?.length > 0 && <Text style={S.readLabel}> 已读</Text>}
              {isMe && msg._status === 'sending' && <ActivityIndicator size={9} color={C.textTip} style={{ marginLeft: 4 }} />}
              {isMe && msg._status === 'failed' && <Text style={S.failedLabel}> !</Text>}
            </View>
          </View>
          {isMe && <View style={S.avatarCol}><Avatar src={user?.avatar} name={user?.nickname || user?.username || '?'} size={36} /></View>}
        </View>
      </Pressable>
    );
  }, [user, conversation.type, members]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={S.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Call bar */}
      {conversation.type !== 'group' && (
        <View style={S.callBar}>
          <TouchableOpacity style={S.callBtn} activeOpacity={0.7} onPress={() => startCall('audio')}>
            <Text style={S.callBtnText}>📞 语音</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.callBtn} activeOpacity={0.7} onPress={() => startCall('video')}>
            <Text style={S.callBtnText}>🎥 视频</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pinned message */}
      {pinnedMsg && (
        <TouchableOpacity style={S.pinnedBar} activeOpacity={0.8} onPress={() => {}}>
          <Text style={S.pinnedIcon}>📌</Text>
          <Text style={S.pinnedText} numberOfLines={1}>{pinnedMsg.content || '[图片]'}</Text>
          <TouchableOpacity onPress={() => {
            axios.delete(`/api/conversations/${conversation.id}/pin`).catch(() => {});
            setPinnedMsg(null);
          }}>
            <Text style={S.pinnedClose}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Messages */}
      {loadingMsgs ? (
        <View style={S.loadingWrap}><ActivityIndicator color={C.green} size="large" /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => String(m.id || m._tempId || Math.random())}
          renderItem={renderItem}
          contentContainerStyle={S.listContent}
          ListEmptyComponent={<View style={S.emptyWrap}><Text style={S.emptyText}>开始聊天吧</Text></View>}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListFooterComponent={typingUsers.length > 0 ? (
            <View style={S.typingRow}>
              <Text style={S.typingText}>{typingUsers.map(u => u.username).join(', ')} 正在输入…</Text>
            </View>
          ) : null}
        />
      )}

      {/* @mention list */}
      {mentionSearch !== null && mentionResults.length > 0 && (
        <View style={S.mentionList}>
          {mentionResults.map(m => (
            <TouchableOpacity key={m.id} style={S.mentionItem} onPress={() => {
              const atIdx = input.lastIndexOf('@');
              setInput(input.slice(0, atIdx) + '@' + (m.nickname || m.username) + ' ');
              setMentionSearch(null);
              inputRef.current?.focus();
            }}>
              <Avatar src={m.avatar} name={m.nickname || m.username || '?'} size={28} radius={14} />
              <Text style={S.mentionName}>{m.nickname || m.username}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Emoji panel */}
      {showEmoji && (
        <View style={S.emojiPanel}>
          <ScrollView contentContainerStyle={S.emojiGrid}>
            {FULL_EMOJIS.map(e => (
              <TouchableOpacity key={e} style={S.emojiBtn} onPress={() => setInput(i => i + e)}>
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Reply bar */}
      {replyTo && (
        <View style={S.replyBar}>
          <View style={S.replyAccent} />
          <View style={{ flex: 1 }}>
            <Text style={S.replyName} numberOfLines={1}>回复 {replyTo.senderNickname || replyTo.senderName}</Text>
            <Text style={S.replyContent} numberOfLines={1}>{replyTo.type === 'image' ? '[图片]' : replyTo.content}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}><Text style={S.replyClose}>✕</Text></TouchableOpacity>
        </View>
      )}

      {/* Edit mode banner */}
      {editingId && (
        <View style={[S.replyBar, { backgroundColor: '#FFF8E1' }]}>
          <View style={[S.replyAccent, { backgroundColor: '#F6A609' }]} />
          <Text style={{ flex: 1, fontSize: 13, color: C.textSub }}>编辑消息</Text>
          <TouchableOpacity onPress={() => { setEditingId(null); setInput(''); }}><Text style={S.replyClose}>✕</Text></TouchableOpacity>
        </View>
      )}

      {/* Input bar */}
      <View style={[S.inputBar, { paddingBottom: insets.bottom + 6 }]}>
        <TouchableOpacity style={S.toolBtn} onPress={() => setShowEmoji(v => !v)}>
          <Text style={{ fontSize: 20 }}>🙂</Text>
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={S.textInput}
          value={input}
          onChangeText={handleInputChange}
          placeholder={editingId ? '编辑消息…' : '输入消息…'}
          placeholderTextColor={C.textTip}
          multiline
          maxLength={4000}
          returnKeyType="default"
        />
        <TouchableOpacity style={S.toolBtn} onPress={sendImage} disabled={sending}>
          <Text style={{ fontSize: 20 }}>🖼</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.toolBtn} onPress={() => {
          Alert.alert('发送', '', [
            { text: '拍照', onPress: sendCamera },
            { text: '文件', onPress: sendFile },
            { text: '取消', style: 'cancel' },
          ]);
        }} disabled={sending}>
          <Text style={{ fontSize: 20 }}>➕</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[S.sendBtn, (!input.trim() || !socket) && S.sendBtnOff]}
          onPress={sendText}
          disabled={!input.trim() || !socket}
        >
          <Text style={S.sendBtnText}>发送</Text>
        </TouchableOpacity>
      </View>

      {/* Reaction picker modal */}
      <Modal visible={!!reactionTarget} transparent animationType="fade" onRequestClose={() => setReactionTarget(null)}>
        <TouchableOpacity style={S.modalOverlay} activeOpacity={1} onPress={() => setReactionTarget(null)}>
          <View style={S.reactionModal}>
            {QUICK_EMOJIS.map(e => (
              <TouchableOpacity key={e} style={S.reactionBtn} onPress={() => sendReaction(e)}>
                <Text style={{ fontSize: 28 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Image lightbox */}
      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <TouchableOpacity style={S.lightboxOverlay} activeOpacity={1} onPress={() => setLightbox(null)}>
          {lightbox && <Image source={{ uri: lightbox }} style={S.lightboxImg} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>

      {/* Call overlay */}
      {activeCall && socket && (
        <CallScreen socket={socket} user={user} call={activeCall} onClose={() => setActiveCall(null)} />
      )}
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  loadingWrap:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent:{ paddingHorizontal: 12, paddingVertical: 12, gap: 2 },
  emptyWrap:  { alignItems: 'center', paddingTop: 60 },
  emptyText:  { fontSize: 14, color: C.textTip },
  // Call bar
  callBar:    { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.bgCard, borderBottomWidth: 0.5, borderBottomColor: C.border, gap: 10 },
  callBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  callBtnText:{ fontSize: 13, color: C.textSub, fontWeight: '500' },
  // Pinned
  pinnedBar:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FFF8E1', borderBottomWidth: 0.5, borderBottomColor: '#FFE082' },
  pinnedIcon: { fontSize: 14 },
  pinnedText: { flex: 1, fontSize: 13, color: C.textSub },
  pinnedClose:{ fontSize: 14, color: C.textTip, padding: 4 },
  // System
  systemWrap: { alignItems: 'center', marginVertical: 8 },
  systemText: { fontSize: 12, color: C.textTip, backgroundColor: 'rgba(0,0,0,.05)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  // Message row
  msgRow:     { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 4, gap: 8 },
  msgRowMe:   { justifyContent: 'flex-end' },
  msgRowOther:{ justifyContent: 'flex-start' },
  avatarCol:  {},
  bubbleCol:  { maxWidth: SW * 0.72 },
  bubbleColMe:{ alignItems: 'flex-end' },
  bubbleColOther: { alignItems: 'flex-start' },
  senderName: { fontSize: 11, color: C.textSub, marginBottom: 3, marginLeft: 2 },
  // Quote
  quoteBox:   { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 3, borderLeftWidth: 2.5 },
  quoteBoxMe: { backgroundColor: 'rgba(7,193,96,.12)', borderLeftColor: C.green },
  quoteBoxOther: { backgroundColor: 'rgba(0,0,0,.05)', borderLeftColor: C.green },
  quoteName:  { fontSize: 11, color: C.green, fontWeight: '600', marginBottom: 1 },
  quoteText:  { fontSize: 12, color: C.textSub },
  // Bubble
  bubble:     { paddingHorizontal: 12, paddingVertical: 9, borderRadius: C.radiusLg, maxWidth: '100%' },
  bubbleMe:   { backgroundColor: C.green, borderBottomRightRadius: 3, shadowColor: C.green, shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  bubbleOther:{ backgroundColor: C.bgCard, borderBottomLeftRadius: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  bubbleRecalled: { backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 4 },
  recalledText: { fontSize: 13, color: C.textTip, fontStyle: 'italic' },
  msgText:    { fontSize: 15, color: C.text, lineHeight: 21 },
  msgTextMe:  { color: '#fff' },
  msgImage:   { width: 180, height: 180, borderRadius: 8 },
  // File
  fileRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 120, maxWidth: 200 },
  fileIcon:   { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(0,0,0,.1)', alignItems: 'center', justifyContent: 'center' },
  fileIconText: { fontSize: 18 },
  fileName:   { fontSize: 13, color: C.text, fontWeight: '500' },
  fileSize:   { fontSize: 11, color: C.textSub, marginTop: 2 },
  // Voice
  voiceRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 80 },
  voiceDur:   { fontSize: 13, color: C.text },
  // Sticker
  stickerImg: { width: 100, height: 100 },
  // Contact card
  contactCard:{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 150 },
  contactName:{ fontSize: 14, fontWeight: '600', color: C.text },
  contactHint:{ fontSize: 11, color: C.textSub, marginTop: 2 },
  // Reactions
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  reactionPill: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 12, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.border },
  reactionPillMine: { backgroundColor: '#E8F8EE', borderColor: C.green },
  reactionCount: { fontSize: 11, color: C.textSub },
  // Time row
  timeRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  timeText:   { fontSize: 10, color: C.textTip },
  readLabel:  { fontSize: 10, color: C.green },
  failedLabel:{ fontSize: 12, color: C.red, fontWeight: '700' },
  // Typing
  typingRow:  { paddingHorizontal: 16, paddingBottom: 8 },
  typingText: { fontSize: 12, color: C.textTip, fontStyle: 'italic' },
  // Mention
  mentionList:{ backgroundColor: C.bgCard, borderTopWidth: 0.5, borderTopColor: C.border, maxHeight: 180 },
  mentionItem:{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: C.border },
  mentionName:{ fontSize: 14, color: C.text },
  // Emoji panel
  emojiPanel: { backgroundColor: C.bgCard, borderTopWidth: 0.5, borderTopColor: C.border, maxHeight: 200 },
  emojiGrid:  { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  emojiBtn:   { width: (SW - 16) / 8, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  // Reply bar
  replyBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgCard, borderTopWidth: 0.5, borderTopColor: C.border, paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  replyAccent:{ width: 3, height: 32, backgroundColor: C.green, borderRadius: 2 },
  replyName:  { fontSize: 12, color: C.green, fontWeight: '600', marginBottom: 1 },
  replyContent:{ fontSize: 12, color: C.textSub },
  replyClose: { fontSize: 16, color: C.textTip, padding: 4 },
  // Input bar
  inputBar:   { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 8, backgroundColor: C.bgCard, borderTopWidth: 0.5, borderTopColor: C.border, gap: 6 },
  toolBtn:    { paddingBottom: 8, paddingHorizontal: 2 },
  textInput:  { flex: 1, backgroundColor: C.bgInput, borderRadius: C.radius, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: C.text, maxHeight: 120, minHeight: 38 },
  sendBtn:    { paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  sendBtnOff: { backgroundColor: C.textTip },
  sendBtnText:{ color: '#fff', fontSize: 14, fontWeight: '600' },
  // Reaction modal
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,.4)', alignItems: 'center', justifyContent: 'center' },
  reactionModal:{ flexDirection: 'row', backgroundColor: C.bgCard, borderRadius: 30, paddingHorizontal: 12, paddingVertical: 10, gap: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },
  reactionBtn: { padding: 6 },
  // Lightbox
  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.9)', alignItems: 'center', justifyContent: 'center' },
  lightboxImg: { width: SW, height: SW, maxHeight: '85%' },
});
