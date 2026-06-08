import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, Image, ScrollView } from 'react-native';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';

export default function ProfileScreen({ navigation }) {
  const { user, updateUser, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ username: user?.username || '', bio: user?.bio || '' });

  const save = async () => {
    try {
      const { data } = await axios.put('/api/users/profile', form);
      await updateUser(data);
      setEditing(false);
    } catch (err) { Alert.alert('失败', err.response?.data?.error || '请重试'); }
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('需要权限', '请允许访问相册');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled) return;
    const fd = new FormData();
    fd.append('avatar', { uri: result.assets[0].uri, type: 'image/jpeg', name: 'avatar.jpg' });
    const { data } = await axios.post('/api/users/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    await updateUser({ avatar: data.avatar });
  };

  const Avatar = () => {
    const colors = ['#1ABC9C','#3498DB','#9B59B6','#E67E22','#E74C3C','#07C160'];
    let hash = 0; for (let i = 0; i < (user?.username||'').length; i++) hash = (user.username.charCodeAt(i) + ((hash << 5) - hash));
    const bg = colors[Math.abs(hash) % colors.length];
    const letter = (user?.username||'?')[0].toUpperCase();
    if (user?.avatar) return <Image source={{ uri: user.avatar }} style={styles.avatar} />;
    return <View style={[styles.avatar, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: '#fff', fontSize: 32, fontWeight: '700' }}>{letter}</Text></View>;
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity activeOpacity={0.78} style={styles.avatarSection} onPress={pickAvatar}>
        <Avatar />
        <Text style={styles.changeAvatar}>点击更换头像</Text>
      </TouchableOpacity>
      <View style={styles.card}>
        {editing ? (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>昵称</Text>
              <TextInput style={styles.input} value={form.username} onChangeText={v => setForm({...form,username:v})} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>个性签名</Text>
              <TextInput style={styles.input} value={form.bio} onChangeText={v => setForm({...form,bio:v})} placeholder="填写签名" />
            </View>
            <View style={styles.btns}>
              <TouchableOpacity activeOpacity={0.72} style={styles.cancelBtn} onPress={() => setEditing(false)}><Text style={styles.cancelText}>取消</Text></TouchableOpacity>
              <TouchableOpacity activeOpacity={0.82} style={styles.saveBtn} onPress={save}><Text style={styles.saveText}>保存</Text></TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>昵称</Text><Text style={styles.infoValue}>{user?.username}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>v信号</Text><Text style={styles.infoValue}>{user?.wechat_id || '未分配'}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>签名</Text><Text style={styles.infoValue}>{user?.bio || '未填写'}</Text></View>
            <View style={styles.infoRow}><Text style={styles.infoLabel}>手机号</Text><Text style={styles.infoValue}>{user?.phone}</Text></View>
            <TouchableOpacity activeOpacity={0.72} style={styles.editBtn} onPress={() => setEditing(true)}><Text style={styles.editBtnText}>编辑资料</Text></TouchableOpacity>
          </>
        )}
      </View>
      <TouchableOpacity activeOpacity={0.72} style={styles.settingBtn} onPress={() => navigation.navigate('Settings')}>
        <Text style={styles.settingText}>设置</Text>
        <Text style={styles.settingArrow}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.72} style={styles.logoutBtn} onPress={logout}><Text style={styles.logoutText}>退出登录</Text></TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EDEFF2' },
  avatarSection: { alignItems: 'center', padding: 30, backgroundColor: 'rgba(255,255,255,0.76)', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.9)' },
  avatar: { width: 80, height: 80, borderRadius: 18, marginBottom: 8, shadowColor: '#6B7280', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  changeAvatar: { fontSize: 12, color: '#aaa' },
  card: { backgroundColor: 'rgba(255,255,255,0.78)', borderRadius: 12, margin: 8, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)', shadowColor: '#6B7280', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  field: { marginBottom: 14 },
  label: { fontSize: 12, color: '#888', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: 'rgba(210,214,220,0.82)', borderRadius: 10, padding: 10, fontSize: 15, backgroundColor: 'rgba(255,255,255,0.78)' },
  btns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.76)', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(220,224,230,0.9)' },
  cancelText: { color: '#555', fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: '#07C160', borderRadius: 10, padding: 12, alignItems: 'center', shadowColor: '#07C160', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  saveText: { color: '#fff', fontWeight: '600' },
  infoRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  infoLabel: { width: 72, color: '#888', fontSize: 14 },
  infoValue: { flex: 1, fontSize: 14 },
  editBtn: { backgroundColor: 'rgba(255,255,255,0.76)', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: 'rgba(220,224,230,0.9)' },
  editBtnText: { color: '#333', fontWeight: '500' },
  settingBtn: { backgroundColor: 'rgba(255,255,255,0.78)', margin: 8, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)' },
  settingText: { flex: 1, color: '#191919', fontSize: 16, fontWeight: '500' },
  settingArrow: { color: '#B0B0B0', fontSize: 24, lineHeight: 24 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.78)', margin: 8, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)' },
  logoutText: { color: '#e74c3c', fontSize: 16, fontWeight: '500' }
});
