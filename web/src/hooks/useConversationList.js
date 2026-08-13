/**
 * useConversationList — 会话列表数据管理 Hook
 * 从 Home.jsx 拆分：未读数、好友申请数、功能开关、会话刷新
 *
 * 职责：
 *   - 维护 unread（会话未读数 map）
 *   - 维护 friendReqCount（好友申请数角标）
 *   - 维护 features（后台功能开关）
 *   - 监听 socket 事件自动刷新
 *   - 窗口 focus 时刷新未读数
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

export function useConversationList({ socket, reconnectCount, userId }) {
  const [unread, setUnread]               = useState({});
  const [friendReqCount, setFriendReqCount] = useState(0);
  const [features, setFeatures]           = useState({ moments: true, collect: true });
  const [convRefreshKey, setConvRefreshKey] = useState(0);

  // ── 未读数 ──────────────────────────────────────────────────────
  const fetchUnread = useCallback(() => {
    axios.get('/api/messages/unread-counts')
      .then(({ data }) => setUnread(data))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchUnread(); }, [fetchUnread]);

  // 重连后刷新
  useEffect(() => {
    if (reconnectCount === 0) return;
    fetchUnread();
  }, [reconnectCount, fetchUnread]);

  // 窗口聚焦时刷新
  useEffect(() => {
    window.addEventListener('focus', fetchUnread);
    return () => window.removeEventListener('focus', fetchUnread);
  }, [fetchUnread]);

  // ── 好友申请数 ──────────────────────────────────────────────────
  useEffect(() => {
    axios.get('/api/users/friend-requests')
      .then(r => setFriendReqCount(r.data?.length || 0))
      .catch(() => {});
  }, []);

  // ── 功能开关 ────────────────────────────────────────────────────
  const applyFeatures = useCallback((f) => {
    setFeatures(prev => ({ ...prev, ...(f || {}) }));
  }, []);

  useEffect(() => {
    axios.get('/api/config')
      .then(r => applyFeatures(r.data?.features))
      .catch(() => {});
  }, [applyFeatures]);

  useEffect(() => {
    if (!socket) return;
    const onConfig = ({ features: f }) => applyFeatures(f);
    socket.on('config:updated', onConfig);
    return () => socket.off('config:updated', onConfig);
  }, [socket, applyFeatures]);

  // ── 新消息到达时更新未读数 ───────────────────────────────────────
  const activeConvIdRef = useRef(null);
  const updateActiveConv = useCallback((convId) => {
    activeConvIdRef.current = convId;
  }, []);

  useEffect(() => {
    if (!socket || !userId) return;
    const onMsg = (msg) => {
      if (msg.sender_id === userId) return;
      const isActive = msg.conversation_id === activeConvIdRef.current;
      if (!isActive) {
        setUnread(prev => ({
          ...prev,
          [msg.conversation_id]: Math.min((prev[msg.conversation_id] || 0) + 1, 99),
        }));
      }
    };
    socket.on('new_message', onMsg);
    socket.on('new_message_batch', (msgs) => msgs?.forEach?.(onMsg));
    return () => {
      socket.off('new_message', onMsg);
      socket.off('new_message_batch');
    };
  }, [socket, userId]);

  // ── 标记已读 ────────────────────────────────────────────────────
  const markConvRead = useCallback((convId) => {
    setUnread(prev => {
      if (!prev[convId]) return prev;
      const next = { ...prev };
      delete next[convId];
      return next;
    });
  }, []);

  // ── 触发会话列表刷新 ─────────────────────────────────────────────
  const refreshConvList = useCallback(() => {
    setConvRefreshKey(k => k + 1);
  }, []);

  return {
    unread, setUnread, markConvRead,
    friendReqCount, setFriendReqCount,
    features,
    convRefreshKey, refreshConvList,
    updateActiveConv,
  };
}
