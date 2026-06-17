import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import CallScreen from '../screens/CallScreen';

const CallContext = createContext(null);

/*
 * 全局通话管理：来电监听提升到 App 根层，任何页面都能弹出通话界面。
 * - 来电（call:incoming）：全局监听，弹出 CallScreen
 * - 去电：任意页面通过 useCall().startCall(...) 发起
 * - 占线：已在通话中又有新来电 → 自动回拒(busy)
 */
export const CallProvider = ({ children }) => {
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState(null);
  const activeRef = useRef(null);
  useEffect(() => { activeRef.current = activeCall; }, [activeCall]);

  // 发起通话（去电）
  const startCall = useCallback((call) => {
    if (!socket || activeRef.current) return;
    socket.emit('call:request', { to: call.remoteId, type: call.type, caller: call.caller });
    setActiveCall({ type: call.type, direction: 'outgoing', remoteUser: call.remoteUser, remoteId: call.remoteId });
  }, [socket]);

  // 全局来电监听
  useEffect(() => {
    if (!socket) return;
    const onIncoming = ({ from, type, caller }) => {
      // 占线：已在通话中 → 自动回拒
      if (activeRef.current) {
        socket.emit('call:response', { to: from, accepted: false, busy: true });
        return;
      }
      setActiveCall({
        type, direction: 'incoming',
        remoteUser: { id: from, name: caller?.name || caller?.username, avatar: caller?.avatar },
        remoteId: from,
      });
    };
    socket.on('call:incoming', onIncoming);
    return () => socket.off('call:incoming', onIncoming);
  }, [socket]);

  // 断线时强制关闭通话界面，避免卡死
  useEffect(() => {
    if (!connected && activeRef.current) setActiveCall(null);
  }, [connected]);

  return (
    <CallContext.Provider value={{ startCall, inCall: !!activeCall }}>
      {children}
      {activeCall && socket && (
        <CallScreen socket={socket} user={user} call={activeCall} onClose={() => setActiveCall(null)} />
      )}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
};
