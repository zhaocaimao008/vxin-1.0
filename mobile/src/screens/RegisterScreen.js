import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterScreen() {
  const [form, setForm] = useState({ username: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleRegister = async () => {
    if (!form.username || !form.phone || !form.password) return Alert.alert('提示', '请填写所有字段');
    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/register', form);
      await login(data.token, data.user);
    } catch (err) {
      Alert.alert('注册失败', err.response?.data?.error || '请重试');
    } finally { setLoading(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {[['username','昵称','default'],['phone','手机号','phone-pad'],['password','密码','default']].map(([k,p,kt]) => (
        <TextInput key={k} style={styles.input} placeholder={p} value={form[k]}
          onChangeText={v => setForm({...form,[k]:v})} keyboardType={kt} secureTextEntry={k==='password'} />
      ))}
      <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
        <Text style={styles.btnText}>{loading ? '注册中...' : '注册'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#F5F5F5', justifyContent: 'center' },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: '#E5E5E5' },
  btn: { backgroundColor: '#07C160', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});
