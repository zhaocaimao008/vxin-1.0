import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Image, Alert } from 'react-native';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';

function Avatar({ src, name, size = 42 }) {
  const colors = ['#1ABC9C','#3498DB','#9B59B6','#E67E22','#E74C3C','#07C160'];
  let hash = 0;
  for (let i = 0; i < (name||'').length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash));
  const bg = colors[Math.abs(hash) % colors.length];
  const letter = (name||'?')[0].toUpperCase();
  if (src) return <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: size * 0.22 }} />;
  return <View style={{ width: size, height: size, borderRadius: size * 0.22, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '600' }}>{letter}</Text></View>;
}

export default function DiscoverScreen() {
  const [moments, setMoments] = useState([]);
  const [content, setContent] = useState('');
  const [images, setImages] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [posting, setPosting] = useState(false);
  const { user } = useAuth();

  useEffect(() => { axios.get('/api/moments').then(r => setMoments(r.data)); }, []);

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('需要权限', '请允许访问相册');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    setImages(result.assets.slice(0, 9));
  };

  const post = async () => {
    if (!content.trim() && images.length === 0) return;
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append('content', content);
      images.forEach((img, i) => {
        fd.append('images', { uri: img.uri, type: 'image/jpeg', name: `img${i}.jpg` });
      });
      const { data } = await axios.post('/api/moments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMoments(prev => [data, ...prev]);
      setContent(''); setImages([]); setShowForm(false);
    } catch { Alert.alert('发布失败', '请重试'); }
    setPosting(false);
  };

  const deleteMoment = async (id) => {
    try {
      await axios.delete(`/api/moments/${id}`);
      setMoments(prev => prev.filter(m => m.id !== id));
    } catch { Alert.alert('删除失败'); }
  };

  const like = async (id) => {
    await axios.post(`/api/moments/${id}/like`);
    const { data: updated } = await axios.get('/api/moments');
    setMoments(updated);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>朋友圈</Text>
        <TouchableOpacity onPress={() => setShowForm(!showForm)}><Text style={styles.postBtn}>发布</Text></TouchableOpacity>
      </View>
      {showForm && (
        <View style={styles.form}>
          <TextInput style={styles.formInput} value={content} onChangeText={setContent} placeholder="分享新鲜事..." multiline />
          {images.length > 0 && (
            <ScrollView horizontal style={{ marginBottom: 8 }} showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {images.map((img, i) => (
                  <View key={i} style={{ position: 'relative' }}>
                    <Image source={{ uri: img.uri }} style={{ width: 72, height: 72, borderRadius: 6 }} />
                    <TouchableOpacity
                      style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#FA5151', borderRadius: 9, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity onPress={pickImages} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 18 }}>🖼️</Text>
              <Text style={{ fontSize: 13, color: '#888' }}>图片 ({images.length}/9)</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); setImages([]); setContent(''); }}>
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, posting && { opacity: 0.6 }]} onPress={post} disabled={posting}>
                <Text style={styles.submitText}>{posting ? '发布中...' : '发布'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      <ScrollView>
        {moments.map(m => (
          <View key={m.id} style={styles.card}>
            <Avatar src={m.avatar} name={m.username} />
            <View style={styles.cardBody}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={styles.cardUser}>{m.username}</Text>
                {m.user_id === user?.id && (
                  <TouchableOpacity onPress={() => deleteMoment(m.id)}>
                    <Text style={{ fontSize: 12, color: '#FA5151' }}>删除</Text>
                  </TouchableOpacity>
                )}
              </View>
              {m.content ? <Text style={styles.cardContent}>{m.content}</Text> : null}
              {m.images?.length > 0 && (
                <View style={styles.imgGrid}>
                  {m.images.map((img, i) => <Image key={i} source={{ uri: img }} style={styles.momentImg} />)}
                </View>
              )}
              {(m.likedUsers?.length > 0) && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 2 }}>
                  <Text style={{ fontSize: 12, color: '#07C160' }}>👍 </Text>
                  {m.likedUsers.map((u, i) => (
                    <Text key={u.id} style={{ fontSize: 12, color: '#07C160' }}>
                      {u.id === user?.id ? '你' : u.username}{i < m.likedUsers.length - 1 ? '，' : ''}
                    </Text>
                  ))}
                </View>
              )}
              <View style={styles.cardFooter}>
                <Text style={styles.cardTime}>{new Date(m.created_at*1000).toLocaleDateString('zh-CN')}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => like(m.id)}>
                    <Text style={[styles.likeBtn, m.likes.includes(user?.id) && styles.likeBtnActive]}>
                      👍 {m.likes.length > 0 ? m.likes.length : '赞'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              {m.comments?.map(c => (
                <Text key={c.id} style={styles.comment}>
                  <Text style={styles.commentUser}>{c.username}</Text>: {c.content}
                </Text>
              ))}
            </View>
          </View>
        ))}
        {moments.length === 0 && <Text style={styles.empty}>还没有朋友圈，快来发布吧</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#EDEDED', borderBottomWidth: 1, borderBottomColor: '#E5E5E5' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  postBtn: { color: '#07C160', fontWeight: '600' },
  form: { backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5E5' },
  formInput: { borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 8, padding: 10, fontSize: 14, minHeight: 70, marginBottom: 10 },
  cancelBtn: { backgroundColor: '#F0F0F0', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  cancelText: { color: '#555', fontSize: 13 },
  submitBtn: { backgroundColor: '#07C160', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  card: { flexDirection: 'row', padding: 14, backgroundColor: '#fff', marginTop: 1, gap: 12 },
  cardBody: { flex: 1 },
  cardUser: { fontWeight: '700', color: '#07C160', fontSize: 14, marginBottom: 4 },
  cardContent: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  imgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  momentImg: { width: 90, height: 90, borderRadius: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardTime: { fontSize: 11, color: '#aaa' },
  likeBtn: { fontSize: 14, color: '#888' },
  likeBtnActive: { color: '#07C160' },
  comment: { fontSize: 13, marginTop: 4, color: '#555' },
  commentUser: { fontWeight: '600', color: '#07C160' },
  empty: { textAlign: 'center', color: '#aaa', padding: 40 }
});
