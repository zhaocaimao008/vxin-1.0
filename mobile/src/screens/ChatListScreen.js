import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Image } from 'react-native';
import axios from 'axios';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

function Avatar({ src, name, size = 44 }) {
  const colors = ['#1ABC9C','#3498DB','#9B59B6','#E67E22','#E74C3C','#07C160'];
  let hash = 0;
  for (let i = 0; i < (name||'').length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash));
  const bg = colors[Math.abs(hash) % colors.length];
  const letter = (name||'?')[0].toUpperCase();
  const r = size * 0.22;
  if (src) return <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: r }} />;
  return <View style={{ width: size, height: size, borderRadius: r, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '600' }}>{letter}</Text></View>;
}

export default function ChatListScreen() {
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  const navigation = useNavigation();

  const fetch = useCallback(async () => {
    const { data } = await axios.get('/api/messages/conversations');
    setConversations(data);
  }, []);

  useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

  const filtered = conversations.filter(c => (c.name||'').includes(search));

  const preview = (conv) => {
    if (!conv.lastMessage) return '';
    if (conv.lastMessageType === 'image') return '[图片]';
    if (conv.lastMessageType === 'file') return '[文件]';
    return conv.lastMessage;
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput style={styles.searchInput} placeholder="搜索" placeholderTextColor="#8E8E93" value={search} onChangeText={setSearch} />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.72} style={styles.item} onPress={() => navigation.navigate('Chat', { conversation: item })}>
            <View style={{ position: 'relative' }}>
              <Avatar src={item.avatar} name={item.name} />
              {item.unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
                </View>
              )}
            </View>
            <View style={styles.info}>
              <View style={styles.row}>
                <Text style={[styles.name, item.unreadCount > 0 && styles.nameUnread]} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.time}>{item.lastTime ? new Date(item.lastTime*1000).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) : ''}</Text>
              </View>
              <Text style={styles.preview} numberOfLines={1}>{preview(item)}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>暂无会话</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EEF0F3' },
  searchBar: { padding: 10, backgroundColor: 'rgba(247,247,247,0.82)', borderBottomWidth: 1, borderBottomColor: 'rgba(210,214,220,0.72)' },
  searchInput: { backgroundColor: 'rgba(255,255,255,0.74)', borderRadius: 10, padding: 9, fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)' },
  item: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(230,232,236,0.88)', backgroundColor: 'rgba(255,255,255,0.76)' },
  info: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontWeight: '600', fontSize: 15, flex: 1 },
  nameUnread: { color: '#191919' },
  time: { fontSize: 11, color: '#9CA3AF' },
  preview: { fontSize: 13, color: '#7C828A', marginTop: 2 },
  empty: { textAlign: 'center', color: '#aaa', padding: 32 },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#FA5151', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#fff' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', lineHeight: 14 },
});
