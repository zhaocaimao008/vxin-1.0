import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Image, KeyboardAvoidingView, Platform } from 'react-native';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { SOCKET_URL } from '../config';
import * as ImagePicker from 'expo-image-picker';

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

export default function ChatScreen({ route }) {
  const { conversation } = route.params;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const socketRef = useRef(null);
  const flatListRef = useRef(null);
  const { user, token } = useAuth();

  useEffect(() => {
    axios.get(`/api/messages/${conversation.id}`).then(r => setMessages(r.data));
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;
    socket.emit('join_conversation', { conversationId: conversation.id });
    socket.on('new_message', msg => {
      if (msg.conversation_id === conversation.id) setMessages(prev => [...prev, msg]);
    });
    return () => socket.disconnect();
  }, [conversation.id, token]);

  const send = () => {
    if (!input.trim()) return;
    socketRef.current?.emit('send_message', { conversationId: conversation.id, content: input.trim(), type: 'text' });
    setInput('');
  };

  const sendImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    const fd = new FormData();
    fd.append('file', { uri, type: 'image/jpeg', name: 'photo.jpg' });
    try {
      const { data } = await axios.post(`/api/messages/${conversation.id}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMessages(prev => [...prev, data]);
    } catch { alert('上传失败'); }
  };

  const renderItem = ({ item }) => {
    const isMine = item.sender_id === user.id;
    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowOther]}>
        {!isMine && <Avatar src={item.senderAvatar} name={item.senderName} />}
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
          {item.type === 'text' && <Text style={styles.msgText}>{item.content}</Text>}
          {item.type === 'image' && <Image source={{ uri: item.file_url }} style={styles.msgImage} resizeMode="cover" />}
          {item.type === 'file' && <Text style={styles.fileText}>📎 {item.content}</Text>}
        </View>
        {isMine && <Avatar src={user.avatar} name={user.username} />}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={sendImage}>
          <Text style={{ fontSize: 22 }}>📷</Text>
        </TouchableOpacity>
        <TextInput style={styles.textInput} value={input} onChangeText={setInput} placeholder="输入消息..." multiline />
        <TouchableOpacity style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]} onPress={send} disabled={!input.trim()}>
          <Text style={styles.sendBtnText}>发送</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  list: { padding: 16, gap: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8 },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '70%', padding: 10, borderRadius: 10 },
  bubbleMine: { backgroundColor: '#95EC69', borderBottomRightRadius: 2 },
  bubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  msgText: { fontSize: 15, lineHeight: 22 },
  msgImage: { width: 180, height: 180, borderRadius: 6 },
  fileText: { fontSize: 14, color: '#07C160' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, backgroundColor: '#F7F7F7', borderTopWidth: 1, borderTopColor: '#E5E5E5', gap: 8 },
  iconBtn: { padding: 6 },
  textInput: { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 8, fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: '#E5E5E5' },
  sendBtn: { backgroundColor: '#07C160', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 }
});
