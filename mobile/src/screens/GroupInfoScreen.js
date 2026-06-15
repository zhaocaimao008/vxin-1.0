import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  Alert, ActivityIndicator, Image, Modal, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { mediaUrl } from '../config';
import { useAuth } from '../contexts/AuthContext';

const C = { green: '#07C160', text: '#1F2D3D', sub: '#7A8694', tip: '#B0BAC5', border: '#E8ECF0', bg: '#F7F8FA', card: '#fff', red: '#FA5151' };

function Avatar({ src, name, size = 48 }) {
  const colors = ['#1ABC9C', '#3498DB', '#9B59B6', '#E67E22', '#E74C3C', '#07C160'];
  let h = 0; for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  if (src) return <Image source={{ uri: mediaUrl(src) }} style={{ width: size, height: size, borderRadius: 8 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: 8, backgroundColor: colors[Math.abs(h) % colors.length], alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '600' }}>{(name || '?')[0].toUpperCase()}</Text>
    </View>
  );
}

export default function GroupInfoScreen({ route, navigation }) {
  const { conversationId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [editAnno, setEditAnno] = useState(false);
  const [annoVal, setAnnoVal] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [inviteSel, setInviteSel] = useState({});

  const load = useCallback(() => {
    axios.get(`/api/messages/conversation/${conversationId}/info`)
      .then(r => { setInfo(r.data); setNameVal(r.data.name || ''); setAnnoVal(r.data.announcement || ''); })
      .catch(e => Alert.alert('加载失败', e.response?.data?.error || '请重试'))
      .finally(() => setLoading(false));
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);

  const isAdmin = info && (info.myRole === 'owner' || info.myRole === 'admin');
  const isOwner = info && info.myRole === 'owner';

  const saveName = async () => {
    try { await axios.put(`/api/messages/conversation/${conversationId}`, { name: nameVal.trim() }); setEditName(false); load(); }
    catch (e) { Alert.alert('保存失败', e.response?.data?.error || '请重试'); }
  };
  const saveAnno = async () => {
    try { await axios.put(`/api/messages/conversation/${conversationId}`, { announcement: annoVal }); setEditAnno(false); load(); }
    catch (e) { Alert.alert('保存失败', e.response?.data?.error || '请重试'); }
  };

  const onMemberPress = (m) => {
    if (!isOwner || m.id === user?.id) return;
    const opts = [];
    opts.push({ text: m.role === 'admin' ? '取消管理员' : '设为管理员', onPress: () => setRole(m, m.role === 'admin' ? 'member' : 'admin') });
    opts.push({ text: '移出群聊', style: 'destructive', onPress: () => kick(m) });
    opts.push({ text: '取消', style: 'cancel' });
    Alert.alert(m.nickname || m.username, '群成员管理', opts);
  };
  const setRole = async (m, role) => {
    try { await axios.put(`/api/messages/conversation/${conversationId}/members/${m.id}/role`, { role }); load(); }
    catch (e) { Alert.alert('操作失败', e.response?.data?.error || '请重试'); }
  };
  const kick = async (m) => {
    try { await axios.delete(`/api/messages/conversation/${conversationId}/members/${m.id}`); load(); }
    catch (e) { Alert.alert('移除失败', e.response?.data?.error || '请重试'); }
  };

  const openInvite = () => {
    setInviteSel({});
    axios.get('/api/users/contacts').then(r => {
      const memberIds = new Set((info?.members || []).map(m => m.id));
      setContacts((r.data || []).filter(c => !memberIds.has(c.id)));
      setInviteOpen(true);
    }).catch(() => {});
  };
  const doInvite = async () => {
    const userIds = Object.keys(inviteSel).filter(k => inviteSel[k]);
    if (userIds.length === 0) { setInviteOpen(false); return; }
    try { await axios.post(`/api/messages/conversation/${conversationId}/invite`, { userIds }); setInviteOpen(false); load(); }
    catch (e) { Alert.alert('邀请失败', e.response?.data?.error || '请重试'); }
  };

  const leave = () => {
    Alert.alert('退出群聊', '确认退出该群聊？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: async () => {
        try { await axios.post(`/api/messages/conversation/${conversationId}/leave`); navigation.navigate('Main'); }
        catch (e) { Alert.alert('退出失败', e.response?.data?.error || '请重试'); }
      } },
    ]);
  };

  if (loading) return <View style={[s.container, s.center]}><ActivityIndicator color={C.green} size="large" /></View>;
  if (!info) return <View style={[s.container, s.center]}><Text style={{ color: C.sub }}>群信息不可用</Text></View>;

  const roleLabel = (r) => r === 'owner' ? '群主' : r === 'admin' ? '管理员' : '';

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.navbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>‹ 返回</Text></TouchableOpacity>
        <Text style={s.navTitle}>群聊信息</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView>
        {/* 成员宫格 */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>群成员 {info.members.length}</Text>
          <View style={s.memberGrid}>
            {info.members.map(m => (
              <TouchableOpacity key={m.id} style={s.memberCell} onPress={() => onMemberPress(m)} activeOpacity={isOwner && m.id !== user?.id ? 0.6 : 1}>
                <Avatar src={m.avatar} name={m.nickname || m.username} />
                <Text style={s.memberName} numberOfLines={1}>{m.nickname || m.username}</Text>
                {!!roleLabel(m.role) && <Text style={s.memberRole}>{roleLabel(m.role)}</Text>}
              </TouchableOpacity>
            ))}
            {isAdmin && (
              <TouchableOpacity style={s.memberCell} onPress={openInvite}>
                <View style={s.addBtn}><Text style={s.addBtnText}>＋</Text></View>
                <Text style={s.memberName}>邀请</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 群名称 */}
        <TouchableOpacity style={s.row} disabled={!isAdmin} onPress={() => isAdmin && setEditName(true)}>
          <Text style={s.rowLabel}>群聊名称</Text>
          <Text style={s.rowValue} numberOfLines={1}>{info.name}{isAdmin ? '  ›' : ''}</Text>
        </TouchableOpacity>

        {/* 群公告 */}
        <TouchableOpacity style={s.rowCol} disabled={!isAdmin} onPress={() => isAdmin && setEditAnno(true)}>
          <Text style={s.rowLabel}>群公告{isAdmin ? '  ›' : ''}</Text>
          <Text style={[s.annoText, !info.announcement && { color: C.tip }]}>{info.announcement || '未设置'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.leaveBtn} onPress={leave}>
          <Text style={s.leaveText}>退出群聊</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 改群名 */}
      <Modal visible={editName} transparent animationType="fade" onRequestClose={() => setEditName(false)}>
        <View style={s.dlgOverlay}>
          <View style={s.dlg}>
            <Text style={s.dlgTitle}>修改群名称</Text>
            <TextInput style={s.dlgInput} value={nameVal} onChangeText={setNameVal} maxLength={30} autoFocus />
            <View style={s.dlgBtns}>
              <TouchableOpacity onPress={() => setEditName(false)}><Text style={s.dlgCancel}>取消</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveName}><Text style={s.dlgOk}>保存</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 改公告 */}
      <Modal visible={editAnno} transparent animationType="fade" onRequestClose={() => setEditAnno(false)}>
        <View style={s.dlgOverlay}>
          <View style={s.dlg}>
            <Text style={s.dlgTitle}>编辑群公告</Text>
            <TextInput style={[s.dlgInput, { height: 90, textAlignVertical: 'top' }]} value={annoVal} onChangeText={setAnnoVal} maxLength={500} multiline autoFocus />
            <View style={s.dlgBtns}>
              <TouchableOpacity onPress={() => setEditAnno(false)}><Text style={s.dlgCancel}>取消</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveAnno}><Text style={s.dlgOk}>保存</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 邀请成员 */}
      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <View style={s.sheetOverlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.dlgTitle}>邀请成员</Text>
              <TouchableOpacity onPress={() => setInviteOpen(false)}><Text style={s.back}>✕</Text></TouchableOpacity>
            </View>
            <FlatList
              style={{ maxHeight: 360 }}
              data={contacts}
              keyExtractor={c => String(c.id)}
              ListEmptyComponent={<Text style={{ textAlign: 'center', color: C.sub, padding: 24 }}>没有可邀请的好友</Text>}
              renderItem={({ item: c }) => (
                <TouchableOpacity style={s.inviteRow} onPress={() => setInviteSel(p => ({ ...p, [c.id]: !p[c.id] }))}>
                  <View style={[s.check, inviteSel[c.id] && s.checkOn]}>{inviteSel[c.id] && <Text style={s.checkMark}>✓</Text>}</View>
                  <Avatar src={c.avatar} name={c.remark || c.username} size={40} />
                  <Text style={s.rowValue}>{c.remark || c.username}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={s.inviteBtn} onPress={doInvite}>
              <Text style={s.inviteBtnText}>确认邀请（{Object.values(inviteSel).filter(Boolean).length}）</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center:    { alignItems: 'center', justifyContent: 'center' },
  navbar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.card, borderBottomWidth: 0.5, borderBottomColor: C.border },
  back:      { fontSize: 16, color: C.green },
  navTitle:  { fontSize: 17, fontWeight: '600', color: C.text },
  section:   { backgroundColor: C.card, padding: 16, marginBottom: 10 },
  sectionLabel: { fontSize: 13, color: C.sub, marginBottom: 12 },
  memberGrid:{ flexDirection: 'row', flexWrap: 'wrap' },
  memberCell:{ width: '20%', alignItems: 'center', marginBottom: 14 },
  memberName:{ fontSize: 11, color: C.sub, marginTop: 4, maxWidth: '90%' },
  memberRole:{ fontSize: 10, color: C.green, marginTop: 1 },
  addBtn:    { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: C.tip, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addBtnText:{ fontSize: 26, color: C.tip },
  row:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 1 },
  rowCol:    { backgroundColor: C.card, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 },
  rowLabel:  { fontSize: 15, color: C.text },
  rowValue:  { fontSize: 15, color: C.sub, flex: 1, textAlign: 'right' },
  annoText:  { fontSize: 14, color: C.text, marginTop: 8, lineHeight: 20 },
  leaveBtn:  { backgroundColor: C.card, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  leaveText: { fontSize: 15, color: C.red },
  dlgOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' },
  dlg:       { width: '82%', backgroundColor: C.card, borderRadius: 12, padding: 18 },
  dlgTitle:  { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 14 },
  dlgInput:  { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: C.text, backgroundColor: C.bg },
  dlgBtns:   { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, marginTop: 16 },
  dlgCancel: { fontSize: 15, color: C.sub },
  dlgOk:     { fontSize: 15, color: C.green, fontWeight: '600' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.45)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: C.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 28 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  check:     { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#CBD2DA', alignItems: 'center', justifyContent: 'center' },
  checkOn:   { backgroundColor: C.green, borderColor: C.green },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  inviteBtn: { backgroundColor: C.green, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  inviteBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
