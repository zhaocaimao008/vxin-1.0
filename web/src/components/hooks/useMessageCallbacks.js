/**
 * useMessageCallbacks — MessageItem 内稳定回调（避免每次渲染创建新函数引用）
 * 从 ChatWindow 拆分：处理消息气泡的所有交互事件
 *
 * 背景：ChatWindow 中有 28 个 onClick 内联箭头函数，
 * 这些函数在每次父组件渲染时创建新引用，导致 memo(MessageItem) 失效，
 * 所有可见消息气泡在输入时都重渲染。
 *
 * 本 hook 用 useCallback 稳定所有回调，
 * 配合 cbRef.current 模式传递给 MessageItem（cbRef 本身不变）。
 */
import { useCallback } from 'react';

export function useMessageCallbacks({
  setCtxMenu, setForwardMsg, setForwardMsgs,
  setShowUserProfile, setRedPacketDetail,
  setLightboxState, setVideoPreview,
  setMultiSelect, setSelectedMsgs, selectedMsgs,
  editMsg, copyToClipboard, copyImageToClipboard,
  downloadFile, shareMessage, canShare,
  pinMessage, unpinMessage, transcribeVoice,
  reactToMsg, collectMsg, removeMsg,
  setReplyTo, setEditingMsg, scrollToMsg,
}) {
  // 右键菜单
  const onContextMenu = useCallback((e, msg) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, msg });
  }, [setCtxMenu]);

  // 转发
  const onForward = useCallback((msg) => setForwardMsg(msg), [setForwardMsg]);
  const onForwardMulti = useCallback((msgs) => setForwardMsgs(msgs), [setForwardMsgs]);

  // 用户资料
  const onProfile = useCallback((userId) => setShowUserProfile(userId), [setShowUserProfile]);

  // 图片 / 视频预览
  const onImagePreview = useCallback((urls, idx) => setLightboxState({ urls, idx }), [setLightboxState]);
  const onVideoPreview = useCallback((url, name) => setVideoPreview({ url, name }), [setVideoPreview]);

  // 多选
  const onToggleSelect = useCallback((msgId) => {
    setSelectedMsgs(prev => {
      const next = new Set(prev);
      next.has(msgId) ? next.delete(msgId) : next.add(msgId);
      return next;
    });
  }, [setSelectedMsgs]);

  // 红包
  const onRedPacket = useCallback((detail) => setRedPacketDetail(detail), [setRedPacketDetail]);

  // 回复 / 编辑
  const onReply = useCallback((msg) => setReplyTo(msg), [setReplyTo]);
  const onEdit  = useCallback((msg) => setEditingMsg(msg), [setEditingMsg]);

  // 定位到消息
  const onScrollTo = useCallback((msgId) => scrollToMsg(msgId), [scrollToMsg]);

  return {
    onContextMenu, onForward, onForwardMulti,
    onProfile, onImagePreview, onVideoPreview,
    onToggleSelect, onRedPacket, onReply, onEdit,
    onScrollTo,
  };
}
