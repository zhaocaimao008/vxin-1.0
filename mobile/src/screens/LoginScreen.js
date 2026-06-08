import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, accounts, switchAccount, removeAccount, maxAccounts } = useAuth();

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
      <View style={styles.glassPanel}>
        <View style={styles.logo}><Text style={styles.logoText}>v信</Text></View>
        <Text style={styles.title}>登录</Text>
        {accounts.length > 0 && (
          <View style={styles.accounts}>
            <Text style={styles.accountsTitle}>本设备账号 {accounts.length}/{maxAccounts}</Text>
            <ScrollView style={styles.accountsList} nestedScrollEnabled>
              {accounts.map(account => (
                <View key={account.id} style={styles.accountRow}>
                  <TouchableOpacity activeOpacity={0.72} style={styles.accountMain} onPress={() => switchAccount(account.id)}>
                    <Text style={styles.accountName} numberOfLines={1}>{account.user?.username || '未命名'}</Text>
                    <Text style={styles.accountSub} numberOfLines={1}>{account.user?.wechat_id ? `v信ID ${account.user.wechat_id}` : account.user?.phone}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.72} style={styles.accountRemove} onPress={() => removeAccount(account.id)}>
                    <Text style={styles.accountRemoveText}>移除</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
        <TextInput style={styles.input} placeholder="手机号" placeholderTextColor="#9A9A9A" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="密码" placeholderTextColor="#9A9A9A" value={password} onChangeText={setPassword} secureTextEntry />
        <TouchableOpacity activeOpacity={0.82} style={styles.btn} onPress={handleLogin} disabled={loading}>
          <Text style={styles.btnText}>{loading ? '登录中...' : '登录'}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.72} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.link}>还没有账号？注册</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#EDEFF2' },
  glassPanel: { width: '100%', padding: 24, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', shadowColor: '#6B7280', shadowOpacity: 0.16, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 6, alignItems: 'center' },
  logo: { width: 78, height: 78, borderRadius: 18, backgroundColor: '#07C160', alignItems: 'center', justifyContent: 'center', marginBottom: 22, shadowColor: '#07C160', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  logoText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 24, color: '#191919' },
  input: { width: '100%', backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: 'rgba(210,214,220,0.78)' },
  btn: { width: '100%', backgroundColor: '#07C160', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8, shadowColor: '#07C160', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 20, color: '#07C160', fontSize: 14 },
  accounts: { width: '100%', maxHeight: 180, marginBottom: 16, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(210,214,220,0.78)', backgroundColor: 'rgba(255,255,255,0.62)' },
  accountsTitle: { paddingHorizontal: 12, paddingVertical: 8, color: '#777', fontSize: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(210,214,220,0.7)' },
  accountsList: { maxHeight: 138 },
  accountRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(230,232,236,0.86)' },
  accountMain: { flex: 1, paddingHorizontal: 12, paddingVertical: 9 },
  accountName: { color: '#191919', fontSize: 14, fontWeight: '600' },
  accountSub: { color: '#999', fontSize: 11, marginTop: 2 },
  accountRemove: { width: 58, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: 'rgba(230,232,236,0.86)' },
  accountRemoveText: { color: '#FA5151', fontSize: 12 },
});
