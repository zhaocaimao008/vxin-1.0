/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs */
/**
 * useGroupData — 群组数据管理 Hook
 * 从 ChatWindow 拆分：群成员、群角色、群公告、群设置 等群专属状态
 *
 * 职责：
 *   - 加载并维护 members / myGroupRole / announcement / groupSettings
 *   - 监听 socket 群变更事件（group_updated / role_changed / group_member_added）
 *   - 对外暴露 refresh() 供主动刷新（如踢人/加人后）
 *
 * 不包含：消息逻辑、上传逻辑、UI 状态（弹窗开关等）
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

export function useGroupData({ conversationId, isGroup, userId, socket }) {
  const [members, setMembers]             = useState([]);
  const [myGroupRole, setMyGroupRole]     = useState('member');
  const [announcement, setAnnouncement]   = useState('');
  const [groupSettings, setGroupSettings] = useState({
    mute_all: 0, no_private_chat: 0, no_add_friend: 0,
  });
  const [canManageGroup, setCanManageGroup] = useState(false);

  const convIdRef = useRef(conversationId);
  convIdRef.current = conversationId;

  const loadMembers = useCallback(async (convId) => {
    if (!convId || !isGroup) return;
    try {
      const { data } = await axios.get(`/api/messages/conversation/${convId}/members`);
      setMembers(data || []);
      const me = (data || []).find(m => m.id === userId);
      const role = me?.role || 'member';
      setMyGroupRole(role);
      setCanManageGroup(role === 'owner' || role === 'admin');
    } catch { /* 静默 */ }
  }, [isGroup, userId]);

  const loadGroupInfo = useCallback(async (convId) => {
    if (!convId || !isGroup) return;
    try {
      const { data } = await axios.get(`/api/messages/conversation/${convId}/info`);
      if (data.announcement !== undefined) setAnnouncement(data.announcement || '');
      if (data.settings) setGroupSettings(data.settings);
    } catch { /* 静默 */ }
  }, [isGroup]);

  // 初始加载 + 会话切换时重置
  useEffect(() => {
    if (!isGroup) {
      setMembers([]); setMyGroupRole('member'); setAnnouncement(''); setCanManageGroup(false);
      setGroupSettings({ mute_all: 0, no_private_chat: 0, no_add_friend: 0 });
      return;
    }
    loadMembers(conversationId);
    loadGroupInfo(conversationId);
  }, [conversationId, isGroup, loadMembers, loadGroupInfo]);

  // 监听群变更 socket 事件
  useEffect(() => {
    if (!socket || !isGroup) return;
    const handleGroupChanged = (data) => {
      if (data?.id === convIdRef.current || data?.conversationId === convIdRef.current) {
        loadMembers(convIdRef.current);
        loadGroupInfo(convIdRef.current);
      }
    };
    socket.on('group_updated',       handleGroupChanged);
    socket.on('group_settings_updated', handleGroupChanged);
    socket.on('role_changed',        handleGroupChanged);
    socket.on('group_member_added',  handleGroupChanged);
    return () => {
      socket.off('group_updated',        handleGroupChanged);
      socket.off('group_settings_updated', handleGroupChanged);
      socket.off('role_changed',         handleGroupChanged);
      socket.off('group_member_added',   handleGroupChanged);
    };
  }, [socket, isGroup, loadMembers, loadGroupInfo]);

  const refresh = useCallback(() => {
    loadMembers(conversationId);
    loadGroupInfo(conversationId);
  }, [conversationId, loadMembers, loadGroupInfo]);

  return { members, myGroupRole, canManageGroup, announcement, setAnnouncement, groupSettings, setGroupSettings, refresh };
}
