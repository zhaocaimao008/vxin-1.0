import React, { useEffect, useState } from 'react';
import { Alert, View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Switch, TextInput, Modal } from 'react-native';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { getServerUrl, saveServerUrl, mediaUrl } from '../config';

export default function SettingsScreen() {
  const { user, token, logout, changeServer, updateUser } = useAuth();
  const [page, setPage] = useState('main');
  const [editField, setEditField] = useState(null); // { key:'username'|'bio', label, value }
  const [savingProfile, setSavingProfile] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [settings, setSettings] = useState({
    addByVxinId: true,
    addByPhone: true,
    requireVerify: true,
    profileVisible: true,
    blockUnknownMessages: false,
    messageNotify: true,
    detailPreview: true,
    sound: true,
    vibrate: false,
  });
  const qrSource = {
    uri: `${getServerUrl()}/api/users/me/qrcode`,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,  // RN Image 支持 headers，QR 鉴权 OK
  };
  useEffect(() => {
    let alive = true;
    axios.get('/api/users/me/settings')
      .then(({ data }) => { if (alive) setSettings(prev => ({ ...prev, ...data })); })
      .finally(() => { if (alive) setLoadingSettings(false); });
    return () => { alive = false; };
  }, []);

  const setFlag = async (key, value) => {
    const previous = settings[key];
    setSettings(prev => ({ ...prev, [key]: value }));
    try {
      const { data } = await axios.put('/api/users/me/settings', { [key]: value });
      setSettings(prev => ({ ...prev, ...data }));
    } catch {
      setSettings(prev => ({ ...prev, [key]: previous }));
    }
  };

  const saveProfileField = async () => {
    if (!editField) return;
    const val = (editField.value || '').trim();
    if (editField.key === 'username' && !val) { Alert.alert('提示', '昵称不能为空'); return; }
    setSavingProfile(true);
    try {
      const { data } = await axios.put('/api/users/profile', { [editField.key]: val });
      await updateUser(data);
      setEditField(null);
    } catch (e) {
      Alert.alert('保存失败', e.response?.data?.error || '请重试');
    } finally {
      setSavingProfile(false);
    }
  };

  const clearAllMessages = () => {
    Alert.alert(
      '双向删除所有聊天记录',
      '你参与的所有会话成员都将看不到这些记录，确认继续？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data } = await axios.delete('/api/messages/conversations/messages');
              Alert.alert('完成', `已双向删除 ${data.deleted || 0} 条聊天记录`);
            } catch (err) {
              Alert.alert('失败', err.response?.data?.error || '清理失败');
            }
          },
        },
      ],
    );
  };
  const [serverInput, setServerInput] = useState(getServerUrl());
  const titleMap = {
    main: '设置',
    profile: '个人资料',
    account: '账户安全',
    permissions: '朋友权限',
    cleanup: '聊天记录清理',
    notifications: '消息通知',
    server: '服务器地址',
  };
  const title = titleMap[page] || '设置';

  const Toggle = ({ value, onValueChange }) => (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: 'rgba(120,120,128,0.24)', true: '#07C160' }}
      thumbColor="#fff"
    />
  );

  const Row = ({ label, desc, value, onPress, right, danger }) => (
    <TouchableOpacity activeOpacity={onPress ? 0.72 : 1} style={styles.row} onPress={onPress}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && styles.danger]}>{label}</Text>
        {!!desc && <Text style={styles.rowDesc}>{desc}</Text>}
      </View>
      {!!value && <Text style={styles.value} numberOfLines={1}>{value}</Text>}
      {right || (onPress ? <Text style={styles.arrow}>›</Text> : null)}
    </TouchableOpacity>
  );

  const Section = ({ children }) => <View style={styles.card}>{children}</View>;

  if (page !== 'main') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity activeOpacity={0.72} onPress={() => setPage('main')}><Text style={styles.back}>‹ 返回</Text></TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 48 }} />
        </View>

        {page === 'profile' && (
          <>
            <Section>
              <View style={styles.profile}>
                {user?.avatar ? (
                  <Image source={{ uri: mediaUrl(user.avatar) }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>{(user?.username || '?')[0].toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.profileText}>
                  <Text style={styles.name}>{user?.username || '未命名'}</Text>
                  <Text style={styles.subText}>v信ID: {user?.wechat_id || '未分配'}</Text>
                </View>
              </View>
              <Row label="昵称" value={user?.username || '-'} onPress={() => setEditField({ key: 'username', label: '昵称', value: user?.username || '' })} />
              <Row label="v信ID" value={user?.wechat_id || '未分配'} />
              <Row label="签名" value={user?.bio || '未填写'} onPress={() => setEditField({ key: 'bio', label: '个性签名', value: user?.bio || '' })} />
              <Row label="手机号" value={user?.phone || '-'} />
            </Section>
            <View style={styles.qrCard}>
              <Text style={styles.qrTitle}>我的二维码</Text>
              <Image source={qrSource} style={styles.qr} />
              <Text style={styles.qrHint}>扫码可识别此账号</Text>
            </View>
          </>
        )}

        {page === 'account' && (
          <>
            <Section>
              <Row label="v信ID" value={user?.wechat_id || '未分配'} />
              <Row label="手机号" value={user?.phone || '-'} />
              <Row label="登录密码" desc="建议定期更换密码" onPress={() => {}} />
            </Section>
            <Section>
              <Row label="登录设备管理" desc="查看当前账号登录过的设备" onPress={() => {}} />
              <Row label="账号保护" desc="异常登录提醒和安全验证" onPress={() => {}} />
            </Section>
          </>
        )}

        {page === 'permissions' && (
          <>
            <Section>
              <Row label="加我为朋友时需要验证" desc="关闭后，对方可直接添加你为好友" right={<Toggle value={settings.requireVerify} onValueChange={v => setFlag('requireVerify', v)} />} />
              <Row label="通过 v信ID 找到我" desc={`当前 v信ID ${user?.wechat_id || '-'}`} right={<Toggle value={settings.addByVxinId} onValueChange={v => setFlag('addByVxinId', v)} />} />
              <Row label="通过手机号找到我" desc={user?.phone || ''} right={<Toggle value={settings.addByPhone} onValueChange={v => setFlag('addByPhone', v)} />} />
            </Section>
            <Section>
              <Row label="允许陌生人查看资料" desc="关闭后，非好友只能看到昵称和头像" right={<Toggle value={settings.profileVisible} onValueChange={v => setFlag('profileVisible', v)} />} />
              <Row label="屏蔽陌生人消息" desc="非好友消息将不进入会话列表" right={<Toggle value={settings.blockUnknownMessages} onValueChange={v => setFlag('blockUnknownMessages', v)} />} />
            </Section>
            <Section>
              <Row label="黑名单" desc="管理已拉黑的用户" onPress={() => {}} />
              <Row label="个人信息收集清单" desc="查看账号资料与设备信息使用情况" onPress={() => {}} />
            </Section>
          </>
        )}

        {page === 'cleanup' && (
          <>
            <Section>
              <Row label="清理图片、视频和文件缓存" desc="仅清理本机缓存，不影响聊天消息" onPress={() => {}} />
              <Row label="按会话清理聊天记录" desc="进入聊天后可对单条消息撤回或删除" onPress={() => {}} />
            </Section>
            <Section>
              <Row label="双向删除所有聊天记录" desc="你参与的所有会话成员都将看不到这些记录" danger onPress={clearAllMessages} />
            </Section>
          </>
        )}

        {page === 'notifications' && (
          <>
            <Section>
              <Row label="接收新消息通知" right={<Toggle value={settings.messageNotify} onValueChange={v => setFlag('messageNotify', v)} />} />
              <Row label="通知显示消息详情" desc="关闭后通知只显示“收到一条新消息”" right={<Toggle value={settings.detailPreview} onValueChange={v => setFlag('detailPreview', v)} />} />
              <Row label="声音" right={<Toggle value={settings.sound} onValueChange={v => setFlag('sound', v)} />} />
              <Row label="震动" right={<Toggle value={settings.vibrate} onValueChange={v => setFlag('vibrate', v)} />} />
            </Section>
            <Section>
              <Row label="免打扰会话" desc="管理已静音的聊天" onPress={() => {}} />
            </Section>
          </>
        )}

        {page === 'server' && (
          <>
            <Section>
              <View style={{ padding: 14 }}>
                <Text style={{ fontSize: 13, color: '#7A8694', marginBottom: 8 }}>输入新服务器地址（以 https:// 开头）</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: '#E8ECF0', borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: '#F7F8FA' }}
                  value={serverInput}
                  onChangeText={setServerInput}
                  placeholder="https://dipsin.com"
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
              <Row label="恢复默认服务器" onPress={() => setServerInput('https://dipsin.com')} />
            </Section>
            <TouchableOpacity
              style={{ margin: 16, backgroundColor: '#07C160', borderRadius: 10, padding: 14, alignItems: 'center' }}
              onPress={async () => {
                const url = serverInput.trim().replace(/\/$/, '');
                if (!url.startsWith('http')) { Alert.alert('格式错误', '请以 http:// 或 https:// 开头'); return; }
                Alert.alert('切换服务器', `将切换到 ${url}\n\n当前账号会自动退出，需要重新登录新服务器的账号。`, [
                  { text: '取消', style: 'cancel' },
                  { text: '确认切换', style: 'destructive', onPress: () => changeServer(url) },
                ]);
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>保存</Text>
            </TouchableOpacity>
          </>
        )}

        {/* 编辑昵称/签名 */}
        <Modal visible={!!editField} transparent animationType="fade" onRequestClose={() => setEditField(null)}>
          <View style={styles.editOverlay}>
            <View style={styles.editDialog}>
              <Text style={styles.editTitle}>修改{editField?.label}</Text>
              <TextInput
                style={[styles.editInput, editField?.key === 'bio' && { height: 80, textAlignVertical: 'top' }]}
                value={editField?.value}
                onChangeText={t => setEditField(f => ({ ...f, value: t }))}
                placeholder={`请输入${editField?.label || ''}`}
                maxLength={editField?.key === 'bio' ? 100 : 20}
                multiline={editField?.key === 'bio'}
                autoFocus
              />
              <View style={styles.editBtns}>
                <TouchableOpacity onPress={() => setEditField(null)} disabled={savingProfile}><Text style={styles.editCancel}>取消</Text></TouchableOpacity>
                <TouchableOpacity onPress={saveProfileField} disabled={savingProfile}><Text style={styles.editOk}>{savingProfile ? '保存中…' : '保存'}</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={{ width: 48 }} />
        <Text style={styles.headerTitle}>设置</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.profile}>
        {user?.avatar ? (
          <Image source={{ uri: mediaUrl(user.avatar) }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{(user?.username || '?')[0].toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.profileText}>
          <Text style={styles.name}>{user?.username || '未命名'}</Text>
          <Text style={styles.subText}>v信号: {user?.wechat_id || '未分配'}</Text>
        </View>
      </View>

      <Section>
        <Row label="个人资料" desc="昵称、v信ID、签名、手机号、二维码" onPress={() => setPage('profile')} />
        <Row label="账户安全" desc={`手机号 ${user?.phone || '-'}`} onPress={() => setPage('account')} />
      </Section>

      <Section>
        <Row label="朋友权限" desc={loadingSettings ? '正在同步设置...' : '添加方式、资料可见范围和黑名单'} onPress={() => setPage('permissions')} />
        <Row label="消息通知" desc="新消息提醒、声音和内容预览" onPress={() => setPage('notifications')} />
        <Row label="聊天记录清理" desc="按会话清理或清空缓存" onPress={() => setPage('cleanup')} />
      </Section>

      <Section>
        <Row
          label="服务器地址"
          desc={getServerUrl().replace(/^https?:\/\//, '')}
          onPress={() => {
            Alert.alert('修改服务器地址', '重启 App 后生效', [
              { text: '取消', style: 'cancel' },
              { text: '恢复默认', onPress: () => changeServer('https://dipsin.com') },
              { text: '手动输入', onPress: () => setPage('server') },
            ]);
          }}
        />
      </Section>

      <TouchableOpacity activeOpacity={0.72} style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EDEFF2' },
  content: { paddingBottom: 24 },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.68)', borderBottomWidth: 1, borderBottomColor: 'rgba(230,232,236,0.86)' },
  headerTitle: { fontSize: 17, color: '#191919', fontWeight: '600' },
  back: { color: '#07C160', fontSize: 15 },
  profile: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.78)', padding: 20, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.9)' },
  avatar: { width: 64, height: 64, borderRadius: 14, shadowColor: '#6B7280', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  avatarFallback: { width: 64, height: 64, borderRadius: 14, backgroundColor: '#07C160', alignItems: 'center', justifyContent: 'center', shadowColor: '#07C160', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  profileText: { flex: 1, marginLeft: 14 },
  name: { fontSize: 19, color: '#191919', fontWeight: '700', marginBottom: 6 },
  subText: { color: '#777', fontSize: 14 },
  card: { backgroundColor: 'rgba(255,255,255,0.78)', margin: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)', overflow: 'hidden' },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(230,232,236,0.88)' },
  rowText: { flex: 1, paddingRight: 12 },
  rowLabel: { color: '#191919', fontSize: 15 },
  rowDesc: { color: '#999', fontSize: 12, marginTop: 3, lineHeight: 16 },
  arrow: { color: '#B0B0B0', fontSize: 24, lineHeight: 24 },
  danger: { color: '#e74c3c' },
  label: { width: 86, color: '#888', fontSize: 14 },
  value: { flex: 1, color: '#222', fontSize: 14, textAlign: 'right' },
  qrCard: { backgroundColor: 'rgba(255,255,255,0.78)', alignItems: 'center', paddingVertical: 22, margin: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)', shadowColor: '#6B7280', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  qrTitle: { fontSize: 16, color: '#191919', fontWeight: '600', marginBottom: 16 },
  qr: { width: 220, height: 220, backgroundColor: '#F7F7F7', borderRadius: 12 },
  qrHint: { color: '#999', fontSize: 13, marginTop: 12 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.78)', margin: 8, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)' },
  logoutText: { color: '#e74c3c', fontSize: 16, fontWeight: '600' },
  editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' },
  editDialog: { width: '82%', backgroundColor: '#fff', borderRadius: 12, padding: 18 },
  editTitle: { fontSize: 16, fontWeight: '700', color: '#1F2D3D', marginBottom: 14 },
  editInput: { borderWidth: 1, borderColor: '#E8ECF0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: '#1F2D3D', backgroundColor: '#F7F8FA' },
  editBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, marginTop: 16 },
  editCancel: { fontSize: 15, color: '#7A8694' },
  editOk: { fontSize: 15, color: '#07C160', fontWeight: '600' },
});
