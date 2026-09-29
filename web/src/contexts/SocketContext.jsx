import axios from 'axios';
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

    // Engine.IO 自带 ping/pong 超时检测。Socket.IO onAny 只观测业务事件，
    // 不能据此判断连接静默，否则正常空闲连接也会被主动断开。

    setSocket(s);
    if (typeof window !== 'undefined') window.__vxinSocket = s;

    s.on('connect', () => {
      setConnected(true);
      if (everConnectedRef.current) setReconnectCount(n => n + 1);
      everConnectedRef.current = true;
    });
    s.on('disconnect', (reason) => {
      setConnected(false);
      disconnectAtRef.current = Math.floor(Date.now() / 1000);
      // 服务端主动断开（改密码/注销/撤销会话后 disconnectSockets）时 socket.io 不会自动重连，
      // 界面会一直停在「正在重连…」。主动重连一次：凭证仍有效（如改密码的本机已拿到新 Cookie）
      // 则恢复实时；已失效则握手被拒 → 下面 connect_error 确认会话并跳登录页。
      if (reason === 'io server disconnect') setTimeout(() => { if (!s.connected) s.connect(); }, 1000);
    });
    // 重连被服务端以「登录失效」拒绝（改密码/被封禁/token 失效后服务端断开了所有旧连接）：
    // 否则界面会一直显示「网络连接已断开，正在重连…」。这里用一次 HTTP 请求确认会话：
    // 真失效 → axios 拦截器刷新失败后派发 vxin:session_expired 跳登录页；刷新成功则继续重连。
    // 改密码的那台设备已拿到新凭证，重连成功，不会走到这里。
    let lastAuthCheck = 0;
    s.on('connect_error', (err) => {
      const msg = String(err?.message || '');
      if (!/未授权|失效|密码已修改|封禁|Token无效/.test(msg)) return;
      const now = Date.now();
      if (now - lastAuthCheck < 30000) return;
      lastAuthCheck = now;
      axios.get('/api/auth/me').catch(() => {});
    });
    // 本设备被「踢下线」（其它端删除该会话）：后端已定向断开，这里只需触发前端的
    // 登出清理 + 跳登录页——复用 401 刷新失败时同一条 vxin:session_expired 事件通道
    // （由 AuthContext 统一监听处理），避免两处各写一套清理逻辑。
    s.on('force_logout', () => {
      s.disconnect();
      if (window.__vxinSocket === s) delete window.__vxinSocket;
      window.dispatchEvent(new CustomEvent('vxin:session_expired'));
    });
    s.on('sync:unread_cleared', (payload) => {
      unreadClearedListeners.current.forEach(fn => fn(payload));
    });
    s.on('message_delivered', (payload) => {
      deliveredListeners.current.forEach(fn => fn(payload));
    });
    ['new_moment', 'moment_liked', 'moment_commented', 'moment_deleted'].forEach((ev) => {
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
      if (window.__vxinSocket === s) delete window.__vxinSocket;
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
