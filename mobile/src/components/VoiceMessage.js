import React, { useState, useRef, useEffect } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';

/*
 * 语音消息气泡：点击播放/暂停（expo-av）。
 * props: url（音频地址）、duration（秒）、isMe（决定配色）
 */
export default function VoiceMessage({ url, duration = 0, isMe }) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const soundRef = useRef(null);

  // 卸载时释放音频资源
  useEffect(() => () => { soundRef.current?.unloadAsync().catch(() => {}); }, []);

  const toggle = async () => {
    try {
      if (soundRef.current) {
        const st = await soundRef.current.getStatusAsync();
        if (st.isLoaded && st.isPlaying) { await soundRef.current.pauseAsync(); setPlaying(false); return; }
        if (st.isLoaded) { await soundRef.current.playFromPositionAsync(0); setPlaying(true); return; }
      }
      if (!url) return;
      setLoading(true);
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      soundRef.current = sound;
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate(s => {
        if (s.isLoaded && s.didJustFinish) setPlaying(false);
      });
    } catch (_) {
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  };

  const color = isMe ? 'rgba(255,255,255,.9)' : '#07C160';
  // 时长越长气泡越宽（视觉提示），50-160
  const width = Math.min(160, 60 + (duration || 0) * 6);

  return (
    <TouchableOpacity style={[s.row, { width }]} onPress={toggle} activeOpacity={0.7}>
      <Text style={{ fontSize: 16, color }}>{playing ? '⏸' : '▶'}</Text>
      <View style={s.bars}>
        {[8, 14, 10, 16, 9, 13, 7].map((h, i) => (
          <View key={i} style={{ width: 3, height: h, backgroundColor: color, borderRadius: 2, opacity: playing ? 1 : 0.6 }} />
        ))}
      </View>
      <Text style={[s.dur, { color: isMe ? 'rgba(255,255,255,.9)' : '#1F2D3D' }]}>{loading ? '…' : `${duration || 0}"`}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 70 },
  bars: { flexDirection: 'row', gap: 2, alignItems: 'center', flex: 1 },
  dur:  { fontSize: 13 },
});
