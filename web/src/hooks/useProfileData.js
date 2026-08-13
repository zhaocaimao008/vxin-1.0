/**
 * useProfileData — 用户资料数据管理 Hook
 * 从 Profile.jsx 拆分，包含：
 *  - 资料读取 / 编辑 / 头像上传
 *  - 设置读取 / 更新
 *  - 通话记录
 *  - 我的群组
 *  - 邀请码
 */
import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { showToast } from '../utils/toast';

export function useProfileData(user, onUserUpdate) {
  const [profile, setProfile]       = useState(null);
  const [settings, setSettings]     = useState(null);
  const [callLogs, setCallLogs]     = useState([]);
  const [myGroups, setMyGroups]     = useState([]);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);

  // ── 加载资料 ──────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        axios.get('/api/users/me'),
        axios.get('/api/users/settings'),
      ]);
      setProfile(p.data);
      setSettings(s.data);
    } catch { /* 静默 */ }
    finally { setLoading(false); }
  }, [user?.id]);

  // ── 保存资料 ──────────────────────────────────────────────────
  const saveProfile = useCallback(async (fields) => {
    setSaving(true);
    try {
      const { data } = await axios.put('/api/users/profile', fields);
      setProfile(prev => ({ ...prev, ...data }));
      onUserUpdate?.(data);
      showToast('资料已更新', 'success');
      return true;
    } catch (e) {
      showToast(e?.response?.data?.error || '更新失败', 'error');
      return false;
    } finally { setSaving(false); }
  }, [onUserUpdate]);

  // ── 头像上传 ──────────────────────────────────────────────────
  const uploadAvatar = useCallback(async (file) => {
    const form = new FormData();
    form.append('avatar', file);
    setSaving(true);
    try {
      const { data } = await axios.post('/api/users/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfile(prev => ({ ...prev, avatar: data.avatar }));
      onUserUpdate?.({ avatar: data.avatar });
      showToast('头像已更新', 'success');
      return data.avatar;
    } catch (e) {
      showToast(e?.response?.data?.error || '上传失败', 'error');
    } finally { setSaving(false); }
  }, [onUserUpdate]);

  // ── 设置更新 ──────────────────────────────────────────────────
  const saveSettings = useCallback(async (patch) => {
    try {
      await axios.put('/api/users/settings', patch);
      setSettings(prev => ({ ...prev, ...patch }));
    } catch (e) {
      showToast(e?.response?.data?.error || '设置保存失败', 'error');
    }
  }, []);

  // ── 通话记录（懒加载）─────────────────────────────────────────
  const loadCallLogs = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/users/call-logs');
      setCallLogs(data || []);
    } catch { /* 静默 */ }
  }, []);

  // ── 我的群组（懒加载）─────────────────────────────────────────
  const loadMyGroups = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/messages/my-groups');
      setMyGroups(data || []);
    } catch { /* 静默 */ }
  }, []);

  // ── 邀请码（懒加载）──────────────────────────────────────────
  const loadInviteInfo = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/users/invite-info');
      setInviteInfo(data);
    } catch { /* 静默 */ }
  }, []);

  return {
    profile, settings, callLogs, myGroups, inviteInfo,
    loading, saving,
    loadProfile, saveProfile, uploadAvatar,
    saveSettings, loadCallLogs, loadMyGroups, loadInviteInfo,
    setProfile, setSettings,
  };
}
