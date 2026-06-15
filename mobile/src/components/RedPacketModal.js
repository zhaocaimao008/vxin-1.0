import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert, ActivityIndicator } from 'react-native';
import axios from 'axios';

const C = {
  green: '#07C160', red: '#FA5151', text: '#1F2D3D', textSub: '#7A8694',
  bgCard: '#FFFFFF', bgInput: '#ECEEF2', border: '#E8ECF0', bg: '#F7F8FA',
};

export default function RedPacketModal({ visible, conversation, onClose, onSent }) {
  const [amount, setAmount] = useState('');
  const [count, setCount] = useState('');
  const [greeting, setGreeting] = useState('恭喜发财，大吉大利！');
  const [sending, setSending] = useState(false);

  const amountNum = parseFloat(amount) || 0;
  const countNum = parseInt(count) || 0;
  const perPerson = countNum > 0 ? (amountNum / countNum).toFixed(2) : 0;
  const canSend = amountNum >= countNum && amountNum > 0 && countNum > 0 && amountNum <= 20000 && countNum <= 100;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const { data } = await axios.post('/api/redpackets/send', {
        conversationId: conversation.id,
        totalAmount: amountNum,
        totalCount: countNum,
        greeting,
      });
      onSent?.();
      onClose();
      setAmount('');
      setCount('');
      setGreeting('恭喜发财，大吉大利！');
    } catch (e) {
      Alert.alert('发送失败', e.response?.data?.error || '请重试');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.container}>
          <Text style={s.title}>发红包</Text>

          <View style={s.inputGroup}>
            <Text style={s.label}>红包金币总额 (1-20000)</Text>
            <TextInput
              style={s.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="输入金币数"
              keyboardType="decimal-pad"
              editable={!sending}
            />
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>红包个数 (1-100)</Text>
            <TextInput
              style={s.input}
              value={count}
              onChangeText={setCount}
              placeholder="输入红包个数"
              keyboardType="number-pad"
              editable={!sending}
            />
          </View>

          {countNum > 0 && amountNum > 0 && (
            <View style={[s.preview, amountNum < countNum && { borderColor: C.red }]}>
              <Text style={s.previewLabel}>平均每个</Text>
              <Text style={s.previewAmount}>{perPerson} 金币</Text>
              {amountNum < countNum && <Text style={s.warning}>⚠ 总金币不能少于红包个数</Text>}
            </View>
          )}

          <View style={s.inputGroup}>
            <Text style={s.label}>祝福语 (可选)</Text>
            <TextInput
              style={[s.input, { height: 60, textAlignVertical: 'top' }]}
              value={greeting}
              onChangeText={setGreeting}
              placeholder="例如：恭喜发财，大吉大利！"
              maxLength={100}
              multiline
              editable={!sending}
            />
            <Text style={s.counter}>{greeting.length}/100</Text>
          </View>

          <View style={s.actions}>
            <TouchableOpacity
              style={[s.btn, s.cancelBtn]}
              onPress={onClose}
              disabled={sending}
              activeOpacity={0.75}
            >
              <Text style={s.cancelTxt}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, canSend && !sending ? s.sendBtn : s.sendBtnDisabled]}
              onPress={send}
              disabled={!canSend || sending}
              activeOpacity={0.75}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.sendTxt}>{canSend ? '确认发送' : '请填写完整'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' },
  container: { width: '85%', backgroundColor: C.bgCard, borderRadius: 14, padding: 20 },
  title: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 18 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 },
  input: { padding: 10, fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 8, backgroundColor: C.bgInput, color: C.text },
  preview: { padding: 12, backgroundColor: '#E8F8EE', borderRadius: 8, marginBottom: 14, borderWidth: 1, borderColor: C.green },
  previewLabel: { fontSize: 12, color: C.textSub, marginBottom: 4 },
  previewAmount: { fontSize: 16, fontWeight: '700', color: C.green },
  warning: { fontSize: 12, color: C.red, marginTop: 4 },
  counter: { fontSize: 11, color: C.textSub, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 18 },
  btn: { borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  cancelTxt: { fontSize: 14, fontWeight: '600', color: C.textSub },
  sendBtn: { backgroundColor: C.green },
  sendBtnDisabled: { backgroundColor: 'rgba(7,193,96,.4)' },
  sendTxt: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
