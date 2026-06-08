import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Image, KeyboardAvoidingView, Platform } from 'react-native';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { SOCKET_URL } from '../config';
import * as ImagePicker from 'expo-image-picker';
import CallScreen from './CallScreen';

function Avatar({ src, name, size = 36 }) {
  const colors = ['#1ABC9C','#3498DB','#9B59B6','#E67E22','#E74C3C','#07C160'];
  let hash = 0;
  for (let i = 0; i < (name||'').length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash));
  const bg = colors[Math.abs(hash) % colors.length];
  const letter = (name||'?')[0].toUpperCase();
  const r = size * 0.22;
  if (src) return <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: r }} />;
  return <View style={{ width: size, height: size, borderRadius: r, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '600' }}>{letter}</Text></View>;
}

export default function ChatScreen({ route, navigation }) {
  const { conversation } = route.params;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const socketRef = useRef(null);
  const socketConnectedRef = useRef(false);
  const flatListRef = useRef(null);
  const { user, token } = useAuth();

  useEffect(() => {
    axios.get(`/api/messages/${conversation.id}`).then(r => {
      const data = r.data?.data || r.data || [];
      setMessages(data);
    });

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    socketConnectedRef.current = true;

    socket.on('connect', () => {
      socket.emit('join_conversation', { conversationId: conversation.id });
    });

    socket.on('new_message', msg => {
      if (msg.conversation_id === conversation.id) {
        setMessages(prev => [...prev, msg]);
      }
    });

    // 通话信令
    socket.on('call:incoming', ({ from, type, caller }) => {
      if (from !== conversation.id && from !== conversation.otherUser?.id) return;
      setActiveCall({
        type,
        direction: 'incoming',
        remoteUser: { id: from, name: caller?.name || caller?.username, avatar: caller?.avatar },
        remoteId: from,
      });
    });

    return () => {
      socketConnectedRef.current = false;
      socket.disconnect();
    };
  }, [conversation.id, token]);

  const send = () => {
    if (!input.trim()) return;
    socketRef.current?.emit('send_message', {
      conversationId: conversation.id,
      content: input.trim(),
      type: 'text',
      reply_to_id: replyTo?.id || null,
    });
    setInput('');
    setReplyTo(null);
  };

  const sendImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled) return;
    const asset       = result.assets[0];
    const uri         = asset.uri;
    const contentType = asset.mimeType || 'image/jpeg';
    const filename    = asset.fileName || 'photo.jpg';

    try {
      const { data: cred } = await axios.post('/api/upload/credential', {
        filename,
        contentType,
        conversationId: conversation.id,
      });

      const fileResp = await fetch(uri);
      const blob     = await fileResp.blob();
      const upResp   = await fetch(cred.uploadUrl, {
        method:  'PUT',
        headers: { 'Content-Type': contentType },
        body:    blob,
      });
      if (!upResp.ok) throw new Error(`云存储上传失败 (${upResp.status})`);

      socketRef.current?.emit('send_file_message', {
        conversationId: conversation.id,
        type:     'image',
        file_url: cred.publicUrl,
        content:  filename,
      });
    } catch (err) { alert(err.message || '上传失败'); }
  };

  // 发起通话
  const startCall = (type) => {
    const targetId = conversation.type === 'group'
      ? (conversation.id || '')
      : (conversation.otherUser?.id || conversation.id);
    if (!targetId) return;

    socketRef.current?.emit('call:request', {
      to: targetId,
      type,
      caller: { id: user.id, name: user.username, avatar: user.avatar },
    });

    setActiveCall({
      type,
      direction: 'outgoing',
      remoteUser: conversation.type === 'group'
        ? { id: targetId, name: conversation.name || '群聊' }
        : { id: targetId, name: conversation.otherUser?.name || conversation.name, avatar: conversation.otherUser?.avatar },
      remoteId: targetId,
    });
  };

  const renderItem = ({ item }) => {
    const isMine = item.sender_id === user.id;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={() => setReplyTo({ id: item.id, senderName: item.senderName, content: item.content, type: item.type })}
      >
        <View style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowOther]}>
          {!isMine && <Avatar src={item.senderAvatar} name={item.senderName} />}
          <View style={{ maxWidth: '70%' }}>
            {!isMine && conversation.type === 'group' && (
              <Text style={styles.senderName}>{item.senderName}</Text>
            )}
            {item.replyTo && (
              <View style={[styles.replyPreview, isMine ? styles.replyPreviewMine : styles.replyPreviewOther]}>
                <Text style={styles.replyName}>{item.replyTo.senderName}</Text>
                <Text style={styles.replyText} numberOfLines={1}>
                  {item.replyTo.type === 'image' ? '[图片]' : item.replyTo.type === 'voice' ? '[语音]' : item.replyTo.content}
                </Text>
              </View>
            )}
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
              {item.type === 'text' && <Text style={styles.msgText}>{item.content}</Text>}
              {item.type === 'image' && <Image source={{ uri: item.file_url }} style={styles.msgImage} resizeMode="cover" />}
              {item.type === 'file' && <Text style={styles.fileText}>📎 {item.content}</Text>}
              {item.type === 'voice' && <Text style={styles.fileText}>🎵 语音消息</Text>}
            </View>
          </View>
          {isMine && <Avatar src={user.avatar} name={user.username} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
      {/* 通话按钮（语音+视频） */}
      {conversation.type !== 'group' && (
        <View style={styles.callBar}>
          <TouchableOpacity activeOpacity={0.72} style={styles.callBtn} onPress={() => startCall('audio')}>
            <Text style={styles.callBtnIcon}>📞</Text>
            <Text style={styles.callBtnLabel}>语音通话</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.72} style={styles.callBtn} onPress={() => startCall('video')}>
            <Text style={styles.callBtnIcon}>📹</Text>
            <Text style={styles.callBtnLabel}>视频通话</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={i => i.id || Math.random().toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {replyTo && (
        <View style={styles.replyBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.replyBarName}>回复 {replyTo.senderName}</Text>
            <Text style={styles.replyBarText} numberOfLines={1}>
              {replyTo.type === 'image' ? '[图片]' : replyTo.content}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)} style={{ padding: 4 }}>
            <Text style={{ fontSize: 16, color: '#888' }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputBar}>
        <TouchableOpacity activeOpacity={0.72} style={styles.iconBtn} onPress={sendImage}>
          <Text style={{ fontSize: 22 }}>📷</Text>
        </TouchableOpacity>
        <TextInput style={styles.textInput} value={input} onChangeText={setInput} placeholder="输入消息..." placeholderTextColor="#8E8E93" multiline />
        <TouchableOpacity activeOpacity={0.82} style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]} onPress={send} disabled={!input.trim()}>
          <Text style={styles.sendBtnText}>发送</Text>
        </TouchableOpacity>
      </View>

      {/* 通话弹窗 */}
      {activeCall && socketRef.current && (
        <CallScreen
          socket={socketRef.current}
          user={user}
          call={activeCall}
          onClose={() => setActiveCall(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EDEFF2' },
  list: { padding: 16, gap: 4 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8 },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  senderName: { fontSize: 11, color: '#888', marginBottom: 2, marginLeft: 2 },
  replyPreview: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 3, borderLeftWidth: 3 },
  replyPreviewMine: { backgroundColor: 'rgba(0,0,0,0.06)', borderLeftColor: '#07C160' },
  replyPreviewOther: { backgroundColor: 'rgba(0,0,0,0.06)', borderLeftColor: '#07C160' },
  replyName: { fontSize: 11, color: '#07C160', fontWeight: '600', marginBottom: 1 },
  replyText: { fontSize: 12, color: '#666' },
  bubble: { padding: 10, borderRadius: 12, borderWidth: 1 },
  bubbleMine: { backgroundColor: '#95EC69', borderColor: 'rgba(118,215,82,0.7)', borderBottomRightRadius: 3, shadowColor: '#4CAF50', shadowOpacity: 0.16, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  bubbleOther: { backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'rgba(255,255,255,0.95)', borderBottomLeftRadius: 3, shadowColor: '#6B7280', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  msgText: { fontSize: 15, lineHeight: 22 },
  msgImage: { width: 180, height: 180, borderRadius: 6 },
  fileText: { fontSize: 14, color: '#07C160' },
  replyBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(247,247,247,0.86)', borderTopWidth: 1, borderTopColor: 'rgba(210,214,220,0.8)', paddingHorizontal: 14, paddingVertical: 6, gap: 8 },
  replyBarName: { fontSize: 12, color: '#07C160', fontWeight: '600', marginBottom: 1 },
  replyBarText: { fontSize: 12, color: '#888' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, backgroundColor: 'rgba(247,247,247,0.86)', borderTopWidth: 1, borderTopColor: 'rgba(210,214,220,0.8)', gap: 8 },
  iconBtn: { padding: 6, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.62)' },
  textInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 10, padding: 8, fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: 'rgba(220,224,230,0.92)' },
  sendBtn: { backgroundColor: '#07C160', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, shadowColor: '#07C160', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  // Call bar
  callBar: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(210,214,220,0.72)',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  callBtnIcon: { fontSize: 16 },
  callBtnLabel: { fontSize: 13, color: '#333', fontWeight: '500' },
});
