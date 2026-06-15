import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { mediaUrl } from '../config';

const C = {
  green: '#07C160', bg: '#F7F8FA', bgCard: '#FFFFFF', bgInput: '#ECEEF2',
  text: '#1F2D3D', textSub: '#7A8694', textTip: '#B0BAC5', border: '#E8ECF0', red: '#FA5151',
};

function fmtDate(sec) {
  const d = new Date(sec * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CollectionsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/users/me/collections')
      .then(r => setList(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const remove = (id) => {
    Alert.alert('取消收藏', '确认取消收藏这条内容？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => {
        try { await axios.delete(`/api/users/me/collections/${id}`); setList(p => p.filter(c => c.id !== id)); } catch {}
      } },
    ]);
  };

  const renderItem = ({ item: c }) => (
    <TouchableOpacity activeOpacity={0.8} onLongPress={() => remove(c.id)} style={s.card}>
      <View style={{ flex: 1 }}>
        {c.type === 'image' ? (
          <Image source={{ uri: mediaUrl(c.extra?.file_url || c.content) }} style={s.img} resizeMode="cover" />
        ) : c.type === 'file' ? (
          <Text style={s.fileTxt}>📎 {c.content || '文件'}</Text>
        ) : (
          <Text style={s.textTxt}>{c.content}</Text>
        )}
        <Text style={s.date}>{c.created_at ? fmtDate(c.created_at) : ''}</Text>
      </View>
      <TouchableOpacity onPress={() => remove(c.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={s.del}>删除</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[s.header, { paddingTop: insets.top || 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.back}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>我的收藏</Text>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <ActivityIndicator color={C.green} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={c => String(c.id)}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={s.empty}>还没有收藏内容{'\n'}在聊天中长按消息可收藏</Text>}
          contentContainerStyle={list.length === 0 ? { flex: 1, justifyContent: 'center' } : { padding: 12 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12, backgroundColor: C.bgCard, borderBottomWidth: 0.5, borderBottomColor: C.border },
  back: { fontSize: 30, color: C.green, width: 40, lineHeight: 32 },
  title: { fontSize: 17, fontWeight: '600', color: C.text },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.bgCard, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: C.border },
  img: { width: 160, height: 160, borderRadius: 8, backgroundColor: C.bgInput },
  fileTxt: { fontSize: 15, color: C.text },
  textTxt: { fontSize: 15, color: C.text, lineHeight: 21 },
  date: { fontSize: 12, color: C.textTip, marginTop: 8 },
  del: { fontSize: 13, color: C.red },
  empty: { textAlign: 'center', color: C.textTip, fontSize: 14, lineHeight: 22 },
});
