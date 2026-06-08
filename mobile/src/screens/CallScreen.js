import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal,
} from 'react-native';

export default function CallScreen({ socket, user, call, onClose }) {
  const { type, direction, remoteUser, remoteId } = call;
  const [status, setStatus] = useState(direction === 'incoming' ? 'incoming' : 'calling');
  const [duration, setDuration] = useState(0);

  const displayName = remoteUser?.name || remoteUser?.username || remoteId?.slice(0, 8) || '对方';

  useEffect(() => {
    if (direction === 'outgoing') {
      // Stub: auto-end after 3 seconds
      const timer = setTimeout(() => onClose?.(), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptCall = () => {
    setStatus('connected');
    socket?.emit('call:response', { to: remoteId, accepted: true });
  };

  const rejectCall = () => {
    socket?.emit('call:response', { to: remoteId, accepted: false });
    onClose?.();
  };

  useEffect(() => {
    if (status !== 'connected') return;
    const interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{displayName ? displayName[0] : '?'}</Text>
        </View>
        <Text style={styles.nameText}>{displayName}</Text>
        <Text style={styles.statusText}>
          {status === 'incoming' ? '来电...' :
           status === 'calling' ? '正在呼叫...' :
           status === 'connected' ? formatTime(duration) :
           '通话结束'}
        </Text>

        <View style={styles.actionSection}>
          {status === 'incoming' ? (
            <View style={styles.incomingActions}>
              <TouchableOpacity style={styles.rejectBtn} onPress={rejectCall}>
                <Text style={styles.actionIcon}>📞</Text>
                <Text style={styles.actionLabel}>拒绝</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptBtn} onPress={acceptCall}>
                <Text style={styles.actionIcon}>📞</Text>
                <Text style={[styles.actionLabel, { color: '#fff' }]}>接听</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.hangupBtn} onPress={onClose}>
              <Text style={[styles.actionIcon, { color: '#fff' }]}>📞</Text>
              <Text style={[styles.actionLabel, { color: '#fff' }]}>挂断</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  avatarCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#07C160',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  avatarText: { color: '#fff', fontSize: 42, fontWeight: '700' },
  nameText: { color: '#fff', fontSize: 22, fontWeight: '600', marginBottom: 8 },
  statusText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 40 },
  actionSection: { alignItems: 'center' },
  incomingActions: { flexDirection: 'row', gap: 60 },
  rejectBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#ff4d4f', alignItems: 'center', justifyContent: 'center',
  },
  acceptBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#07C160', alignItems: 'center', justifyContent: 'center',
  },
  hangupBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#ff4d4f', alignItems: 'center', justifyContent: 'center',
  },
  actionIcon: { fontSize: 22 },
  actionLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
});
