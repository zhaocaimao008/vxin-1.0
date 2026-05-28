import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, Image } from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';

function Avatar({ src, name, size = 44 }) {
  const colors = ['#1ABC9C','#3498DB','#9B59B6','#E67E22','#E74C3C','#07C160'];
  let hash = 0;
  for (let i = 0; i < (name||'').length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash));
  const bg = colors[Math.abs(hash) % colors.length];
  const letter = (name||'?')[0].toUpperCase();
  if (src) return <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: size * 0.22 }} />;
  return <View style={{ width: size, height: size, borderRadius: size * 0.22, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '600' }}>{letter}</Text></View>;
}

export default function ContactsScreen() {
  const [contacts, setContacts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [tab, setTab] = useState('contacts');
  const navigation = useNavigation();

  useEffect(() => {
    axios.get('/api/users/contacts').then(r => setContacts(r.data));
    axios.get('/api/users/friend-requests').then(r => setRequests(r.data));
  }, []);

  const doSearch = async () => {
    if (!search.trim()) return;
    const { data } = await axios.get(`/api/users/search?q=${encodeURIComponent(search)}`);
    setResults(data); setTab('search');
  };

  const sendReq = async (toId) => {
    try { await axios.post('/api/users/friend-request', { toId, message: '请求添加您为好友' }); Alert.alert('成功', '好友请求已发送'); }
    catch (err) { Alert.alert('失败', err.response?.data?.error || '请重试'); }
  };

  const handleReq = async (id, action) => {
    await axios.post(`/api/users/friend-request/${id}/handle`, { action });
    setRequests(prev => prev.filter(r => r.id !== id));
    if (action === 'accepted') axios.get('/api/users/contacts').then(r => setContacts(r.data));
  };

  const startChat = async (contact) => {
    const { data } = await axios.post('/api/messages/conversation/private', { userId: contact.id });
    navigation.navigate('Chat', { conversation: { id: data.conversationId, type: 'private', name: contact.username, avatar: contact.avatar } });
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput style={styles.searchInput} placeholder="搜索用户" value={search} onChangeText={setSearch} onSubmitEditing={doSearch} returnKeyType="search" />
        <TouchableOpacity style={styles.searchBtn} onPress={doSearch}><Text style={styles.searchBtnText}>搜索</Text></TouchableOpacity>
      </View>
      <View style={styles.tabs}>
        {[['contacts','联系人'],['requests',`新朋友${requests.length>0?` (${requests.length})`:''}`]].map(([k,l]) => (
          <TouchableOpacity key={k} style={[styles.tab, tab===k && styles.tabActive]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab===k && styles.tabTextActive]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={tab==='search' ? results : tab==='contacts' ? contacts : requests}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => tab==='contacts' && startChat(item)}>
            <Avatar src={item.avatar} name={item.username} />
            <View style={styles.info}>
              <Text style={styles.name}>{item.remark || item.username}</Text>
              <Text style={styles.sub} numberOfLines={1}>{item.bio || item.phone || item.message || ''}</Text>
            </View>
            {tab === 'search' && <TouchableOpacity style={styles.addBtn} onPress={() => sendReq(item.id)}><Text style={styles.addBtnText}>添加</Text></TouchableOpacity>}
            {tab === 'requests' && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => handleReq(item.id,'accepted')}><Text style={styles.acceptText}>接受</Text></TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReq(item.id,'rejected')}><Text style={styles.rejectText}>拒绝</Text></TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>暂无数据</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchBar: { flexDirection: 'row', padding: 10, gap: 8, backgroundColor: '#F7F7F7', borderBottomWidth: 1, borderBottomColor: '#E5E5E5' },
  searchInput: { flex: 1, backgroundColor: '#E8E8E8', borderRadius: 8, padding: 8, fontSize: 14 },
  searchBtn: { backgroundColor: '#07C160', borderRadius: 8, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E5E5' },
  tab: { flex: 1, padding: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#07C160' },
  tabText: { fontSize: 14, color: '#888' },
  tabTextActive: { color: '#07C160', fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  info: { flex: 1 },
  name: { fontWeight: '600', fontSize: 15 },
  sub: { fontSize: 12, color: '#888', marginTop: 2 },
  addBtn: { backgroundColor: '#07C160', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  acceptBtn: { backgroundColor: '#07C160', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  acceptText: { color: '#fff', fontSize: 12 },
  rejectBtn: { backgroundColor: '#F0F0F0', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  rejectText: { color: '#666', fontSize: 12 },
  empty: { textAlign: 'center', color: '#aaa', padding: 32 }
});
