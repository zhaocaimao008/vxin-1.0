import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import {
  RTCPeerConnection, RTCSessionDescription, RTCIceCandidate,
  mediaDevices, MediaStream, RTCView,
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80',                 username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443',                username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp',  username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};
const CALL_TIMEOUT_MS = 30000;

/*
 * 信令状态机（与 Web CallModal 完全一致）：
 *   发起方 outgoing:  calling →（对方接受）→ createOffer → connected
 *   接听方 incoming:  incoming →（接受）→ connecting →（收 offer，回 answer）→ connected
 * 关键：发起方收到 call:response(accepted) 后才创建并发送 offer，消除竞态；
 * pendingOfferRef 缓冲极端网络下提前到达的 offer。
 */
export default function CallScreen({ socket, user, call, onClose }) {
  const { type, direction, remoteUser, remoteId } = call;
  const isVideo = type === 'video';

  const [status, setStatus]       = useState(direction === 'incoming' ? 'incoming' : 'calling');
  const [muted, setMuted]         = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [endReason, setEndReason] = useState('');
  const [duration, setDuration]   = useState(0);
  const [localUrl, setLocalUrl]   = useState(null);
  const [remoteUrl, setRemoteUrl] = useState(null);

  const pcRef           = useRef(null);
  const localStreamRef  = useRef(null);
  const pendingOfferRef = useRef(null);
  const timeoutRef      = useRef(null);
  const statusRef       = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  const displayName = remoteUser?.name || remoteUser?.username || remoteId?.slice(0, 8) || '对方';

  // ── 清理资源 ────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    clearTimeout(timeoutRef.current);
    try { InCallManager.stop(); } catch (_) {}
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    localStreamRef.current = null;
  }, []);

  const endCall = useCallback((notify, reason = '') => {
    if (notify) socket?.emit('call:end', { to: remoteId, reason });
    cleanup();
    if (reason) setEndReason(reason);
    setStatus('ended');
    setTimeout(onClose, 1500);
  }, [socket, remoteId, cleanup, onClose]);

  // ── 建立 PC + 获取本地媒体 ─────────────────────────────────
  const initPC = useCallback(async () => {
    let stream;
    try {
      stream = await mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { facingMode: 'user' } : false,
      });
    } catch (_) {
      stream = new MediaStream();
    }
    localStreamRef.current = stream;
    setLocalUrl(stream.toURL ? stream.toURL() : null);

    // 音频路由：视频走扬声器，语音走听筒
    try {
      InCallManager.start({ media: isVideo ? 'video' : 'audio' });
      InCallManager.setForceSpeakerphoneOn(isVideo);
    } catch (_) {}

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket?.emit('call:ice', { to: remoteId, candidate });
    };
    pc.ontrack = (e) => {
      const s = e.streams[0];
      if (s) setRemoteUrl(s.toURL ? s.toURL() : null);
    };
    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        if (statusRef.current === 'connected') endCall(false, 'network');
      }
    };
    return pc;
  }, [isVideo, socket, remoteId, endCall]);

  const processOffer = useCallback(async (offer) => {
    const pc = pcRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket?.emit('call:answer', { to: remoteId, answer });
    setStatus('connected');
  }, [socket, remoteId]);

  const startOutgoing = useCallback(async () => {
    await initPC();
    timeoutRef.current = setTimeout(() => {
      if (statusRef.current === 'calling') endCall(true, 'timeout');
    }, CALL_TIMEOUT_MS);
  }, [initPC, endCall]);

  const accept = useCallback(async () => {
    setStatus('connecting');
    await initPC();
    socket?.emit('call:response', { to: remoteId, accepted: true });
    if (pendingOfferRef.current) {
      await processOffer(pendingOfferRef.current);
      pendingOfferRef.current = null;
    }
  }, [socket, remoteId, initPC, processOffer]);

  const reject = useCallback(() => {
    socket?.emit('call:response', { to: remoteId, accepted: false, reason: 'rejected' });
    onClose();
  }, [socket, remoteId, onClose]);

  // ── 信令监听 ────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onResponse = async ({ accepted, reason, busy }) => {
      clearTimeout(timeoutRef.current);
      if (!accepted) {
        setEndReason(busy ? 'busy' : (reason || 'rejected'));
        setStatus('ended');
        cleanup();
        setTimeout(onClose, 1500);
        return;
      }
      setStatus('connected');
      const pc = pcRef.current;
      if (!pc) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call:offer', { to: remoteId, offer });
    };
    const onOffer = async ({ offer }) => {
      if (!pcRef.current) { pendingOfferRef.current = offer; return; }
      await processOffer(offer);
    };
    const onAnswer = async ({ answer }) => {
      const pc = pcRef.current;
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    };
    const onIce = async ({ candidate }) => {
      try {
        if (pcRef.current && candidate) await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (_) {}
    };
    const onEnd = ({ reason } = {}) => {
      if (reason) setEndReason(reason);
      setStatus('ended');
      cleanup();
      setTimeout(onClose, 1500);
    };

    socket.on('call:response', onResponse);
    socket.on('call:offer',    onOffer);
    socket.on('call:answer',   onAnswer);
    socket.on('call:ice',      onIce);
    socket.on('call:end',      onEnd);
    return () => {
      socket.off('call:response', onResponse);
      socket.off('call:offer',    onOffer);
      socket.off('call:answer',   onAnswer);
      socket.off('call:ice',      onIce);
      socket.off('call:end',      onEnd);
    };
  }, [socket, remoteId, cleanup, onClose, processOffer]);

  // 发起方挂载即准备媒体；卸载清理
  useEffect(() => {
    if (direction === 'outgoing') startOutgoing();
    return cleanup;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 通话计时
  useEffect(() => {
    if (status !== 'connected') return;
    const t = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = muted; setMuted(m => !m); }
  };
  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = cameraOff; setCameraOff(c => !c); }
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const END_TEXT = { rejected: '对方已拒绝', busy: '对方正忙', timeout: '无人接听', network: '网络已断开' };
  const STATUS_TEXT = {
    calling:    '正在呼叫…',
    incoming:   `${isVideo ? '视频' : '语音'}通话邀请`,
    connecting: '连接中…',
    connected:  fmt(duration),
    ended:      END_TEXT[endReason] || '通话已结束',
  };
  const inProgress = ['calling', 'connecting', 'connected'].includes(status);
  const showVideo = isVideo && status === 'connected';

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <View style={[S.container, showVideo && { backgroundColor: '#000' }]}>
        {/* 远端视频全屏 */}
        {showVideo && remoteUrl && (
          <RTCView streamURL={remoteUrl} objectFit="cover" style={S.remoteVideo} />
        )}
        {/* 本地视频画中画 */}
        {showVideo && localUrl && (
          <RTCView streamURL={localUrl} objectFit="cover" zOrder={1} style={S.localVideo} />
        )}

        {/* 头像/名字/状态：非视频接通态才显示 */}
        {!showVideo && (
          <View style={S.infoArea}>
            <View style={S.avatarCircle}><Text style={S.avatarText}>{displayName[0] || '?'}</Text></View>
            <Text style={S.nameText}>{displayName}</Text>
            <Text style={S.statusText}>{STATUS_TEXT[status]}</Text>
          </View>
        )}
        {showVideo && (
          <Text style={S.videoTimer}>{fmt(duration)}</Text>
        )}

        {/* 控制区 */}
        <View style={S.actionSection}>
          {status === 'incoming' ? (
            <View style={S.row}>
              <Ctrl bg="#ff4d4f" icon="📵" label="拒绝" onPress={reject} />
              <Ctrl bg="#07C160" icon={isVideo ? '📹' : '📞'} label="接听" onPress={accept} />
            </View>
          ) : inProgress ? (
            <View style={S.row}>
              {isVideo && (
                <Ctrl bg={cameraOff ? '#555' : 'rgba(255,255,255,.18)'} icon={cameraOff ? '📷' : '📹'}
                  label={cameraOff ? '开摄像头' : '关摄像头'} onPress={toggleCamera} />
              )}
              <Ctrl bg="rgba(255,255,255,.18)" icon={muted ? '🔇' : '🎙️'}
                label={muted ? '取消静音' : '静音'} onPress={toggleMute} />
              <Ctrl bg="#ff4d4f" icon="📵" label="挂断" onPress={() => endCall(true)} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Ctrl({ bg, icon, label, onPress }) {
  return (
    <TouchableOpacity style={S.ctrlWrap} onPress={onPress} activeOpacity={0.8}>
      <View style={[S.ctrlBtn, { backgroundColor: bg }]}><Text style={S.ctrlIcon}>{icon}</Text></View>
      <Text style={S.ctrlLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  remoteVideo:  { ...StyleSheet.absoluteFillObject },
  localVideo:   { position: 'absolute', top: 60, right: 18, width: 110, height: 150, borderRadius: 12, backgroundColor: '#222', borderWidth: 2, borderColor: 'rgba(255,255,255,.3)' },
  infoArea:     { alignItems: 'center' },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#07C160', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText:   { color: '#fff', fontSize: 42, fontWeight: '700' },
  nameText:     { color: '#fff', fontSize: 22, fontWeight: '600', marginBottom: 8 },
  statusText:   { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  videoTimer:   { position: 'absolute', top: 24, alignSelf: 'center', color: '#fff', fontSize: 15, textShadowColor: 'rgba(0,0,0,.5)', textShadowRadius: 4 },
  actionSection:{ position: 'absolute', bottom: 56, alignItems: 'center' },
  row:          { flexDirection: 'row', gap: 44, alignItems: 'center' },
  ctrlWrap:     { alignItems: 'center', gap: 6 },
  ctrlBtn:      { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  ctrlIcon:     { fontSize: 26 },
  ctrlLabel:    { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
});
