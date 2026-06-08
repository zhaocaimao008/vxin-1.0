import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
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

    // 从 localStorage 读取 CSRF Token 附加到 socket 认证信息
    const csrfToken = localStorage.getItem('csrf_token');

    const s = io('/', {
      transports: ['websocket'],
      withCredentials: true,
      auth: token ? { token, csrfToken } : undefined,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    setSocket(s);

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
  }, [user?.id, token]);

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
