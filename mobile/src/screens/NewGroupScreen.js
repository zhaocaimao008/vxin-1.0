import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { mediaUrl } from '../config';

const C = { green: '#07C160', text: '#1F2D3D', sub: '#7A8694', tip: '#B0BAC5', border: '#E8ECF0', bg: '#F7F8FA', card: '#fff' };

function Avatar({ src, name, size = 42 }) {
  const colors = ['#1ABC9C', '#3498DB', '#9B59B6', '#E67E22', '#E74C3C', '#07C160'];
  let h = 0; for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  if (src) return <Image source={{ uri: mediaUrl(src) }} style={{ width: size, height: size, borderRadius: 6 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: 6, backgroundColor: colors[Math.abs(h) % colors.length], alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '600' }}>{(name || '?')[0].toUpperCase()}</Text>
    </View>
  );
}

export default function NewGroupScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState([]);
  const [sel, setSel] = useState({});       // id -> contact
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    axios.get('/api/users/contacts')
      .then(r => setContacts(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? contacts.filter(c => (c.remark || c.username || '').toLowerCase().includes(q))
    : contacts;
  const selectedList = Object.values(sel);

  const toggle = (c) => {
    setSel(prev => {
      const next = { ...prev };
      if (next[c.id]) delete next[c.id]; else next[c.id] = c;
      return next;
    });
  };

  const create = async () => {
    const memberIds = Object.keys(sel);
    if (memberIds.length === 0) { Alert.alert('提示', '请至少选择一位联系人'); return; }
    const groupName = name.trim() || selectedList.slice(0, 3).map(c => c.remark || c.username).join('、');
    setCreating(true);
    try {
      const { data } = await axios.post('/api/messages/conversation/group', { name: groupName, memberIds });
      navigation.replace('Chat', { conversation: { id: data.conversationId, type: 'group', name: groupName, memberCount: memberIds.length + 1 } });
    } catch (e) {
      Alert.alert('创建失败', e.response?.data?.error || '请重试');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>‹ 返回</Text></TouchableOpacity>
        <Text style={s.navTitle}>发起群聊</Text>
        <TouchableOpacity onPress={create} disabled={creating || selectedList.length === 0}>
          <Text style={[s.create, (creating || selectedList.length === 0) && { color: C.tip }]}>
            {creating ? '创建中' : `创建${selectedList.length ? `(${selectedList.length})` : ''}`}
          </Text>
        </TouchableOpacity>
      </View>

      <TextInput style={s.nameInput} value={name} onChangeText={setName} placeholder="群聊名称（可选，默认取成员名）" placeholderTextColor={C.tip} maxLength={30} />
      <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="搜索联系人" placeholderTextColor={C.tip} autoCapitalize="none" />

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.green} size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => String(c.id)}
          ListEmptyComponent={<Text style={s.empty}>暂无联系人</Text>}
          renderItem={({ item: c }) => (
            <TouchableOpacity style={s.row} onPress={() => toggle(c)} activeOpacity={0.7}>
              <View style={[s.check, sel[c.id] && s.checkOn]}>{sel[c.id] && <Text style={s.checkMark}>✓</Text>}</View>
              <Avatar src={c.avatar} name={c.remark || c.username} />
              <Text style={s.name} numberOfLines={1}>{c.remark || c.username}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navbar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.card, borderBottomWidth: 0.5, borderBottomColor: C.border },
  back:       { fontSize: 16, color: C.green },
  navTitle:   { fontSize: 17, fontWeight: '600', color: C.text },
  create:     { fontSize: 15, color: C.green, fontWeight: '600' },
  nameInput:  { backgroundColor: C.card, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: C.text, borderBottomWidth: 0.5, borderBottomColor: C.border },
  searchInput:{ backgroundColor: C.card, marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.text, borderBottomWidth: 0.5, borderBottomColor: C.border },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.card },
  check:      { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#CBD2DA', alignItems: 'center', justifyContent: 'center' },
  checkOn:    { backgroundColor: C.green, borderColor: C.green },
  checkMark:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  name:       { fontSize: 15, color: C.text, flex: 1 },
  empty:      { textAlign: 'center', color: C.sub, paddingVertical: 30, fontSize: 14 },
});
