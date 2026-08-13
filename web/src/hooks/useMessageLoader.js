/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs */
/**
 * useMessageLoader — 消息加载与分页 Hook
 * 从 ChatWindow 拆分：历史消息加载、分页、缓存读写
 *
 * 职责：
 *   - 首次加载（缓存 → 服务端）
 *   - 上拉加载更多历史（hasMore / loadingMore）
 *   - 收到新消息时追加
 *   - reconnect 后拉取错过的消息
 *   - 写入/更新 IndexedDB 缓存（msgCache）
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { loadCache, saveCache, mergeById, removeFromCache } from '../utils/msgCache';
import { loadOutbox } from '../utils/outbox';

const PAGE_SIZE = 40;

export function useMessageLoader({ conversationId, userId: _userId, socket: _socket, reconnectCount }) {
  const [messages, setMessages]       = useState([]);
  const [hasMore, setHasMore]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const convIdRef    = useRef(conversationId);
  const messagesRef  = useRef(messages);
  const abortRef     = useRef(null);
  convIdRef.current  = conversationId;
  messagesRef.current = messages;

  // ── 首次加载（缓存先占位，随后服务端覆盖）──────────────────────
  useEffect(() => {
    setMessages([]); setHasMore(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    async function load() {
      // 1. 读取缓存占位
      const cached = await loadCache(conversationId);
      const outbox = loadOutbox(conversationId);
      if (cached.length > 0 || outbox.length > 0) {
        setMessages([...cached, ...outbox]);
      }
      // 2. 从服务端拉最新
      try {
        const { data } = await axios.get(`/api/messages/${conversationId}`, {
          params: { limit: PAGE_SIZE },
          signal: ac.signal,
        });
        const server = data?.messages || data || [];
        const merged = mergeById(cached, server);
        const withOutbox = [...merged, ...outbox.filter(o => o._status === 'error')];
        setMessages(withOutbox);
        setHasMore(server.length >= PAGE_SIZE);
        // 写回缓存（去除乐观消息）
        const toCache = server.filter(m => !m._tempId && !m.localStatus);
        saveCache(conversationId, toCache);
      } catch (err) {
        if (!axios.isCancel?.(err) && err.code !== 'ERR_CANCELED') {
          // 网络失败：保留缓存占位，用户不感知
        }
      }
    }
    load();
    return () => ac.abort();
  }, [conversationId]);

  // ── 上拉加载更多历史 ─────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    const convId = convIdRef.current;
    const oldest = messagesRef.current.find(m => m.id && !m._tempId);
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const { data } = await axios.get(`/api/messages/${convId}`, {
        params: { before: oldest.created_at, limit: PAGE_SIZE },
      });
      const older = data?.messages || data || [];
      if (older.length === 0) { setHasMore(false); return; }
      setMessages(prev => {
        const ids = new Set(prev.map(m => m.id).filter(Boolean));
        const deduped = older.filter(m => !ids.has(m.id));
        return [...deduped, ...prev];
      });
      setHasMore(older.length >= PAGE_SIZE);
    } catch { /* 静默 */ }
    finally { setLoadingMore(false); }
  }, [loadingMore, hasMore]);

  // ── Reconnect 后补拉错过消息 ─────────────────────────────────────
  useEffect(() => {
    if (reconnectCount === 0) return;
    const convId = convIdRef.current;
    const last = messagesRef.current.filter(m => m.id && !m._tempId).at(-1);
    if (!last) return;
    axios.get(`/api/messages/${convId}`, {
      params: { after: last.created_at, limit: 100 },
    }).then(({ data }) => {
      const missed = data?.messages || data || [];
      if (!missed.length) return;
      setMessages(prev => {
        const ids = new Set(prev.map(m => m.id).filter(Boolean));
        const news = missed.filter(m => !ids.has(m.id));
        return news.length ? [...prev, ...news] : prev;
      });
    }).catch(() => {});
  }, [reconnectCount]);

  // ── 追加单条消息（乐观 or 服务端推送）─────────────────────────────
  const appendMessage = useCallback((msg) => {
    setMessages(prev => {
      // 用 clientMsgId 去重（ack 回来的服务端消息替换乐观消息）
      if (msg.id && msg.client_msg_id) {
        const idx = prev.findIndex(m => m._tempId === msg.client_msg_id || m.id === msg.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...msg };
          return next;
        }
      }
      // 已存在 id 去重
      if (msg.id && prev.some(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  // ── 撤回/删除 ─────────────────────────────────────────────────────
  const removeMessage = useCallback((msgId) => {
    setMessages(prev => prev.filter(m => m.id !== msgId && m._tempId !== msgId));
    removeFromCache(convIdRef.current, msgId);
  }, []);

  // ── 编辑 ─────────────────────────────────────────────────────────
  const editMessage = useCallback((msgId, newContent) => {
    setMessages(prev => prev.map(m =>
      (m.id === msgId) ? { ...m, content: newContent, edited: 1 } : m
    ));
  }, []);

  return {
    messages, setMessages,
    hasMore, loadingMore,
    loadMore, appendMessage, removeMessage, editMessage,
  };
}
