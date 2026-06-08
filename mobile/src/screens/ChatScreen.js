import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  Image, KeyboardAvoidingView, Platform, ActivityIndicator,
  ActionSheetIOS, Alert, Clipboard, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import CallScreen from './CallScreen';

const C = {
  nav: '#1A2033',
  green: '#07C160',
  greenLight: '#E8F8EE',
  bg: '#F7F8FA',
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

function Avatar({ src, name, size = 38 }) {
  const colors = ['#1ABC9C', '#3498DB', '#9B59B6', '#E67E22', '#E74C3C', '#07C160'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash));
  const bg = colors[Math.abs(hash) % colors.length];
  const letter = (name || '?')[0].toUpperCase();
  if (src) return <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: C.radius }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: C.radius, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '600' }}>{letter}</Text>
    </View>
  );
}

function SendArrowIcon() {
  return (
    <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 0, height: 0,
        borderLeftWidth: 10,
        borderTopWidth: 6,
        borderBottomWidth: 6,
        borderLeftColor: '#fff',
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        marginLeft: 2,
      }} />
    </View>
  );
}

function EmojiIcon() {
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.textSub, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 12, lineHeight: 14 }}>:)</Text>
    </View>
  );
}

function ImageIcon() {
  return (
    <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: C.textSub, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.textSub, position: 'absolute', top: 3, left: 3 }} />
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        borderTopWidth: 5, borderLeftWidth: 4, borderRightWidth: 4,
        borderTopColor: C.textSub, borderLeftColor: 'transparent', borderRightColor: 'transparent',
      }} />
    </View>
  );
}

export default function ChatScreen({ route, navigation }) {
  const { conversation } = route.params;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const flatListRef = useRef(null);
  const pendingAcks = useRef({});
  const { user } = useAuth();
  const { socket } = useSocket();
  const insets = useSafeAreaInsets();

  // Set navigation header
  useLayoutEffect(() => {
    const memberInfo = conversation.type === 'group' && conversation.memberCount
      ? ` (${conversation.memberCount})`
      : '';
    navigation.setOptions({
      title: (conversation.name || '聊天') + memberInfo,
      headerStyle: { backgroundColor: C.bgCard },
      headerTitleStyle: { fontSize: 17, fontWeight: '600', color: C.text },
    });
  }, [navigation, conversation]);

  // Load messages
  useEffect(() => {
    setLoadingMsgs(true);
    axios.get(`/api/messages/${conversation.id}?limit=50`)
      .then(r => {
        const data = r.data?.data || r.data || [];
        setMessages(Array.isArray(data) ? data : []);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));

    // Mark as read
    axios.post(`/api/messages/conversation/${conversation.id}/read`).catch(() => {});
  }, [conversation.id]);

  // Socket: join conversation room + listen for messages + call events
  useEffect(() => {
    if (!socket) return;

    socket.emit('join_conversation', { conversationId: conversation.id });

    const handleMessage = (msg) => {
      if (msg.conversation_id !== conversation.id) return;

      setMessages(prev => {
        // Check if this is an ack for an optimistic message
        if (msg.tempId && pendingAcks.current[msg.tempId]) {
          delete pendingAcks.current[msg.tempId];
          return prev.map(m => m._tempId === msg.tempId ? { ...msg, _status: 'sent' } : m);
        }
        // Avoid duplicate
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    const handleIncomingCall = ({ from, type, caller }) => {
      if (from !== conversation.id && from !== conversation.otherUser?.id) return;
      setActiveCall({
        type,
        direction: 'incoming',
        remoteUser: { id: from, name: caller?.name || caller?.username, avatar: caller?.avatar },
        remoteId: from,
      });
    };

    socket.on('new_message', handleMessage);
    socket.on('call:incoming', handleIncomingCall);

    return () => {
      socket.off('new_message', handleMessage);
      socket.off('call:incoming', handleIncomingCall);
    };
  }, [socket, conversation.id, conversation.otherUser?.id]);

  // Auto-scroll to bottom when messages grow
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const send = useCallback(() => {
    if (!input.trim() || !socket || sending) return;
    const text = input.trim();
    setInput('');
    const replyRef = replyTo;
    setReplyTo(null);

    // Optimistic message
    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      _tempId: tempId,
      id: tempId,
      conversation_id: conversation.id,
      sender_id: user.id,
      senderName: user.username,
      senderAvatar: user.avatar,
      content: text,
      type: 'text',
      reply_to_id: replyRef?.id || null,
      replyTo: replyRef ? { senderName: replyRef.senderName, content: replyRef.content, type: replyRef.type } : null,
      created_at: Math.floor(Date.now() / 1000),
      _status: 'sending',
    };

    setMessages(prev => [...prev, optimistic]);
    pendingAcks.current[tempId] = true;

    socket.emit('send_message', {
      conversationId: conversation.id,
      content: text,
      type: 'text',
      reply_to_id: replyRef?.id || null,
      tempId,
    }, (ack) => {
      delete pendingAcks.current[tempId];
      if (ack?.success && ack?.message) {
        setMessages(prev => prev.map(m =>
          m._tempId === tempId ? { ...ack.message, _status: 'sent' } : m
        ));
      } else {
        setMessages(prev => prev.map(m =>
          m._tempId === tempId ? { ...m, _status: 'failed' } : m
        ));
      }
    });
  }, [input, socket, sending, conversation.id, user, replyTo]);

  const sendImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('需要权限', '请允许访问相册');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('file', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || 'photo.jpg',
      });
      const { data } = await axios.post('/api/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      socket?.emit('send_message', {
        conversationId: conversation.id,
        content: data.url || '',
        type: 'image',
        file_url: data.url,
      });
    } catch (err) {
      Alert.alert('上传失败', err.message || '请重试');
    } finally {
      setSending(false);
    }
  };

  const startCall = (type) => {
    const targetId = conversation.type === 'group'
      ? conversation.id
      : (conversation.otherUser?.id || conversation.id);
    if (!targetId) return;
    socket?.emit('call:request', {
      to: targetId,
      type,
      caller: { id: user.id, name: user.username, avatar: user.avatar },
    });
    setActiveCall({
      type,
      direction: 'outgoing',
      remoteUser: conversation.type === 'group'
        ? { id: targetId, name: conversation.name || '群聊' }
        : { id: targetId, name: conversation.otherUser?.username || conversation.name, avatar: conversation.otherUser?.avatar },
      remoteId: targetId,
    });
  };

  const onLongPressMessage = (msg) => {
    const actions = ['复制', '回复', '删除', '取消'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: actions, destructiveButtonIndex: 2, cancelButtonIndex: 3 },
        (idx) => {
          if (idx === 0) Clipboard.setString(msg.content || '');
          else if (idx === 1) setReplyTo({ id: msg.id, senderName: msg.senderName, content: msg.content, type: msg.type });
          else if (idx === 2 && msg.sender_id === user.id) {
            Alert.alert('删除消息', '确认删除？', [
              { text: '取消', style: 'cancel' },
              {
                text: '删除', style: 'destructive',
                onPress: () => {
                  axios.delete(`/api/messages/${msg.id}`).catch(() => {});
                  setMessages(prev => prev.filter(m => m.id !== msg.id));
                },
              },
            ]);
          }
        },
      );
    } else {
      Alert.alert('消息操作', '', [
        { text: '复制', onPress: () => Clipboard.setString(msg.content || '') },
        { text: '回复', onPress: () => setReplyTo({ id: msg.id, senderName: msg.senderName, content: msg.content, type: msg.type }) },
        ...(msg.sender_id === user.id ? [{
          text: '删除', style: 'destructive',
          onPress: () => {
            axios.delete(`/api/messages/${msg.id}`).catch(() => {});
            setMessages(prev => prev.filter(m => m.id !== msg.id));
          },
        }] : []),
        { text: '取消', style: 'cancel' },
      ]);
    }
  };

  const renderItem = useCallback(({ item }) => {
    const isMine = item.sender_id === user.id;

    // System message
    if (item.type === 'system') {
      return (
        <View style={styles.systemMsgWrap}>
          <Text style={styles.systemMsg}>{item.content}</Text>
        </View>
      );
    }

    return (
      <Pressable
        onLongPress={() => onLongPressMessage(item)}
        delayLongPress={350}
      >
        <View style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowOther]}>
          {/* Other user avatar */}
          {!isMine && (
            <View style={styles.avatarCol}>
              <Avatar src={item.senderAvatar} name={item.senderName || '?'} size={38} />
            </View>
          )}

          <View style={[styles.bubbleCol, isMine ? styles.bubbleColMine : styles.bubbleColOther]}>
            {/* Sender name in group chats */}
            {!isMine && conversation.type === 'group' && (
              <Text style={styles.senderName}>{item.senderName}</Text>
            )}

            {/* Reply preview */}
            {item.replyTo && (
              <View style={[styles.replyPreview, isMine ? styles.replyPreviewMine : styles.replyPreviewOther]}>
                <Text style={styles.replyPreviewName} numberOfLines={1}>{item.replyTo.senderName}</Text>
                <Text style={styles.replyPreviewText} numberOfLines={1}>
                  {item.replyTo.type === 'image' ? '[图片]' : item.replyTo.type === 'voice' ? '[语音]' : item.replyTo.content}
                </Text>
              </View>
            )}

            {/* Bubble */}
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
              {item.type === 'text' && (
                <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{item.content}</Text>
              )}
              {item.type === 'image' && (
                <Image
                  source={{ uri: item.file_url || item.content }}
                  style={styles.msgImage}
                  resizeMode="cover"
                />
              )}
              {item.type === 'file' && (
                <View style={styles.fileMsg}>
                  <View style={styles.fileIcon}>
                    <Text style={styles.fileIconText}>F</Text>
                  </View>
                  <Text style={styles.fileName} numberOfLines={2}>{item.content}</Text>
                </View>
              )}
              {item.type === 'voice' && (
                <View style={styles.voiceMsg}>
                  <View style={styles.voiceWaveIcon}>
                    {[3, 6, 9, 6, 3].map((h, i) => (
                      <View key={i} style={{ width: 3, height: h, backgroundColor: isMine ? 'rgba(255,255,255,0.8)' : C.green, borderRadius: 2, marginHorizontal: 1 }} />
                    ))}
                  </View>
                  <Text style={[styles.voiceText, isMine && { color: 'rgba(255,255,255,0.85)' }]}>语音消息</Text>
                </View>
              )}
            </View>

            {/* Status indicator for own messages */}
            {isMine && (
              <View style={styles.statusRow}>
                {item._status === 'sending' && (
                  <ActivityIndicator size={10} color={C.textTip} />
                )}
                {item._status === 'failed' && (
                  <Text style={styles.statusFailed}>!</Text>
                )}
              </View>
            )}
          </View>

          {/* Own avatar */}
          {isMine && (
            <View style={styles.avatarCol}>
              <Avatar src={user.avatar} name={user.username || '?'} size={38} />
            </View>
          )}
        </View>
      </Pressable>
    );
  }, [user, conversation.type]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Call shortcut bar for private chats */}
      {conversation.type !== 'group' && (
        <View style={styles.callBar}>
          <TouchableOpacity
            activeOpacity={0.72}
            style={styles.callBtn}
            onPress={() => startCall('audio')}
          >
            {/* Phone icon */}
            <View style={styles.phoneIcon}>
              <View style={styles.phoneBody} />
            </View>
            <Text style={styles.callBtnLabel}>语音</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.72}
            style={styles.callBtn}
            onPress={() => startCall('video')}
          >
            {/* Camera icon */}
            <View style={styles.camIcon}>
              <View style={styles.camBody} />
              <View style={styles.camLens} />
            </View>
            <Text style={styles.callBtnLabel}>视频</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages */}
      {loadingMsgs ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={C.green} size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id || item._tempId || Math.random().toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyMsgs}>
              <Text style={styles.emptyMsgsText}>开始聊天吧</Text>
            </View>
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Reply bar */}
      {replyTo && (
        <View style={styles.replyBar}>
          <View style={styles.replyBarLeft} />
          <View style={styles.replyBarContent}>
            <Text style={styles.replyBarName} numberOfLines={1}>回复 {replyTo.senderName}</Text>
            <Text style={styles.replyBarText} numberOfLines={1}>
              {replyTo.type === 'image' ? '[图片]' : replyTo.content}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.replyBarClose}
            onPress={() => setReplyTo(null)}
            activeOpacity={0.72}
          >
            <Text style={styles.replyBarCloseText}>X</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={styles.inputIconBtn}
          activeOpacity={0.72}
          onPress={sendImage}
        >
          <ImageIcon />
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="输入消息..."
          placeholderTextColor={C.textTip}
          multiline
          maxLength={2000}
          returnKeyType="default"
        />

        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || !socket) && styles.sendBtnDisabled]}
          onPress={send}
          activeOpacity={0.85}
          disabled={!input.trim() || !socket}
        >
          <SendArrowIcon />
        </TouchableOpacity>
      </View>

      {/* Call overlay */}
      {activeCall && socket && (
        <CallScreen
          socket={socket}
          user={user}
          call={activeCall}
          onClose={() => setActiveCall(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    backgroundColor: C.bgCard,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
  },
  phoneIcon: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneBody: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.green,
  },
  camIcon: {
    width: 16,
    height: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  camBody: {
    width: 10,
    height: 8,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: C.green,
  },
  camLens: {
    width: 0, height: 0,
    borderTopWidth: 4, borderBottomWidth: 4, borderLeftWidth: 5,
    borderTopColor: 'transparent', borderBottomColor: 'transparent',
    borderLeftColor: C.green,
    marginLeft: 1,
  },
  callBtnLabel: {
    fontSize: 12,
    color: C.textSub,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 4,
  },
  systemMsgWrap: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMsg: {
    fontSize: 12,
    color: C.textTip,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
    gap: 8,
  },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  avatarCol: {},
  bubbleCol: {
    maxWidth: '72%',
  },
  bubbleColMine: { alignItems: 'flex-end' },
  bubbleColOther: { alignItems: 'flex-start' },
  senderName: {
    fontSize: 11,
    color: C.textSub,
    marginBottom: 3,
    marginLeft: 2,
  },
  replyPreview: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 3,
    borderLeftWidth: 2.5,
    maxWidth: '100%',
  },
  replyPreviewMine: {
    backgroundColor: 'rgba(7,193,96,0.12)',
    borderLeftColor: C.green,
  },
  replyPreviewOther: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderLeftColor: C.green,
  },
  replyPreviewName: {
    fontSize: 11,
    color: C.green,
    fontWeight: '600',
    marginBottom: 1,
  },
  replyPreviewText: {
    fontSize: 12,
    color: C.textSub,
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: C.radiusLg,
    maxWidth: '100%',
  },
  bubbleMine: {
    backgroundColor: C.green,
    borderBottomRightRadius: 3,
    shadowColor: C.green,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  bubbleOther: {
    backgroundColor: C.bgCard,
    borderBottomLeftRadius: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  msgText: {
    fontSize: 15,
    color: C.text,
    lineHeight: 21,
  },
  msgTextMine: {
    color: '#fff',
  },
  msgImage: {
    width: 180,
    height: 180,
    borderRadius: 8,
  },
  fileMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 100,
  },
  fileIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIconText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  fileName: {
    flex: 1,
    fontSize: 13,
    color: '#fff',
  },
  voiceMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 80,
  },
  voiceWaveIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 16,
  },
  voiceText: {
    fontSize: 13,
    color: C.text,
  },
  statusRow: {
    marginTop: 2,
    alignItems: 'flex-end',
    minHeight: 12,
  },
  statusFailed: {
    color: C.red,
    fontSize: 14,
    fontWeight: '700',
  },
  // Reply bar
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  replyBarLeft: {
    width: 3,
    height: 32,
    backgroundColor: C.green,
    borderRadius: 2,
  },
  replyBarContent: {
    flex: 1,
  },
  replyBarName: {
    fontSize: 12,
    color: C.green,
    fontWeight: '600',
    marginBottom: 1,
  },
  replyBarText: {
    fontSize: 12,
    color: C.textSub,
  },
  replyBarClose: {
    padding: 6,
  },
  replyBarCloseText: {
    fontSize: 13,
    color: C.textSub,
    fontWeight: '600',
  },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: C.bgCard,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    gap: 8,
  },
  inputIconBtn: {
    paddingBottom: 10,
    paddingHorizontal: 2,
  },
  textInput: {
    flex: 1,
    backgroundColor: C.bgInput,
    borderRadius: C.radius,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 15,
    color: C.text,
    maxHeight: 120,
    minHeight: 38,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
    shadowColor: C.green,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sendBtnDisabled: {
    backgroundColor: C.textTip,
    shadowOpacity: 0,
    elevation: 0,
  },
  emptyMsgs: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyMsgsText: {
    fontSize: 14,
    color: C.textTip,
  },
});
