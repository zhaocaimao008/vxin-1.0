import React, { useState, useEffect, useRef, useCallback } from 'react';
import Avatar from './Avatar';

const STUN = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

/* ── 通话计时器 ── */
function CallTimer({ running }) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!running) { setSec(0); return; }
    const t = setInterval(() => setSec(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return <span>{m}:{s}</span>;
}

export default function CallModal({ socket, user, call, onClose }) {
  const { type, direction, remoteUser, remoteId } = call;
  // direction: 'outgoing' | 'incoming'
  // type: 'audio' | 'video'

  const [status, setStatus] = useState(direction === 'incoming' ? 'incoming' : 'calling');
  // status: 'calling' | 'incoming' | 'connected' | 'ended'
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speaker, setSpeaker] = useState(true);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    localStreamRef.current = null;
    pcRef.current = null;
  }, []);

  const hangup = useCallback((notify = true) => {
    if (notify) socket?.emit('call:end', { to: remoteId });
    cleanup();
    setStatus('ended');
    setTimeout(onClose, 1200);
  }, [socket, remoteId, cleanup, onClose]);

  // 建立 RTCPeerConnection 并获取本地流
  const initPC = useCallback(async () => {
    const constraints = { audio: true, video: type === 'video' };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      // 权限拒绝时用空流
      stream = new MediaStream();
    }
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection(STUN);
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket?.emit('call:ice', { to: remoteId, candidate });
    };
    pc.ontrack = (e) => {
      const remoteStream = e.streams[0];
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') hangup(false);
    };
    return pc;
  }, [socket, remoteId, type, hangup]);

  // 发起方：创建 offer
  const startOutgoing = useCallback(async () => {
    const pc = await initPC();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket?.emit('call:offer', { to: remoteId, offer });
  }, [initPC, socket, remoteId]);

  // 接受通话
  const accept = useCallback(async () => {
    setStatus('connecting');
    socket?.emit('call:response', { to: remoteId, accepted: true });
    await initPC();
    setStatus('connected');
  }, [socket, remoteId, initPC]);

  // 拒绝
  const reject = useCallback(() => {
    socket?.emit('call:response', { to: remoteId, accepted: false });
    onClose();
  }, [socket, remoteId, onClose]);

  // 监听信令事件
  useEffect(() => {
    if (!socket) return;

    const onResponse = async ({ accepted }) => {
      if (!accepted) { setStatus('ended'); setTimeout(onClose, 1000); return; }
      setStatus('connected');
    };
    const onOffer = async ({ offer }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call:answer', { to: remoteId, answer });
    };
    const onAnswer = async ({ answer }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      setStatus('connected');
    };
    const onIce = async ({ candidate }) => {
      const pc = pcRef.current;
      try { if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    };
    const onEnd = () => { setStatus('ended'); cleanup(); setTimeout(onClose, 1200); };

    socket.on('call:response', onResponse);
    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice', onIce);
    socket.on('call:end', onEnd);
    return () => {
      socket.off('call:response', onResponse);
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice', onIce);
      socket.off('call:end', onEnd);
    };
  }, [socket, remoteId, cleanup, onClose]);

  // 发起方自动创建 offer
  useEffect(() => {
    if (direction === 'outgoing') startOutgoing();
  }, []); // eslint-disable-line

  // 切换麦克风
  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = muted; setMuted(m => !m); }
  };
  // 切换摄像头
  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = cameraOff; setCameraOff(c => !c); }
  };

  const statusText = {
    calling: '等待对方接听…',
    incoming: `${type === 'video' ? '视频' : '语音'}通话邀请`,
    connecting: '连接中…',
    connected: null,
    ended: '通话已结束',
  }[status];

  const isVideo = type === 'video';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: isVideo ? '#000' : 'rgba(30,30,30,0.96)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: '#fff',
    }}>
      {/* 远端视频 */}
      {isVideo && (
        <video ref={remoteVideoRef} autoPlay playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
        />
      )}
      {/* 本地视频（画中画） */}
      {isVideo && status === 'connected' && (
        <video ref={localVideoRef} autoPlay playsInline muted
          style={{ position: 'absolute', bottom: 120, right: 24, width: 120, height: 160, borderRadius: 12, objectFit: 'cover', zIndex: 2, border: '2px solid rgba(255,255,255,.3)' }}
        />
      )}
      {/* 音频元素 */}
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

      {/* 主信息区 */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {(!isVideo || status !== 'connected') && (
          <Avatar src={remoteUser?.avatar} name={remoteUser?.name || '?'} size={96} style={{ borderRadius: 22 }} />
        )}
        <div style={{ fontSize: 22, fontWeight: 600 }}>{remoteUser?.name}</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,.65)', height: 20 }}>
          {status === 'connected' ? <CallTimer running /> : statusText}
        </div>
      </div>

      {/* 控制按钮区 */}
      <div style={{ position: 'absolute', bottom: 48, zIndex: 3, display: 'flex', alignItems: 'center', gap: 32 }}>
        {/* 来电时：拒绝 + 接听 */}
        {status === 'incoming' && <>
          <CtrlBtn icon="📵" label="拒绝" bg="#FA5151" size={64} onClick={reject} />
          <CtrlBtn icon={isVideo ? '📹' : '📞'} label="接听" bg="#07C160" size={64} onClick={accept} />
        </>}

        {/* 通话中 */}
        {(status === 'calling' || status === 'connected') && <>
          {isVideo && (
            <CtrlBtn icon={cameraOff ? '📵' : '📹'} label={cameraOff ? '开启摄像头' : '关闭摄像头'} bg={cameraOff ? '#555' : 'rgba(255,255,255,.15)'} onClick={toggleCamera} />
          )}
          <CtrlBtn icon={muted ? '🔇' : '🎙️'} label={muted ? '取消静音' : '静音'} bg="rgba(255,255,255,.15)" onClick={toggleMute} />
          <CtrlBtn icon="📵" label="挂断" bg="#FA5151" size={64} onClick={() => hangup(true)} />
          <CtrlBtn icon={speaker ? '🔊' : '🔈'} label={speaker ? '外放' : '听筒'} bg="rgba(255,255,255,.15)" onClick={() => setSpeaker(s => !s)} />
        </>}
      </div>
    </div>
  );
}

function CtrlBtn({ icon, label, bg, size = 52, onClick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={onClick}>
      <div style={{ width: size, height: size, borderRadius: size / 2, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, transition: 'transform .1s' }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >{icon}</div>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>{label}</span>
    </div>
  );
}
