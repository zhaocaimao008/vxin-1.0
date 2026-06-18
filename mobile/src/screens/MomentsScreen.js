import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  FlatList, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { mediaUrl } from '../config';

const C = {
  nav: '#1A2033', green: '#07C160', bg: '#F7F8FA', bgCard: '#FFFFFF',
  bgInput: '#ECEEF2', text: '#1F2D3D', textSub: '#7A8694', textTip: '#B0BAC5',
  border: '#E8ECF0', red: '#FA5151', blue: '#576B95',
};

function ago(sec) {
  const d = Date.now() / 1000 - sec;
  if (d < 60) return '刚刚';
  if (d < 3600) return Math.floor(d / 60) + '分钟前';
  if (d < 86400) return Math.floor(d / 3600) + '小时前';
  if (d < 2592000) return Math.floor(d / 86400) + '天前';
  return new Date(sec * 1000).toLocaleDateString('zh-CN');
}

function Avatar({ src, name, size = 42 }) {
  const colors = ['#1ABC9C', '#3498DB', '#9B59B6', '#E67E22', '#E74C3C', '#07C160'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash));
  const bg = colors[Math.abs(hash) % colors.length];
  if (src) return <Image source={{ uri: mediaUrl(src) }} style={{ width: size, height: size, borderRadius: 8 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: 8, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '600' }}>{(name || '?')[0].toUpperCase()}</Text>
    </View>
  );
}

function MomentCard({ m, meId, onLike, onComment, onDelete, onDeleteComment }) {
  const [commenting, setCommenting] = useState(false);
  const [text, setText] = useState('');
  const imgs = m.images || [];
  const cols = imgs.length === 1 ? 1 : imgs.length <= 4 ? 2 : 3;
  const imgSize = imgs.length === 1 ? 180 : 92;

  const submit = () => {
    if (!text.trim()) return;
    onComment(m, text.trim(), () => { setText(''); setCommenting(false); });
  };

  return (
    <View style={s.card}>
      <Avatar src={m.author?.avatar} name={m.author?.username} size={42} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.author}>{m.author?.username || '用户'}</Text>
          {m.user_id === meId && (
            <TouchableOpacity onPress={() => onDelete(m)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.deleteTxt}>删除</Text>
            </TouchableOpacity>
          )}
        </View>
        {!!m.content && <Text style={s.content}>{m.content}</Text>}

        {imgs.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {imgs.map((src, i) => (
              <Image key={i} source={{ uri: mediaUrl(src) }} style={{ width: imgSize, height: imgSize, borderRadius: 6, backgroundColor: C.bgInput }} />
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 8 }}>
          <Text style={s.time}>{ago(m.created_at)}</Text>
          <TouchableOpacity onPress={() => onLike(m)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={[s.action, m.liked && { color: C.green }]}>♥ {m.likeCount > 0 ? m.likeCount : '赞'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCommenting(v => !v)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={s.action}>💬 {m.commentCount > 0 ? m.commentCount : '评论'}</Text>
          </TouchableOpacity>
        </View>

        {m.likes?.length > 0 && (
          <View style={s.likeBox}>
            <Text style={s.likeTxt}><Text style={{ color: C.green }}>♥ </Text>{m.likes.map(l => l.username).join('、')}</Text>
          </View>
        )}

        {m.comments?.length > 0 && (
          <View style={s.commentBox}>
            {m.comments.map(c => (
              <View key={c.id} style={{ flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 2 }}>
                <Text style={s.commentName}>{c.username}</Text>
                {c.reply_to_user ? <Text style={s.commentReply}> 回复 {c.reply_to_user}</Text> : null}
                <Text style={s.commentTxt}>：{c.content}</Text>
                {(c.user_id === meId || m.user_id === meId) && (
                  <TouchableOpacity onPress={() => onDeleteComment(m, c)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Text style={s.commentDel}> 删</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {commenting && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            <TextInput autoFocus value={text} onChangeText={setText} placeholder="评论…" maxLength={500}
              style={s.commentInput} onSubmitEditing={submit} returnKeyType="send" />
            <TouchableOpacity onPress={submit} style={s.sendBtn}><Text style={s.sendTxt}>发送</Text></TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

export default function MomentsScreen({ navigation }) {
  const { user } = useAuth();
  const meId = user?.id;
  const insets = useSafeAreaInsets();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState('');
  const [images, setImages] = useState([]); // [{uri, type, fileName}]
  const [posting, setPosting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    axios.get('/api/moments').then(r => setList(Array.isArray(r.data) ? r.data : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('需要相册权限'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 9 - images.length,
    });
    if (!result.canceled) {
      setImages(prev => [...prev, ...result.assets.slice(0, 9 - prev.length)]);
    }
  };

  const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx));

  const resetCompose = () => { setImages([]); setText(''); setComposing(false); };

  const publish = async () => {
    if (!text.trim() && images.length === 0) return;
    setPosting(true);
    try {
      let imageUrls = [];
      if (images.length > 0) {
        const fd = new FormData();
        images.forEach(img => {
          const ext = (img.uri.split('.').pop() || 'jpg').split('?')[0].split('#')[0];
          fd.append('images', { uri: img.uri, type: img.mimeType || `image/${ext}`, name: img.fileName || `photo.${ext}` });
        });
        const { data } = await axios.post('/api/moments/images', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        imageUrls = data.urls || [];
      }
      const { data } = await axios.post('/api/moments', { content: text.trim(), images: imageUrls });
      setList(p => [data, ...p]);
      resetCompose();
    } catch (e) { Alert.alert('发布失败', e.response?.data?.error || '请重试'); }
    setPosting(false);
  };

  const onLike = async (m) => {
    try {
      const { data } = await axios.post(`/api/moments/${m.id}/like`);
      setList(p => p.map(x => {
        if (x.id !== m.id) return x;
        const likes = data.liked
          ? [...(x.likes || []), { user_id: meId, username: user?.username }]
          : (x.likes || []).filter(l => l.user_id !== meId);
        return { ...x, liked: data.liked, likeCount: data.likeCount, likes };
      }));
    } catch {}
  };

  const onComment = async (m, content, clear) => {
    try {
      const { data } = await axios.post(`/api/moments/${m.id}/comment`, { content });
      setList(p => p.map(x => x.id === m.id ? { ...x, comments: [...(x.comments || []), data], commentCount: (x.commentCount || 0) + 1 } : x));
      clear();
    } catch (e) { Alert.alert('评论失败', e.response?.data?.error || '请重试'); }
  };

  const onDelete = (m) => {
    Alert.alert('删除动态', '确认删除这条动态？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => {
        try { await axios.delete(`/api/moments/${m.id}`); setList(p => p.filter(x => x.id !== m.id)); }
        catch (e) { Alert.alert('删除失败', e.response?.data?.error || '请重试'); }
      } },
    ]);
  };

  const onDeleteComment = async (m, c) => {
    try {
      await axios.delete(`/api/moments/comments/${c.id}`);
      setList(p => p.map(x => x.id === m.id ? { ...x, comments: x.comments.filter(cc => cc.id !== c.id), commentCount: x.commentCount - 1 } : x));
    } catch (e) { Alert.alert('删除失败', e.response?.data?.error || '请重试'); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top || 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.headerBack}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>朋友圈</Text>
        <TouchableOpacity onPress={() => setComposing(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.headerPost}>＋</Text>
        </TouchableOpacity>
      </View>

      {composing && (
        <View style={s.compose}>
          <TextInput autoFocus value={text} onChangeText={setText} multiline placeholder="这一刻的想法…" maxLength={5000} style={s.composeInput} />

          {/* 已选图片预览 */}
          {images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {images.map((img, i) => (
                  <View key={i} style={s.imgThumb}>
                    <Image source={{ uri: img.uri }} style={s.imgThumbImg} />
                    <TouchableOpacity onPress={() => removeImage(i)} style={s.imgRemove}>
                      <Text style={{ color: '#fff', fontSize: 12, lineHeight: 16 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <TouchableOpacity onPress={pickImages} disabled={images.length >= 9}
              style={[s.imgPickBtn, images.length >= 9 && { opacity: 0.4 }]}>
              <Text style={s.imgPickTxt}>🖼 图片{images.length > 0 ? ` ${images.length}/9` : ''}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={resetCompose} style={s.cancelBtn}><Text style={s.cancelTxt}>取消</Text></TouchableOpacity>
            <TouchableOpacity onPress={publish} disabled={posting || (!text.trim() && images.length === 0)}
              style={[s.publishBtn, (posting || (!text.trim() && images.length === 0)) && { opacity: 0.5 }]}>
              <Text style={s.publishTxt}>{posting ? '发布中…' : '发布'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={C.green} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={m => String(m.id)}
          renderItem={({ item }) => (
            <MomentCard m={item} meId={meId} onLike={onLike} onComment={onComment} onDelete={onDelete} onDeleteComment={onDeleteComment} />
          )}
          ListEmptyComponent={<Text style={s.empty}>还没有动态，发布第一条吧</Text>}
          contentContainerStyle={list.length === 0 ? { flex: 1, justifyContent: 'center' } : { paddingBottom: 20 }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12, backgroundColor: C.bgCard, borderBottomWidth: 0.5, borderBottomColor: C.border },
  headerBack: { fontSize: 30, color: C.green, width: 40, lineHeight: 32 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: C.text },
  headerPost: { fontSize: 26, color: C.green, width: 40, textAlign: 'right', lineHeight: 30 },
  compose: { backgroundColor: C.bgCard, padding: 14, borderBottomWidth: 0.5, borderBottomColor: C.border },
  composeInput: { fontSize: 15, color: C.text, minHeight: 70, textAlignVertical: 'top', backgroundColor: C.bg, borderRadius: 10, padding: 12 },
  imgThumb: { width: 72, height: 72, borderRadius: 8, overflow: 'hidden', backgroundColor: C.bgInput },
  imgThumbImg: { width: 72, height: 72 },
  imgRemove: { position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,.55)', alignItems: 'center', justifyContent: 'center' },
  imgPickBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  imgPickTxt: { fontSize: 12, color: C.textSub },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: C.bg },
  cancelTxt: { color: C.textSub, fontSize: 13 },
  publishBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8, backgroundColor: C.green },
  publishTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  card: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: C.bgCard, borderBottomWidth: 0.5, borderBottomColor: C.border },
  author: { fontSize: 15, fontWeight: '600', color: C.blue },
  deleteTxt: { fontSize: 12, color: C.textTip },
  content: { fontSize: 15, color: C.text, marginTop: 4, lineHeight: 21 },
  time: { fontSize: 12, color: C.textTip },
  action: { fontSize: 13, color: C.textSub },
  likeBox: { marginTop: 8, padding: 8, backgroundColor: C.bg, borderRadius: 8 },
  likeTxt: { fontSize: 13, color: C.textSub },
  commentBox: { marginTop: 6, padding: 8, backgroundColor: C.bg, borderRadius: 8 },
  commentName: { fontSize: 13, color: C.blue, fontWeight: '500' },
  commentReply: { fontSize: 13, color: C.textTip },
  commentTxt: { fontSize: 13, color: C.text },
  commentDel: { fontSize: 12, color: C.textTip },
  commentInput: { flex: 1, fontSize: 14, padding: 8, borderRadius: 8, backgroundColor: C.bg, color: C.text },
  sendBtn: { paddingHorizontal: 14, justifyContent: 'center', borderRadius: 8, backgroundColor: C.green },
  sendTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  empty: { textAlign: 'center', color: C.textTip, fontSize: 14 },
});
