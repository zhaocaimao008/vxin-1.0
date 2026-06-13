import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getServerUrl, saveServerUrl } from '../config';

const C = {
  nav: '#1A2033',
  green: '#07C160',
  greenLight: '#E8F8EE',
  bg: '#F7F8FA',
  bgCard: '#FFFFFF',
  bgInput: '#ECEEF2',
  text: '#1F2D3D',
  textSub: '#7A8694',
  textTip: '#B0BAC5',
  border: '#E8ECF0',
  red: '#FA5151',
  radius: 8,
  radiusLg: 12,
};

function AvatarLetter({ name, size = 44 }) {
  const colors = ['#1ABC9C', '#3498DB', '#9B59B6', '#E67E22', '#E74C3C', '#07C160'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash));
  const bg = colors[Math.abs(hash) % colors.length];
  const letter = (name || '?')[0].toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: C.radius,
      backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '600' }}>{letter}</Text>
    </View>
  );
}

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pwVisible, setPwVisible] = useState(false);
  const [serverUrl, setServerUrl] = useState(getServerUrl());
  const [editingServer, setEditingServer] = useState(false);
  const [serverInput, setServerInput] = useState('');
  const { login, accounts, switchAccount, removeAccount, maxAccounts } = useAuth();
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    if (!phone.trim()) return Alert.alert('提示', '请输入手机号');
    if (!password) return Alert.alert('提示', '请输入密码');
    setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', { phone: phone.trim(), password });
      await login(data.token, data.user);
    } catch (err) {
      Alert.alert('登录失败', err.response?.data?.error || '网络异常，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitch = async (accountId) => {
    const ok = await switchAccount(accountId);
    if (!ok) Alert.alert('提示', '账号信息已失效，请重新登录');
  };

  const handleRemove = (account) => {
    Alert.alert(
      '移除账号',
      `确认移除账号「${account.user?.username || account.user?.phone}」？`,
      [
        { text: '取消', style: 'cancel' },
        { text: '移除', style: 'destructive', onPress: () => removeAccount(account.id) },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.nav} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand header */}
        <View style={styles.header}>
          <View style={styles.brandIcon}>
            <Text style={styles.brandIconText}>v信</Text>
          </View>
          <Text style={styles.brandTitle}>v信</Text>
          <Text style={styles.brandSubtitle}>企业级安全通讯平台</Text>
        </View>

        {/* Login card */}
        <View style={styles.card}>
          {/* Saved accounts quick-switch */}
          {accounts.length > 0 && (
            <View style={styles.accountsSection}>
              <Text style={styles.accountsLabel}>已保存账号 {accounts.length}/{maxAccounts}</Text>
              <ScrollView style={styles.accountsList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {accounts.map(account => (
                  <View key={account.id} style={styles.accountRow}>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      style={styles.accountMain}
                      onPress={() => handleSwitch(account.id)}
                    >
                      <AvatarLetter name={account.user?.username || account.user?.phone || '?'} size={38} />
                      <View style={styles.accountInfo}>
                        <Text style={styles.accountName} numberOfLines={1}>
                          {account.user?.username || '未命名用户'}
                        </Text>
                        <Text style={styles.accountPhone} numberOfLines={1}>
                          {account.user?.wechat_id ? `v信号: ${account.user.wechat_id}` : (account.user?.phone || '')}
                        </Text>
                      </View>
                      <View style={styles.switchBadge}>
                        <Text style={styles.switchBadgeText}>切换</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      activeOpacity={0.72}
                      onPress={() => handleRemove(account)}
                    >
                      <Text style={styles.removeBtnText}>移除</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.divider} />
              <Text style={styles.orText}>— 或使用新账号登录 —</Text>
            </View>
          )}

          {/* Phone input */}
          <View style={styles.inputGroup}>
            <View style={styles.inputRow}>
              <View style={styles.inputIconBox}>
                <Text style={styles.inputIconText}>+86</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="手机号"
                placeholderTextColor={C.textTip}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={11}
                returnKeyType="next"
              />
            </View>
            <View style={[styles.inputRow, styles.inputRowLast]}>
              <View style={styles.inputIconBox}>
                <View style={styles.lockIcon}>
                  <View style={styles.lockTop} />
                  <View style={styles.lockBottom} />
                </View>
              </View>
              <TextInput
                style={styles.input}
                placeholder="密码"
                placeholderTextColor={C.textTip}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!pwVisible}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setPwVisible(v => !v)}
                activeOpacity={0.72}
              >
                <Text style={styles.eyeText}>{pwVisible ? '隐藏' : '显示'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Login button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.loginBtnText}>登录</Text>}
          </TouchableOpacity>

          {/* Register link */}
          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.72}
          >
            <Text style={styles.registerLinkText}>还没有账号？</Text>
            <Text style={[styles.registerLinkText, styles.registerLinkGreen]}>立即注册</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>v信 · 企业级安全通讯</Text>

        {/* Server URL */}
        {!editingServer ? (
          <TouchableOpacity style={styles.serverRow} onPress={() => { setServerInput(serverUrl); setEditingServer(true); }} activeOpacity={0.7}>
            <Text style={styles.serverLabel}>服务器: </Text>
            <Text style={styles.serverValue} numberOfLines={1}>{serverUrl.replace(/^https?:\/\//, '')}</Text>
            <Text style={styles.serverEdit}> [修改]</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.serverEditRow}>
            <TextInput
              style={styles.serverInput}
              value={serverInput}
              onChangeText={setServerInput}
              placeholder="https://your-server.com"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoCapitalize="none"
              keyboardType="url"
              autoFocus
            />
            <TouchableOpacity style={styles.serverSaveBtn} activeOpacity={0.8} onPress={async () => {
              const url = serverInput.trim().replace(/\/$/, '');
              if (!url.startsWith('http')) { Alert.alert('格式错误', '请以 http:// 或 https:// 开头'); return; }
              await saveServerUrl(url);
              axios.defaults.baseURL = url;
              setServerUrl(url);
              setEditingServer(false);
            }}>
              <Text style={{ color: C.green, fontWeight: '600', fontSize: 14 }}>保存</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ padding: 8 }} onPress={() => setEditingServer(false)}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>取消</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.nav,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  // Brand
  header: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 36,
  },
  brandIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: C.green,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  brandIconText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
  },
  brandTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
  },
  brandSubtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  // Card
  card: {
    width: '100%',
    backgroundColor: C.bgCard,
    borderRadius: C.radiusLg,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  // Saved accounts
  accountsSection: {
    marginBottom: 20,
  },
  accountsLabel: {
    fontSize: 12,
    color: C.textSub,
    marginBottom: 8,
  },
  accountsList: {
    maxHeight: 160,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  accountMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
  },
  accountPhone: {
    fontSize: 11,
    color: C.textSub,
    marginTop: 2,
  },
  switchBadge: {
    backgroundColor: C.greenLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  switchBadgeText: {
    fontSize: 11,
    color: C.green,
    fontWeight: '600',
  },
  removeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  removeBtnText: {
    fontSize: 12,
    color: C.red,
  },
  divider: {
    height: 0.5,
    backgroundColor: C.border,
    marginTop: 12,
    marginBottom: 8,
  },
  orText: {
    fontSize: 12,
    color: C.textTip,
    textAlign: 'center',
    marginBottom: 4,
  },
  // Inputs
  inputGroup: {
    borderRadius: C.radius,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: C.bgInput,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    backgroundColor: C.bgCard,
    minHeight: 50,
  },
  inputRowLast: {
    borderBottomWidth: 0,
  },
  inputIconBox: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputIconText: {
    fontSize: 14,
    color: C.textSub,
    fontWeight: '600',
  },
  lockIcon: {
    alignItems: 'center',
  },
  lockTop: {
    width: 12,
    height: 7,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.textSub,
    borderBottomWidth: 0,
    marginBottom: -1,
  },
  lockBottom: {
    width: 16,
    height: 11,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: C.textSub,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: C.text,
    paddingVertical: 13,
    paddingRight: 12,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  eyeText: {
    fontSize: 12,
    color: C.textSub,
  },
  // Login button
  loginBtn: {
    backgroundColor: C.green,
    borderRadius: C.radius,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: C.green,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Register
  registerLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  registerLinkText: {
    fontSize: 14,
    color: C.textSub,
  },
  registerLinkGreen: {
    color: C.green,
    fontWeight: '600',
  },
  footer: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 28,
    letterSpacing: 0.5,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 4,
  },
  serverLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  serverValue: { fontSize: 11, color: 'rgba(255,255,255,0.45)', maxWidth: 200 },
  serverEdit:  { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  serverEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  serverInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  serverSaveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(7,193,96,0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.green,
  },
});
