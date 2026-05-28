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
  const [showForm, setShowForm] = useState(false);
  const { user } = useAuth();

  useEffect(() => { axios.get('/api/moments').then(r => setMoments(r.data)); }, []);

  const post = async () => {
    if (!content.trim()) return;
    const fd = new FormData();
    fd.append('content', content);
    const { data } = await axios.post('/api/moments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    setMoments(prev => [data, ...prev]);
    setContent(''); setShowForm(false);
  };

  const like = async (id) => {
    const { data } = await axios.post(`/api/moments/${id}/like`);
    setMoments(prev => prev.map(m => m.id === id ? { ...m, likes: data.likes } : m));
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>朋友圈</Text>
        <TouchableOpacity onPress={() => setShowForm(!showForm)}><Text style={styles.postBtn}>发布</Text></TouchableOpacity>
      </View>
      {showForm && (
        <View style={styles.form}>
          <TextInput style={styles.formInput} value={content} onChangeText={setContent} placeholder="分享新鲜事..." multiline rows={3} />
          <TouchableOpacity style={styles.submitBtn} onPress={post}><Text style={styles.submitText}>发布</Text></TouchableOpacity>
        </View>
      )}
      <ScrollView>
        {moments.map(m => (
          <View key={m.id} style={styles.card}>
            <Avatar src={m.avatar} name={m.username} />
            <View style={styles.cardBody}>
              <Text style={styles.cardUser}>{m.username}</Text>
              {m.content ? <Text style={styles.cardContent}>{m.content}</Text> : null}
              {m.images?.length > 0 && (
                <View style={styles.imgGrid}>
                  {m.images.map((img, i) => <Image key={i} source={{ uri: img }} style={styles.momentImg} />)}
                </View>
              )}
              <View style={styles.cardFooter}>
                <Text style={styles.cardTime}>{new Date(m.created_at*1000).toLocaleDateString('zh-CN')}</Text>
                <TouchableOpacity onPress={() => like(m.id)}>
                  <Text style={[styles.likeBtn, m.likes.includes(user.id) && styles.likeBtnActive]}>
                    👍 {m.likes.length || ''}
                  </Text>
                </TouchableOpacity>
              </View>
              {m.comments?.map(c => <Text key={c.id} style={styles.comment}><Text style={styles.commentUser}>{c.username}</Text>: {c.content}</Text>)}
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
  formInput: { borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 8, padding: 10, fontSize: 14, minHeight: 70 },
  submitBtn: { backgroundColor: '#07C160', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 8 },
  submitText: { color: '#fff', fontWeight: '600' },
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
