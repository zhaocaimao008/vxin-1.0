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
      <View style={styles.glassPanel}>
      {[['username','昵称','default'],['phone','手机号','phone-pad'],['password','密码','default']].map(([k,p,kt]) => (
        <TextInput key={k} style={styles.input} placeholder={p} placeholderTextColor="#9A9A9A" value={form[k]}
          onChangeText={v => setForm({...form,[k]:v})} keyboardType={kt} secureTextEntry={k==='password'} />
      ))}
      <TouchableOpacity activeOpacity={0.82} style={styles.btn} onPress={handleRegister} disabled={loading}>
        <Text style={styles.btnText}>{loading ? '注册中...' : '注册'}</Text>
      </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#EDEFF2', justifyContent: 'center' },
  glassPanel: { padding: 20, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', shadowColor: '#6B7280', shadowOpacity: 0.16, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  input: { backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: 'rgba(210,214,220,0.78)' },
  btn: { backgroundColor: '#07C160', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8, shadowColor: '#07C160', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});
