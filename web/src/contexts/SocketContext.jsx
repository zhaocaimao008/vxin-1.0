import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket]           = useState(null);
  const [connected, setConnected]     = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const disconnectAtRef   = useRef(0);
  const everConnectedRef  = useRef(false);

  // 多端同步：其他设备读了某会话 → 本设备清零该会话未读
  // 用 ref 存 callback，避免 useEffect 重复注册
  const onUnreadClearedRef = useRef(null);
  // 送达回执回调
  const onDeliveredRef = useRef(null);

  const registerUnreadCleared = useCallback((fn) => { onUnreadClearedRef.current = fn; }, []);
  const registerDelivered      = useCallback((fn) => { onDeliveredRef.current = fn; }, []);

  useEffect(() => {
    if (!user) { setSocket(null); setConnected(false); return; }

    // Socket.io 不传 auth.token——后端从 Cookie 中提取 JWT。
    // withCredentials 确保 WebSocket 握手时携带 httpOnly Cookie。
    // Electron 本地文件模式下，VITE_SERVER_URL 指定远程服务器地址。
    const serverUrl = window.__ELECTRON_CONFIG__
      ? (localStorage.getItem('vxin_server_url') || window.__ELECTRON_CONFIG__.serverUrl)
      : (import.meta.env.VITE_API_BASE || import.meta.env.VITE_SERVER_URL || '/');
    const electronToken = window.__ELECTRON_CONFIG__
      ? sessionStorage.getItem('vxin_electron_token')
      : null;
    const s = io(serverUrl, {
      transports: ['websocket'],
      withCredentials: true,
      ...(electronToken ? { auth: { token: electronToken } } : {}),
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    setSocket(s);
    if (typeof window !== 'undefined') window.__vxinSocket = s;

    s.on('connect', () => {
      setConnected(true);
      if (everConnectedRef.current) {
        setReconnectCount(n => n + 1);
      }
      everConnectedRef.current = true;
    });

    s.on('disconnect', () => {
      setConnected(false);
      disconnectAtRef.current = Math.floor(Date.now() / 1000);
    });

    // 多端同步：另一台设备标记已读 → 通知本设备
    s.on('sync:unread_cleared', (payload) => {
      onUnreadClearedRef.current?.(payload);
    });

    // 送达回执：消息到达接收方某端
    s.on('message_delivered', (payload) => {
      onDeliveredRef.current?.(payload);
    });

    return () => {
      everConnectedRef.current = false;
      disconnectAtRef.current = 0;
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user?.id]);

  return (
    <SocketContext.Provider value={{
      socket,
      connected,
      reconnectCount,
      disconnectAtRef,
      registerUnreadCleared,
      registerDelivered,
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
