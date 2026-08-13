/**
 * useChatScroll — 聊天列表滚动管理 Hook
 * 从 ChatWindow 拆分：贴底逻辑、新消息数量、回到底部按钮
 *
 * 职责：
 *   - 追踪是否处于底部（atBottom）
 *   - 新消息到达时：在底部则自动滚动；不在底部则累计未读数显示按钮
 *   - 暴露 scrollToBottom / scrollToItem / resetUnread
 */
import { useState, useRef, useCallback, useEffect } from 'react';

const BOTTOM_THRESHOLD = 80;  // px，距底部多少像素内视为"在底"

export function useChatScroll({ messages, listRef, outerRef }) {
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newMsgCount, setNewMsgCount]     = useState(0);
  const prevLenRef  = useRef(0);
  const atBottomRef = useRef(true);

  // 监听滚动容器，更新 atBottom 状态
  useEffect(() => {
    const el = outerRef?.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const distToBottom = scrollHeight - scrollTop - clientHeight;
      atBottomRef.current = distToBottom <= BOTTOM_THRESHOLD;
      setShowScrollBtn(distToBottom > BOTTOM_THRESHOLD + 10);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [outerRef]);

  // 新消息到达时，决定自动滚动还是显示新消息数
  useEffect(() => {
    const curLen = messages.length;
    const prevLen = prevLenRef.current;
    if (curLen <= prevLen) { prevLenRef.current = curLen; return; }

    const added = curLen - prevLen;
    prevLenRef.current = curLen;

    if (atBottomRef.current) {
      // 在底部：自动贴底
      requestAnimationFrame(() => {
        listRef?.current?.scrollToLast?.();
        const el = outerRef?.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
      setNewMsgCount(0);
    } else {
      // 不在底部：累计显示新消息数
      setNewMsgCount(n => n + added);
    }
  }, [messages.length]); // eslint-disable-line

  const scrollToBottom = useCallback((behavior) => {
    listRef?.current?.scrollToBottom?.(behavior);
    setShowScrollBtn(false);
    setNewMsgCount(0);
    atBottomRef.current = true;
  }, [listRef]);

  const resetUnread = useCallback(() => {
    setNewMsgCount(0);
  }, []);

  return { showScrollBtn, newMsgCount, scrollToBottom, resetUnread, atBottomRef };
}
