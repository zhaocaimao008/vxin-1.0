import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getConfig } from '../utils/config';

// 拆分成两个 context 避免 reconnect 引起无关组件 re-render：
// SocketCoreContext  — socket 实例 + 稳定回调（重连时不变）
// SocketStatusContext — connected + reconnectCount（重连时变）
const SocketCoreContext   = createContext(null);
const SocketStatusContext = createContext({ connected: false, reconnectCount: 0 });

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket]           = useState(null);
  const [connected, setConnected]     = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const disconnectAtRef   = useRef(0);
  const everConnectedRef  = useRef(false);

  const unreadClearedListeners = useRef(new Set());
  const deliveredListeners     = useRef(new Set());

  const registerUnreadCleared = useCallback((fn) => {
    if (!fn) return;
    unreadClearedListeners.current.add(fn);
    return () => unreadClearedListeners.current.delete(fn);
  }, []);
  const registerDelivered = useCallback((fn) => {
    if (!fn) return;
    deliveredListeners.current.add(fn);
    return () => deliveredListeners.current.delete(fn);
  }, []);

  const userId = user?.id;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!userId) { setSocket(null); setConnected(false); return; }

    const manualUrl = localStorage.getItem('vxin_server_url');
    const cfg = getConfig();
    const serverUrl = manualUrl || cfg.socket || import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_BASE || '/';

    const electronToken = (window.__ELECTRON_CONFIG__ || window.Capacitor?.isNativePlatform?.())
      ? localStorage.getItem('vxin_electron_token')
      : null;

    const s = io(serverUrl, {
      transports: ['websocket'],
      withCredentials: true,
      ...(electronToken ? { auth: { token: electronToken } } : {}),
      reconnection: true,
      reconnectionAttempts: Infinity,
      // W7: 指数退避重连（对齐 Android/iOS，1s→2s→4s…上限30s + ±25%抖动）
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.25,
      // W7: 连接超时10s（原默认20s），更快感知连接失败
      timeout: 10000,
    });

    // W7: 客户端心跳自检（网络静默断开检测）
    // 场景：中间件（4G NAT/代理）会静默关闭30s无流量的连接，但客户端不收到 disconnect 事件。
    // 方案：任意事件到达时重置30s定时器；使用节流（1s内只重置一次）避免高频消息连续 clearTimeout/setTimeout
    let _silenceTimer = null;
    let _lastReset = 0;
    const _resetSilence = () => {
      const now = Date.now();
      if (now - _lastReset < 1000) return;  // 节流：1s 内只重置一次
      _lastReset = now;
      clearTimeout(_silenceTimer);
      _silenceTimer = setTimeout(() => {
        if (s.connected) { s.disconnect(); s.connect(); }
      }, 30000);
    };
    s.onAny(_resetSilence);  // 任意事件（含 pong）重置计时器（节流版）

    setSocket(s);
    if (typeof window !== 'undefined') window.__vxinSocket = s;

    s.on('connect', () => {
      setConnected(true);
      if (everConnectedRef.current) setReconnectCount(n => n + 1);
      everConnectedRef.current = true;
    });
    s.on('disconnect', () => {
      setConnected(false);
      disconnectAtRef.current = Math.floor(Date.now() / 1000);
    });
    s.on('sync:unread_cleared', (payload) => {
      unreadClearedListeners.current.forEach(fn => fn(payload));
    });
    s.on('message_delivered', (payload) => {
      deliveredListeners.current.forEach(fn => fn(payload));
    });
    ['new_moment', 'moment_liked', 'moment_commented'].forEach((ev) => {
      s.on(ev, (payload) => {
        try { window.dispatchEvent(new CustomEvent('vxin:moment', { detail: { type: ev, payload } })); } catch { /* ignore */ }
      });
    });

    const onVisible = () => { if (document.visibilityState === 'visible' && !s.connected) s.connect(); };
    const onOnline  = () => { if (!s.connected) s.connect(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);

    return () => {
      everConnectedRef.current = false;
      disconnectAtRef.current = 0;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [userId]);

  // coreValue 只在 socket 对象更换时变（登录/登出），不在重连时变
  const coreValue = useMemo(() => ({
    socket,
    disconnectAtRef,
    registerUnreadCleared,
    registerDelivered,
  }), [socket, registerUnreadCleared, registerDelivered]);

  // statusValue 在 connect/disconnect/reconnect 时变
  const statusValue = useMemo(() => ({ connected, reconnectCount }), [connected, reconnectCount]);

  return (
    <SocketCoreContext.Provider value={coreValue}>
      <SocketStatusContext.Provider value={statusValue}>
        {children}
      </SocketStatusContext.Provider>
    </SocketCoreContext.Provider>
  );
};

/** 完整 context（向后兼容，现有消费方无需修改） */
export const useSocket = () => ({ ...useContext(SocketCoreContext), ...useContext(SocketStatusContext) });
/** 仅稳定部分 — socket/回调，重连时不触发 re-render */
export const useSocketCore   = () => useContext(SocketCoreContext);
/** 仅状态部分 — connected/reconnectCount */
export const useSocketStatus = () => useContext(SocketStatusContext);

