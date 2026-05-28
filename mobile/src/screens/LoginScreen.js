import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!phone || !password) return Alert.alert('提示', '请填写手机号和密码');
    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', { phone, password });
      await login(data.token, data.user);
    } catch (err) {
      Alert.alert('登录失败', err.response?.data?.error || '请重试');
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.logo}><Text style={styles.logoText}>v信</Text></View>
      <Text style={styles.title}>登录</Text>
      <TextInput style={styles.input} placeholder="手机号" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <TextInput style={styles.input} placeholder="密码" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
        <Text style={styles.btnText}>{loading ? '登录中...' : '登录'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>还没有账号？注册</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F5F5F5' },
  logo: { width: 80, height: 80, borderRadius: 20, backgroundColor: '#07C160', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  logoText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 24, color: '#191919' },
  input: { width: '100%', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: '#E5E5E5' },
  btn: { width: '100%', backgroundColor: '#07C160', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 20, color: '#07C160', fontSize: 14 }
});
