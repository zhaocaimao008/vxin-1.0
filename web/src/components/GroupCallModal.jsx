import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import { showToast } from '../utils/toast';
import { IcoCamera, IcoMic, IcoPhoneOff } from './Icons';

// 仅在拉取 /api/turn/credentials 失败时兜底
const FALLBACK_ICE = { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
] };

async function fetchIceConfig() {
  try {
    const { data } = await axios.get('/api/turn/credentials');
    if (data && Array.isArray(data.iceServers) && data.iceServers.length) return { iceServers: data.iceServers };
  } catch { /* 兜底 */ }
  return FALLBACK_ICE;
}

// ── Hook: 响应式宫格列数 ──────────────────────────────────────
function useResponsiveGrid(tileCount) {
  const [cols, setCols] = useState(() => {
    if (tileCount <= 1) return 1;
    if (tileCount <= 4) return 2;
    return 3;
  });
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (tileCount <= 1) setCols(1);
      else if (tileCount <= 4) setCols(w < 480 ? 1 : 2);
      else setCols(w < 640 ? 2 : 3);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [tileCount]);
  return cols;
}

// ── Hook: Focus Trap（弹窗内 Tab 循环） ──────────────────────
function useFocusTrap(open) {
  const containerRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;
    const focusableSel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"]';
    const prevFocus = document.activeElement;
    const focusFirst = () => {
      const els = container.querySelectorAll(focusableSel);
      if (els.length) els[0].focus();
    };
    focusFirst();
    const handler = (e) => {
      if (e.key !== 'Tab') return;
      const els = container.querySelectorAll(focusableSel);
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    container.addEventListener('keydown', handler);
    return () => {
      container.removeEventListener('keydown', handler);
      prevFocus?.focus();
    };
  }, [open]);
  return containerRef;
}

// ── Hook: WebRTC 群通话信令与连接管理 ──────────────────────────
function useGroupCallWebRTC({ socket, user: _user, session, nameOf: _nameOf, onClose }) {
  const { mode, conversationId, type } = session;
  const isVideo = type === 'video';

  const [callId, setCallId] = useState(session.callId || null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [localStream, setLocalStream] = useState(null);
  const [status, setStatus] = useState(mode === 'start' ? 'calling' : 'joining');

  const localStreamRef = useRef(null);
  const iceCfgRef = useRef(FALLBACK_ICE);
  const pcsRef = useRef(new Map());
  const remoteSetRef = useRef(new Set());
  const pendingIceRef = useRef(new Map());
  const callIdRef = useRef(session.callId || null);
  const closedRef = useRef(false);

  const generationRef = useRef(0);
  const requestIdRef = useRef(crypto.randomUUID());
  const requestedRef = useRef(false);
  const timeoutRef = useRef(null);
  const peerTimersRef = useRef(new Map());

  const cleanup = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    generationRef.current += 1;
    clearTimeout(timeoutRef.current);
    for (const timer of peerTimersRef.current.values()) clearTimeout(timer);
    peerTimersRef.current.clear();
    if (requestedRef.current) socket?.emit('group_call:leave', {
      ...(callIdRef.current ? { callId: callIdRef.current } : { requestId: requestIdRef.current }),
    });
    pcsRef.current.forEach(pc => {
      pc.onicecandidate = pc.ontrack = pc.onconnectionstatechange = null;
      pc.close();
    });
    pcsRef.current.clear();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    pendingIceRef.current.clear();
    remoteSetRef.current.clear();
  }, [socket]);

  const hangup = useCallback(() => { cleanup(); }, [cleanup]);
  const finish = useCallback((message) => {
    if (closedRef.current) return;
    if (message) showToast(message, 'error');
    cleanup();
    onClose?.();
  }, [cleanup, onClose]);

  const removePeer = useCallback((peerId, failed = false) => {
    const pc = pcsRef.current.get(peerId);
    pcsRef.current.delete(peerId);
    clearTimeout(peerTimersRef.current.get(peerId));
    peerTimersRef.current.delete(peerId);
    if (pc) {
      pc.onicecandidate = pc.ontrack = pc.onconnectionstatechange = null;
      pc.close();
    }
    remoteSetRef.current.delete(peerId);
    pendingIceRef.current.delete(peerId);
    setRemoteStreams(prev => {
      if (!(peerId in prev)) return prev;
      const n = { ...prev }; delete n[peerId]; return n;
    });
    if (failed && pcsRef.current.size === 0) finish('群通话连接失败，请重新加入');
  }, [finish]);

  const drainIce = useCallback((peerId) => {
    const pc = pcsRef.current.get(peerId);
    const pending = pendingIceRef.current.get(peerId);
    if (pc && pending) {
      pending.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
      pendingIceRef.current.delete(peerId);
    }
  }, []);

  const createPC = useCallback((peerId) => {
    if (closedRef.current) return null;
    if (pcsRef.current.has(peerId)) return pcsRef.current.get(peerId);
    const pc = new RTCPeerConnection(iceCfgRef.current);
    pcsRef.current.set(peerId, pc);
    const alive = () => !closedRef.current && pcsRef.current.get(peerId) === pc;
    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
    peerTimersRef.current.set(peerId, setTimeout(() => {
      if (alive() && pc.connectionState !== 'connected') removePeer(peerId, true);
    }, 30000));
    pc.onicecandidate = ({ candidate }) => {
      if (alive() && candidate) socket?.emit('group_call:ice', { callId: callIdRef.current, to: peerId, candidate });
    };
    pc.ontrack = (e) => {
      if (!alive()) return;
      const stream = e.streams[0];
      setRemoteStreams(prev => (prev[peerId] === stream ? prev : { ...prev, [peerId]: stream }));
    };
    pc.onconnectionstatechange = () => {
      if (!alive()) return;
      if (pc.connectionState === 'connected') {
        clearTimeout(peerTimersRef.current.get(peerId));
      } else if (pc.connectionState === 'disconnected') {
        clearTimeout(peerTimersRef.current.get(peerId));
        peerTimersRef.current.set(peerId, setTimeout(() => {
          if (alive() && pc.connectionState === 'disconnected') removePeer(peerId, true);
        }, 15000));
      } else if (['failed', 'closed'].includes(pc.connectionState)) removePeer(peerId, true);
    };
    return pc;
  }, [socket, removePeer]);

  const toggleMute = useCallback(() => {
    const on = !muted; setMuted(on);
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !on; });
    return on;
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const off = !cameraOff; setCameraOff(off);
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !off; });
    return off;
  }, [cameraOff]);

  const peerIds = Object.keys(remoteStreams);
  const tileCount = peerIds.length + 1;

  // Register signals before requesting a group call. Each event belongs to a callId.
  useEffect(() => {
    if (!socket) return;
    const matches = data => data && !closedRef.current && data.callId === callIdRef.current;
    const alive = (peerId, pc) => !closedRef.current && pcsRef.current.get(peerId) === pc;
    const onStarted = ({ callId: cid, conversationId: conv, requestId } = {}) => {
      if (closedRef.current || mode !== 'start' || conv !== conversationId ||
          requestId && requestId !== requestIdRef.current) return;
      clearTimeout(timeoutRef.current);
      callIdRef.current = cid; setCallId(cid); setStatus('connected');
    };
    const onPeers = data => {
      if (!matches(data) || !Array.isArray(data.peers)) return;
      clearTimeout(timeoutRef.current);
      setStatus('connected');
      data.peers.forEach(pid => createPC(pid));
    };
    const onPeerJoined = async data => {
      if (!matches(data)) return;
      const pid = data.userId, pc = createPC(pid);
      if (!pc) return;
      try {
        const offer = await pc.createOffer();
        if (!alive(pid, pc)) return;
        await pc.setLocalDescription(offer);
        if (alive(pid, pc)) socket.emit('group_call:offer', { callId: data.callId, to: pid, offer });
      } catch { if (alive(pid, pc)) removePeer(pid, true); }
    };
    const onOffer = async data => {
      if (!matches(data)) return;
      const { from, offer } = data, pc = createPC(from);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        if (!alive(from, pc)) return;
        remoteSetRef.current.add(from); drainIce(from);
        const answer = await pc.createAnswer();
        if (!alive(from, pc)) return;
        await pc.setLocalDescription(answer);
        if (alive(from, pc)) socket.emit('group_call:answer', { callId: data.callId, to: from, answer });
      } catch { if (alive(from, pc)) removePeer(from, true); }
    };
    const onAnswer = async data => {
      if (!matches(data)) return;
      const pc = pcsRef.current.get(data.from);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        if (alive(data.from, pc)) { remoteSetRef.current.add(data.from); drainIce(data.from); }
      } catch { if (alive(data.from, pc)) removePeer(data.from, true); }
    };
    const onIce = data => {
      if (!matches(data) || !data.candidate) return;
      const { from, candidate } = data, pc = pcsRef.current.get(from);
      if (pc && remoteSetRef.current.has(from)) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      } else if ((pendingIceRef.current.has(from) || pendingIceRef.current.size < 9)) {
        const arr = pendingIceRef.current.get(from) || [];
        if (arr.length < 256) arr.push(candidate);
        pendingIceRef.current.set(from, arr);
      }
    };
    const onPeerLeft = data => { if (matches(data)) removePeer(data.userId); };
    const onError = ({ reason, callId: cid, conversationId: conv, requestId } = {}) => {
      if (cid && cid !== callIdRef.current || conv && conv !== conversationId ||
          requestId && requestId !== requestIdRef.current) return;
      const messages = { active_call: '群里已有通话，请加入已有通话', busy: '你正在通话中', not_group: '仅群聊支持多人通话', not_found: '通话已结束', full: '通话人数已满', voice_disabled: '群语音通话已被管理员关闭', video_disabled: '群视频通话已被管理员关闭', rate_limited: '操作太快，请稍后重试' };
      finish(messages[reason] || '通话出错');
    };
    const onEnded = data => { if (matches(data)) finish(data.reason === 'timeout' ? '通话已超时结束' : '通话已结束'); };
    const onDisconnect = () => finish('网络已断开');
    const events = { 'group_call:started': onStarted, 'group_call:peers': onPeers,
      'group_call:peer_joined': onPeerJoined, 'group_call:offer': onOffer, 'group_call:answer': onAnswer,
      'group_call:ice': onIce, 'group_call:peer_left': onPeerLeft, 'group_call:error': onError,
      'group_call:ended': onEnded, disconnect: onDisconnect };
    for (const [name, handler] of Object.entries(events)) socket.on(name, handler);
    return () => { for (const [name, handler] of Object.entries(events)) socket.off(name, handler); };
  }, [socket, mode, conversationId, createPC, drainIce, removePeer, finish]);

  useEffect(() => {
    closedRef.current = false;
    const generation = generationRef.current;
    const alive = () => !closedRef.current && generation === generationRef.current;
    timeoutRef.current = setTimeout(() => finish('群通话连接超时'), 30000);
    (async () => {
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo }); }
      catch { if (alive()) finish('无法使用麦克风或摄像头'); return; }
      if (!alive()) { stream.getTracks().forEach(t => t.stop()); return; }
      localStreamRef.current = stream;
      setLocalStream(stream);
      const ice = await fetchIceConfig();
      if (!alive()) return;
      iceCfgRef.current = ice;
      requestedRef.current = true;
      if (mode === 'start') socket?.emit('group_call:start', { conversationId, type, requestId: requestIdRef.current });
      else socket?.emit('group_call:join', { callId: callIdRef.current });
    })();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    callId, muted, cameraOff, remoteStreams, localStream, status,
    peerIds, tileCount, localStreamRef, isVideo,
    toggleMute, toggleCamera, hangup, cleanup,
  };
}

// ════════════════════════════════════════════════════════════════
//  主组件
// ════════════════════════════════════════════════════════════════
export default function GroupCallModal({ socket, user, session, nameOf, onClose }) {
  const webrtc = useGroupCallWebRTC({ socket, user, session, nameOf, onClose });
  const cols = useResponsiveGrid(webrtc.tileCount);
  const containerRef = useFocusTrap(true);

  const handleHangup = () => {
    webrtc.hangup();
    webrtc.cleanup();
    onClose();
  };

  const { muted, cameraOff, remoteStreams, localStream, status, isVideo, peerIds, tileCount } = webrtc;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="群通话"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: "var(--z-call)",
        background: 'rgba(18,18,18,0.97)',
        display: 'flex', flexDirection: 'column',
        color: 'var(--text-inverse)',
      }}
    >
      {/* 顶部状态栏 */}
      <header style={{
        textAlign: 'center', padding: '14px 12px 6px',
        fontSize: isMobileWidth() ? 13 : 15,
        color: 'rgba(255,255,255,.85)',
      }}>
        群{isVideo ? '视频' : '语音'}通话 · {tileCount} 人
        <span style={{
          fontSize: isMobileWidth() ? 11 : 12,
          color: 'rgba(255,255,255,.45)', marginLeft: 8,
        }}>
          {status === 'connected' ? '通话中' : (webrtc.callId ? '等待他人加入…' : '加入中…')}
        </span>
      </header>

      {/* 画面宫格 — 响应式 */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: isMobileWidth() ? 4 : 6,
        padding: isMobileWidth() ? 6 : 10,
        alignContent: 'center', overflow: 'auto',
      }}>
        <Tile
          stream={localStream}
          muted
          isVideo={isVideo && !cameraOff}
          info={{ name: '我', avatar: user?.avatar }}
          self
        />
        {peerIds.map(pid => (
          <Tile
            key={pid}
            streamForRef={remoteStreams[pid]}
            isVideo={isVideo}
            info={nameOf?.(pid) || { name: '成员' }}
          />
        ))}
      </div>

      {/* 控制区 — 响应式 */}
      <nav aria-label="通话控制" style={{
        display: 'flex', justifyContent: 'center', gap: isMobileWidth() ? 20 : 28,
        padding: isMobileWidth() ? '14px 0 24px' : '18px 0 34px',
      }}>
        {isVideo && (
          <CtrlBtn
            icon={<IcoCamera off={cameraOff} size={isMobileWidth() ? 20 : 22} />}
            label={cameraOff ? '开摄像头' : '关摄像头'}
            bg={cameraOff ? '#555' : 'rgba(255,255,255,.18)'}
            size={isMobileWidth() ? 44 : 52}
            onClick={webrtc.toggleCamera}
          />
        )}
        <CtrlBtn
          icon={<IcoMic off={muted} size={isMobileWidth() ? 20 : 22} />}
          label={muted ? '取消静音' : '静音'}
          bg="rgba(255,255,255,.18)"
          size={isMobileWidth() ? 44 : 52}
          onClick={webrtc.toggleMute}
        />
        <CtrlBtn
          icon={<IcoPhoneOff size={isMobileWidth() ? 24 : 28} />}
          label="挂断"
          bg="var(--color-badge)"
          size={isMobileWidth() ? 54 : 64}
          onClick={handleHangup}
        />
      </nav>
    </div>
  );
}

// ── 辅助：检测窄屏 ──────────────────────────────────────────
function isMobileWidth() {
  // 服务端渲染时默认桌面
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 480;
}

// ── 单路画面 ─────────────────────────────────────────────────
function Tile({ stream, streamForRef, muted, isVideo, info, self }) {
  const ref = useRef(null);
  const s = stream || streamForRef;
  useEffect(() => { if (ref.current && s) ref.current.srcObject = s; }, [s]);
  return (
    <div
      aria-label={`${info?.name || '成员'} 的画面`}
      style={{
        position: 'relative', background: '#000', borderRadius: 'var(--radius-md)',
        overflow: 'hidden', minHeight: isMobileWidth() ? 100 : 140,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: self ? '2px solid var(--color-primary,#07C160)' : '1px solid rgba(255,255,255,.08)',
      }}
    >
      <video
        ref={ref} autoPlay playsInline muted={muted}
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          display: isVideo ? 'block' : 'none',
        }}
      />
      {!isVideo && (
        <Avatar src={info?.avatar} name={info?.name || '?'} size={isMobileWidth() ? 54 : 72}
          style={{ borderRadius: 'var(--radius-xl)' }} />
      )}
      <div style={{
        position: 'absolute', bottom: 6, left: 8,
        fontSize: isMobileWidth() ? 11 : 12,
        color: 'var(--text-inverse)',
        textShadow: '0 1px 3px rgba(0,0,0,.6)',
      }}>
        {info?.name}
      </div>
    </div>
  );
}

// ── 控制按钮 ─────────────────────────────────────────────────
function CtrlBtn({ icon, label, bg, size = 52, onClick }) {
  return (
    <div
      role="button"
      aria-label={label}
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); }
      }}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: isMobileWidth() ? 6 : 8, cursor: 'pointer',
      }}
    >
      <div style={{
        width: size, height: size, borderRadius: size / 2,
        background: bg, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: size * 0.42,
      }}>
        {icon}
      </div>
      <span style={{ fontSize: isMobileWidth() ? 10 : 11, color: 'rgba(255,255,255,.6)' }}>
        {label}
      </span>
    </div>
  );
}
