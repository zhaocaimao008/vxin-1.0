import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, FlatList, Alert, ActivityIndicator, Image,
} from 'react-native';
import axios from 'axios';
import { mediaUrl } from '../config';

const C = { green: '#07C160', text: '#1F2D3D', sub: '#7A8694', border: '#E8ECF0', bg: '#F7F8FA', card: '#fff' };

function Avatar({ src, name, size = 38, radius = 6 }) {
  const colors = ['#1ABC9C', '#3498DB', '#9B59B6', '#E67E22', '#E74C3C', '#07C160'];
  let h = 0; for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  if (src) return <Image source={{ uri: mediaUrl(src) }} style={{ width: size, height: size, borderRadius: radius }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors[Math.abs(h) % colors.length], alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '600' }}>{(name || '?')[0].toUpperCase()}</Text>
    </View>
  );
}

export default function ForwardModal({ visible, message, onClose }) {
  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState({});   // convId -> true
  const [friendConv, setFriendConv] = useState({}); // friendId -> convId
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelected({}); setFriendConv({}); setSearch(''); setTab('friends');
    axios.get('/api/users/contacts').then(r => setFriends(r.data || [])).catch(() => {});
    axios.get('/api/messages/my-groups').then(r => setGroups(r.data || [])).catch(() => {});
  }, [visible]);

  const q = search.toLowerCase();
  const fFriends = useMemo(() => friends.filter(f => (f.remark || f.username || '').toLowerCase().includes(q)), [friends, q]);
  const fGroups  = useMemo(() => groups.filter(g => (g.name || '').toLowerCase().includes(q)), [groups, q]);

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const toggleFriend = async (friend) => {
    let convId = friendConv[friend.id];
    if (!convId) {
      try {
        const { data } = await axios.post('/api/messages/conversation/private', { userId: friend.id });
        convId = data.conversationId;
        setFriendConv(prev => ({ ...prev, [friend.id]: convId }));
      } catch (_) { return; }
    }
    setSelected(prev => ({ ...prev, [convId]: !prev[convId] }));
  };

  const toggleGroup = (group) => {
    setSelected(prev => ({ ...prev, [group.id]: !prev[group.id] }));
  };

  const isFriendSelected = (f) => { const c = friendConv[f.id]; return c ? !!selected[c] : false; };

  const doForward = async () => {
    const ids = Object.keys(selected).filter(k => selected[k]);
    if (ids.length === 0) return;
    setSending(true);
    try {
      const { data } = await axios.post('/api/messages/forward', { msgId: message.id, conversationIds: ids });
      Alert.alert('转发成功', `已发送给 ${data.sent ?? ids.length} 个会话`);
      onClose();
    } catch (e) {
      Alert.alert('转发失败', e.response?.data?.error || '请重试');
    } finally {
      setSending(false);
    }
  };

  const preview = () => {
    if (!message) return '';
    if (message.type === 'image') return '[图片]';
    if (message.type === 'file') return `[文件] ${message.content || ''}`;
    if (message.type === 'voice') return '[语音]';
    if (message.type === 'red_packet') return '[红包]';
    return (message.content || '').slice(0, 40);
  };

  const renderFriend = ({ item: f }) => (
    <TouchableOpacity style={s.row} onPress={() => toggleFriend(f)} activeOpacity={0.7}>
      <View style={[s.check, isFriendSelected(f) && s.checkOn]}>{isFriendSelected(f) && <Text style={s.checkMark}>✓</Text>}</View>
      <Avatar src={f.avatar} name={f.remark || f.username} size={38} radius={6} />
      <Text style={s.name} numberOfLines={1}>{f.remark || f.username}</Text>
    </TouchableOpacity>
  );
  const renderGroup = ({ item: g }) => (
    <TouchableOpacity style={s.row} onPress={() => toggleGroup(g)} activeOpacity={0.7}>
      <View style={[s.check, selected[g.id] && s.checkOn]}>{selected[g.id] && <Text style={s.checkMark}>✓</Text>}</View>
      <Avatar src={g.avatar || g.groupAvatar} name={g.name} size={38} radius={6} />
      <View style={{ flex: 1 }}>
        <Text style={s.name} numberOfLines={1}>{g.name}</Text>
        <Text style={s.sub}>{g.memberCount || (g.members || []).length}人</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>转发消息</Text>
            <TouchableOpacity onPress={onClose}><Text style={s.close}>✕</Text></TouchableOpacity>
          </View>

          <View style={s.previewBox}>
            <Text style={s.previewLabel}>转发内容：</Text>
            <Text style={s.previewText} numberOfLines={1}>{preview()}</Text>
          </View>

          <TextInput style={s.searchInput} placeholder="搜索" value={search} onChangeText={setSearch} placeholderTextColor={C.sub} />

          <View style={s.tabs}>
            {[['friends', `好友 (${fFriends.length})`], ['groups', `群聊 (${fGroups.length})`]].map(([k, label]) => (
              <TouchableOpacity key={k} style={[s.tab, tab === k && s.tabOn]} onPress={() => setTab(k)}>
                <Text style={[s.tabText, tab === k && s.tabTextOn]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            style={{ flexGrow: 0, maxHeight: 320 }}
            data={tab === 'friends' ? fFriends : fGroups}
            keyExtractor={item => String(item.id)}
            renderItem={tab === 'friends' ? renderFriend : renderGroup}
            ListEmptyComponent={<Text style={s.empty}>{tab === 'friends' ? '暂无好友' : '暂无群聊'}</Text>}
          />

          <View style={s.footer}>
            <Text style={s.footerCount}>已选 {selectedCount} 个</Text>
            <TouchableOpacity
              style={[s.sendBtn, selectedCount === 0 && { opacity: 0.5 }]}
              onPress={doForward}
              disabled={selectedCount === 0 || sending}
            >
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.sendText}>发送{selectedCount > 0 ? `（${selectedCount}）` : ''}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,.45)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: C.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 28, maxHeight: '85%' },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title:     { fontSize: 17, fontWeight: '700', color: C.text },
  close:     { fontSize: 18, color: C.sub, paddingHorizontal: 6 },
  previewBox:{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 10 },
  previewLabel:{ fontSize: 13, color: C.sub },
  previewText:{ fontSize: 13, color: C.text, flex: 1 },
  searchInput:{ marginHorizontal: 16, backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: C.text },
  tabs:      { flexDirection: 'row', marginTop: 12, paddingHorizontal: 16, gap: 18, borderBottomWidth: 1, borderBottomColor: C.border },
  tab:       { paddingVertical: 10 },
  tabOn:     { borderBottomWidth: 2, borderBottomColor: C.green },
  tabText:   { fontSize: 14, color: C.sub },
  tabTextOn: { color: C.green, fontWeight: '600' },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  check:     { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#CBD2DA', alignItems: 'center', justifyContent: 'center' },
  checkOn:   { backgroundColor: C.green, borderColor: C.green },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  name:      { fontSize: 15, color: C.text, flex: 1 },
  sub:       { fontSize: 12, color: C.sub, marginTop: 2 },
  empty:     { textAlign: 'center', color: C.sub, paddingVertical: 30, fontSize: 14 },
  footer:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14 },
  footerCount:{ fontSize: 14, color: C.sub },
  sendBtn:   { backgroundColor: C.green, borderRadius: 8, paddingHorizontal: 28, paddingVertical: 10, minWidth: 96, alignItems: 'center' },
  sendText:  { color: '#fff', fontSize: 15, fontWeight: '600' },
});
