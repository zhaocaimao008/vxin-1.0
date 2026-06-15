import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, ScrollView,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { mediaUrl } from '../config';

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

function AvatarDisplay({ user, size = 70 }) {
  const colors = ['#1ABC9C', '#3498DB', '#9B59B6', '#E67E22', '#E74C3C', '#07C160'];
  let hash = 0;
  const name = user?.username || '';
  for (let i = 0; i < name.length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash));
  const bg = colors[Math.abs(hash) % colors.length];
  const letter = (name || '?')[0].toUpperCase();
  if (user?.avatar) {
    return <Image source={{ uri: mediaUrl(user.avatar) }} style={{ width: size, height: size, borderRadius: C.radiusLg }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: C.radiusLg, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '700' }}>{letter}</Text>
    </View>
  );
}

function AvatarSmall({ user, size = 44 }) {
  const colors = ['#1ABC9C', '#3498DB', '#9B59B6', '#E67E22', '#E74C3C', '#07C160'];
  let hash = 0;
  const name = user?.username || '';
  for (let i = 0; i < name.length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash));
  const bg = colors[Math.abs(hash) % colors.length];
  const letter = (name || '?')[0].toUpperCase();
  if (user?.avatar) {
    return <Image source={{ uri: mediaUrl(user.avatar) }} style={{ width: size, height: size, borderRadius: C.radius }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: C.radius, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '600' }}>{letter}</Text>
    </View>
  );
}

function ChevronRight() {
  return (
    <View style={{ width: 8, height: 14, justifyContent: 'center' }}>
      <View style={{ width: 8, height: 8, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: C.textTip, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function SettingsRow({ label, value, onPress, showArrow = true, labelColor }) {
  return (
    <TouchableOpacity
      style={styles.settingsRow}
      onPress={onPress}
      activeOpacity={0.75}
      disabled={!onPress}
    >
      <Text style={[styles.settingsLabel, labelColor && { color: labelColor }]}>{label}</Text>
      {value ? <Text style={styles.settingsValue} numberOfLines={1}>{value}</Text> : null}
      {showArrow && onPress && <ChevronRight />}
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, accounts, switchAccount, removeAccount, logout, updateUser } = useAuth();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const insets = useSafeAreaInsets();

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('需要权限', '请允许访问相册');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', {
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      });
      const { data } = await axios.post('/api/users/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await updateUser({ avatar: data.avatar });
    } catch (err) {
      Alert.alert('上传失败', err.response?.data?.error || '请重试');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSwitchAccount = async (accountId) => {
    if (accountId === user?.id) return;
    const ok = await switchAccount(accountId);
    if (!ok) Alert.alert('提示', '账号信息已失效，请重新登录');
  };

  const handleRemoveAccount = (account) => {
    Alert.alert(
      '移除账号',
      `确认从本设备移除「${account.user?.username || account.user?.phone}」的登录信息？`,
      [
        { text: '取消', style: 'cancel' },
        { text: '移除', style: 'destructive', onPress: () => removeAccount(account.id) },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert(
      '退出登录',
      `确认退出「${user?.username || '当前账号'}」？`,
      [
        { text: '取消', style: 'cancel' },
        { text: '退出', style: 'destructive', onPress: logout },
      ],
    );
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero section */}
      <View style={styles.hero}>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={pickAvatar}
          style={styles.avatarWrap}
        >
          <AvatarDisplay user={user} size={70} />
          {uploadingAvatar && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color="#fff" size="small" />
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            <Text style={styles.avatarEditBadgeText}>换</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.heroInfo}>
          <Text style={styles.heroName}>{user?.username || '未命名用户'}</Text>
          <Text style={styles.heroId}>v信号: {user?.wechat_id || '未分配'}</Text>
          {user?.bio ? <Text style={styles.heroBio} numberOfLines={2}>{user.bio}</Text> : null}
        </View>
      </View>

      {/* Account switching */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>账号切换</Text>
        <View style={styles.card}>
          {accounts.map((account, idx) => {
            const isActive = account.id === user?.id;
            return (
              <View key={account.id}>
                <TouchableOpacity
                  style={styles.accountRow}
                  onPress={() => handleSwitchAccount(account.id)}
                  activeOpacity={0.75}
                >
                  <AvatarSmall user={account.user} size={44} />
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName} numberOfLines={1}>
                      {account.user?.username || '未命名'}
                    </Text>
                    <Text style={styles.accountPhone} numberOfLines={1}>
                      {account.user?.phone || ''}
                    </Text>
                  </View>
                  {isActive ? (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>当前</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.removeAccountBtn}
                      onPress={() => handleRemoveAccount(account)}
                      activeOpacity={0.72}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.removeAccountText}>移除</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                {idx < accounts.length - 1 && <View style={styles.accountDivider} />}
              </View>
            );
          })}
        </View>
        <TouchableOpacity
          style={styles.addAccountBtn}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.82}
        >
          <View style={styles.addAccountIcon}>
            <Text style={styles.addAccountIconText}>+</Text>
          </View>
          <Text style={styles.addAccountText}>添加账号</Text>
          <ChevronRight />
        </TouchableOpacity>
      </View>

      {/* Settings rows */}
      <View style={styles.section}>
        <View style={styles.card}>
          <SettingsRow label="我的收藏" onPress={() => navigation.navigate('Collections')} />
          <View style={styles.cardDivider} />
          <SettingsRow label="朋友圈" onPress={() => navigation.navigate('Moments')} />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.card}>
          <SettingsRow
            label="设置"
            onPress={() => navigation.navigate('Settings')}
          />
        </View>
      </View>

      {/* Info section */}
      <View style={styles.section}>
        <View style={styles.card}>
          <SettingsRow label="手机号" value={user?.phone || '未绑定'} showArrow={false} />
          <View style={styles.cardDivider} />
          <SettingsRow label="个性签名" value={user?.bio || '未填写'} showArrow={false} />
        </View>
      </View>

      {/* Logout */}
      <View style={[styles.section, { marginBottom: 40 + insets.bottom }]}>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.82}
        >
          <Text style={styles.logoutText}>退出当前账号</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  // Hero
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarOverlay: {
    position: 'absolute',
    inset: 0,
    borderRadius: C.radiusLg,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.bgCard,
  },
  avatarEditBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    marginBottom: 3,
  },
  heroId: {
    fontSize: 13,
    color: C.textSub,
    marginBottom: 3,
  },
  heroBio: {
    fontSize: 13,
    color: C.textTip,
    lineHeight: 18,
  },
  // Sections
  section: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 12,
    color: C.textSub,
    fontWeight: '600',
    marginBottom: 8,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: C.bgCard,
    borderRadius: C.radiusLg,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: C.border,
  },
  cardDivider: {
    height: 0.5,
    backgroundColor: C.border,
    marginLeft: 16,
  },
  // Account rows
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  accountDivider: {
    height: 0.5,
    backgroundColor: C.border,
    marginLeft: 72,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
  },
  accountPhone: {
    fontSize: 12,
    color: C.textSub,
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: C.greenLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeBadgeText: {
    fontSize: 11,
    color: C.green,
    fontWeight: '700',
  },
  removeAccountBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeAccountText: {
    fontSize: 13,
    color: C.red,
  },
  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderRadius: C.radiusLg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
    gap: 12,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  addAccountIcon: {
    width: 36,
    height: 36,
    borderRadius: C.radius,
    backgroundColor: C.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
  },
  addAccountIconText: {
    fontSize: 22,
    color: C.textSub,
    fontWeight: '300',
    lineHeight: 26,
  },
  addAccountText: {
    flex: 1,
    fontSize: 15,
    color: C.text,
    fontWeight: '500',
  },
  // Settings row
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  settingsLabel: {
    flex: 1,
    fontSize: 15,
    color: C.text,
    fontWeight: '400',
  },
  settingsValue: {
    fontSize: 14,
    color: C.textSub,
    maxWidth: 160,
  },
  // Logout
  logoutBtn: {
    backgroundColor: C.bgCard,
    borderRadius: C.radiusLg,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: C.border,
  },
  logoutText: {
    fontSize: 16,
    color: C.red,
    fontWeight: '500',
  },
});
