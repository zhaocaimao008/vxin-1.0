import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { FixedSizeList } from 'react-window';
import Avatar from './Avatar';
import { mediaUrl } from '../utils/url';
import { showToast, showConfirm } from '../utils/toast';
import { useConvSettings } from '../hooks/useConvSettings';
import { GroupAvatar } from './GroupAvatar';
import { IcoAlert, IcoCampaign, IcoChatOff, IcoCheck, IcoChevronRight, IcoClose, IcoEdit, IcoPhotoCamera, IcoPlus, IcoSearchSm, IcoShield, IcoUserPlus, IcoUsers, IcoVolumeOff } from './Icons';
export { GroupAvatar } from './GroupAvatar'; // re-export 向后兼容

/* ── 群头像上传（管理员 hover 显示相机图标） ── */
function GroupAvatarUpload({ info, isAdmin, uploading, inputRef, onAvatarClick, onChange }) {
  const [hovered, setHovered] = useState(false);
  const [avErr, setAvErr] = useState(false);
  const [prevAvatar, setPrevAvatar] = useState(info.avatar);
  if (info.avatar !== prevAvatar) { setPrevAvatar(info.avatar); setAvErr(false); }
  const r = Math.round(50 * 0.22);
  return (
    <div
      className="gi-av-wrap" style={{ cursor: isAdmin ? 'pointer' : 'default' }}
      role={isAdmin ? 'button' : undefined}
      tabIndex={isAdmin ? 0 : undefined}
      aria-label={isAdmin ? '更换群头像' : undefined}
      onMouseEnter={() => isAdmin && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onAvatarClick}
      onKeyDown={isAdmin ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAvatarClick?.(); } }) : undefined}
      title={isAdmin ? '点击更换群头像' : undefined}
    >
      {info.avatar && !avErr
        ? <img src={mediaUrl(info.avatar)} alt="" loading="lazy" className="gi-av-img" onError={() => setAvErr(true)} style={{ borderRadius: r }} />
        : <GroupAvatar members={info.members} size={50} />
      }
      {isAdmin && (hovered || uploading) && (
        <div className="gi-av-overlay" style={{ borderRadius: r }}>
          {uploading
            ? <span className="gi-av-uploading">上传中…</span>
            : <>
                <IcoPhotoCamera size={18} className="gi-av-icon" />
                <span className="gi-av-hint">更换头像</span>
              </>
          }
        </div>
      )}
      {isAdmin && (
        <input ref={inputRef} type="file" accept="image/*" className="gi-av-input" onChange={onChange} />
      )}
    </div>
  );
}

/* ── 微信风格 Toggle 开关 ── */
function Toggle({ on, onChange, disabled, label }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      aria-disabled={disabled || undefined}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onChange(!on)}
      onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onChange(!on); } }}
      className="gi-toggle"
      style={{ background: on ? 'var(--green)' : 'var(--border-default)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
    >
      <div className="gi-toggle-thumb" style={{ transform: on ? 'translateX(18px)' : 'translateX(0)' }} />
    </div>
  );
}

/* ── 角色标签 ── */
function RoleBadge({ role }) {
  if (role === 'owner') return <span className="gi-badge gi-badge-owner">群主</span>;
  if (role === 'admin') return <span className="gi-badge gi-badge-admin">管理员</span>;
  return null;
}

/* ── 成员行（提升到组件外以保证 react-window 引用稳定）── */
const GroupMemberRow = React.memo(function GroupMemberRow({ index, style, data }) {
  const { filtered, kickSearch, isOwner, isAdmin, currentUserId, toggleAdmin, transferOwner, kickMember } = data;
  const m = filtered[index];
  const q = kickSearch.toLowerCase();
  return (
    // tabIndex：桌面端管理按钮悬停/聚焦才出现，行本身可聚焦才能用键盘触达按钮
    <div className="gi-mi" style={style} tabIndex={isOwner || isAdmin ? 0 : undefined}>
      <Avatar src={m.avatar} name={m.username} size={38} />
      <div className="gi-f1">
        <div className="gi-mn">
          {q && m.username.toLowerCase().includes(q)
            ? (() => {
                // 高亮全部命中(此前只高亮首个);用 q.length 切片,大小写混排也对齐
                const name = m.username;
                const lower = name.toLowerCase();
                const parts = [];
                let from = 0, i = lower.indexOf(q, from);
                while (i >= 0) {
                  if (i > from) parts.push(name.slice(from, i));
                  parts.push(<span key={i} className="gi-search-hl">{name.slice(i, i + q.length)}</span>);
                  from = i + q.length;
                  i = lower.indexOf(q, from);
                }
                if (from < name.length) parts.push(name.slice(from));
                return <>{parts}</>;
              })()
            : m.username
          }
          <RoleBadge role={m.role} />
        </div>
      </div>
      <div className="gi-mi-actions">
      {isOwner && m.role !== 'owner' && (
        <button
          className="gi-btn-admin"
          style={{ color: m.role === 'admin' ? 'var(--text-tertiary)' : 'var(--green)', border: `1px solid ${m.role === 'admin' ? 'var(--border-default)' : 'var(--green)'}` }}
          onClick={() => toggleAdmin(m.id, m.role)}
        >{m.role === 'admin' ? '撤销管理员' : '设为管理员'}</button>
      )}
      {isOwner && m.role !== 'owner' && (
        <button
          className="gi-btn-admin"
          style={{ color: 'var(--green)', border: '1px solid var(--green)' }}
          onClick={() => transferOwner(m.id)}
        >转让群主</button>
      )}
      {isAdmin && m.id !== currentUserId && m.role === 'member' && (
        <button className="gi-btn-kick" onClick={() => kickMember(m.id)}>移出</button>
      )}
      </div>
    </div>
  );
});

/* ── 主组件 ── */
export default function GroupInfo({ conversation, currentUserId, onClose, onLeave, onConvUpdate, onPickBackground, onClearBackground, onCleared, onOpenChatFiles }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [editAnn, setEditAnn] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [annVal, setAnnVal] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [myContacts, setMyContacts] = useState([]);
  const [selectedInvite, setSelectedInvite] = useState(new Set());
  const [togglingMute, setTogglingMute] = useState(false);
  const [togglingNoPrivate, setTogglingNoPrivate] = useState(false);
  const [togglingNoAddFriend, setTogglingNoAddFriend] = useState(false);
  const [togglingMemberInvite, setTogglingMemberInvite] = useState(false);
  // 个人会话设置
  // 免打扰 / 置顶：与 PrivateChatSettings 共用 useConvSettings（state + /mute /pin API）。
  // 原为 mute/pin 各自独立的 toggling 标志，现统一为单个 saving（切换期间两个开关一起禁用，
  // 防跨开关重复提交）；行为与私聊设置面板一致。
  const { muted: myMuted, pinned: myPinned, saving: savingSetting, toggleMute, togglePin } = useConvSettings(conversation, onConvUpdate);
  // 踢人搜索
  const [kickSearch, setKickSearch] = useState('');
  // 群头像上传
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);
  // 群昵称
  const [editNickname, setEditNickname] = useState(false);
  const [nicknameVal, setNicknameVal] = useState('');
  const [myNickname, setMyNickname] = useState(null);
  // 群二维码
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState(null);

  const applyInfo = useCallback((data) => {
    setInfo(data);
    setNameVal(data.name || '');
    setAnnVal(data.announcement || '');
    // 找到自己的群昵称
    const me = (data.members || []).find(m => m.id === currentUserId);
    if (me?.nickname) { setMyNickname(me.nickname); setNicknameVal(me.nickname); }
  }, [currentUserId]);

  // 重新拉取（显示转圈）——供操作后刷新
  const load = useCallback(() => {
    setLoading(true);
    axios.get(`/api/messages/conversation/${conversation.id}/info`)
      .then(r => applyInfo(r.data))
      .finally(() => setLoading(false));
  }, [conversation.id, applyInfo]);

  // 初次挂载 / 切换会话：loading 初值已为 true，effect 内不做同步 setState
  useEffect(() => {
    let alive = true;
    axios.get(`/api/messages/conversation/${conversation.id}/info`)
      .then(r => { if (alive) applyInfo(r.data); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [conversation.id, applyInfo]);

  useEffect(() => {
    const handler = e => {
      if (e.key !== 'Escape') return;
      if (showInvite) { setShowInvite(false); return; }
      if (showQR) { setShowQR(false); return; }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showInvite, showQR]);

  const myRole = info?.myRole || 'member';
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin' || isOwner;
  const isManageable = isAdmin; // 群主和管理员都可以看到群管理

  /* 保存群昵称 */
  const saveNickname = async () => {
    const nick = nicknameVal.trim() || null;
    if (nick === (myNickname || null)) { setEditNickname(false); return; }  // 未改动:不发无谓请求
    try {
      await axios.put(`/api/messages/conversation/${conversation.id}/nickname`, { nickname: nick });
      setMyNickname(nick);
      setEditNickname(false);
    } catch (e) { showToast(e.response?.data?.error || '修改失败', 'error'); }
  };

  /* 加载群二维码 */
  const loadQR = async () => {
    setShowQR(true);
    if (qrData) return;
    try {
      const { data } = await axios.get(`/api/messages/conversation/${conversation.id}/qr-code`);
      setQrData(data);
    } catch { setQrData(null); }
  };

  /* 修改群名 */
  const saveName = async () => {
    const name = nameVal.trim();
    if (!name) { showToast('群名称不能为空', 'error'); return; }   // 此前静默返回,用户不知为何没保存
    if (name === (info?.name || '')) { setEditName(false); return; }  // 未改动:直接收起,不发无谓请求
    try {
      await axios.put(`/api/messages/conversation/${conversation.id}`, { name });
      setInfo(i => ({ ...i, name }));
      setEditName(false);
      onConvUpdate?.({ name });
    } catch (e) { showToast(e.response?.data?.error || '修改群名失败', 'error'); }
  };

  /* 修改群公告 */
  const saveAnn = async () => {
    if (annVal === (info?.announcement || '')) { setEditAnn(false); return; }  // 未改动:不发无谓请求
    try {
      await axios.put(`/api/messages/conversation/${conversation.id}`, { announcement: annVal });
      setInfo(i => ({ ...i, announcement: annVal }));
      setEditAnn(false);
    } catch (e) { showToast(e.response?.data?.error || '修改公告失败', 'error'); }
  };

  /* 切换全群禁言 */
  const toggleMuteAll = async (val) => {
    setTogglingMute(true);
    try {
      const { data } = await axios.put(`/api/messages/conversation/${conversation.id}/manage`, { mute_all: val });
      setInfo(i => ({ ...i, mute_all: data.mute_all }));
      onConvUpdate?.({ mute_all: data.mute_all });
    } catch (e) { showToast(e.response?.data?.error || '操作失败', 'error'); }
    setTogglingMute(false);
  };

  /* 切换禁止私聊 */
  const toggleNoPrivateChat = async (val) => {
    setTogglingNoPrivate(true);
    try {
      const { data } = await axios.put(`/api/messages/conversation/${conversation.id}/manage`, { no_private_chat: val });
      setInfo(i => ({ ...i, no_private_chat: data.no_private_chat }));
      onConvUpdate?.({ no_private_chat: data.no_private_chat });
    } catch (e) { showToast(e.response?.data?.error || '操作失败', 'error'); }
    setTogglingNoPrivate(false);
  };

  /* 切换禁止互加好友 */
  const toggleNoAddFriend = async (val) => {
    setTogglingNoAddFriend(true);
    try {
      const { data } = await axios.put(`/api/messages/conversation/${conversation.id}/manage`, { no_add_friend: val });
      setInfo(i => ({ ...i, no_add_friend: data.no_add_friend }));
      onConvUpdate?.({ no_add_friend: data.no_add_friend });
    } catch (e) { showToast(e.response?.data?.error || '操作失败', 'error'); }
    setTogglingNoAddFriend(false);
  };

  /* 切换普通成员邀请权限 */
  const toggleMemberInvite = async (val) => {
    setTogglingMemberInvite(true);
    try {
      const { data } = await axios.put(`/api/messages/conversation/${conversation.id}/manage`, { member_can_invite: val });
      setInfo(i => ({ ...i, member_can_invite: data.member_can_invite }));
    } catch (e) { showToast(e.response?.data?.error || '操作失败', 'error'); }
    setTogglingMemberInvite(false);
  };

  /* 设置/取消管理员（仅群主） */
  const toggleAdmin = async (uid, currentRole) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    const name = info.members.find(m => m.id === uid)?.username || '未知用户';
    const action = newRole === 'admin' ? `设置「${name}」为管理员` : `撤销「${name}」的管理员`;
    if (!(await showConfirm(action + '？'))) return;
    try {
      await axios.put(`/api/messages/conversation/${conversation.id}/members/${uid}/role`, { role: newRole });
      setInfo(i => ({ ...i, members: i.members.map(m => m.id === uid ? { ...m, role: newRole } : m) }));
    } catch (e) { showToast(e.response?.data?.error || '操作失败', 'error'); }
  };

  /* 转让群主（仅群主） */
  const transferOwner = async (uid) => {
    const name = info.members.find(m => m.id === uid)?.username || '未知用户';
    if (!(await showConfirm(`确认将群主转让给「${name}」？转让后你将成为普通成员。`))) return;
    try {
      await axios.post(`/api/messages/conversation/${conversation.id}/transfer-owner`, { userId: uid });
      setInfo(i => ({
        ...i,
        owner_id: uid,
        myRole: 'member',
        members: i.members.map(m =>
          m.id === uid ? { ...m, role: 'owner' } : (m.role === 'owner' ? { ...m, role: 'member' } : m)
        ),
      }));
    } catch (e) { showToast(e.response?.data?.error || '转让群主失败', 'error'); }
  };

  /* 移出成员 */
  const kickMember = async (uid) => {
    const name = info.members.find(m => m.id === uid)?.username || '未知用户';
    if (!(await showConfirm(`确认移出成员「${name}」？`))) return;
    try {
      await axios.delete(`/api/messages/conversation/${conversation.id}/members/${uid}`);
      setInfo(i => ({ ...i, members: i.members.filter(m => m.id !== uid) }));
    } catch (e) { showToast(e.response?.data?.error || '移出成员失败', 'error'); }
  };

  /* 邀请成员 */
  const openInvite = async () => {
    const { data } = await axios.get('/api/users/contacts');
    const alreadyIn = new Set(info.members.map(m => m.id));
    setMyContacts(data.filter(c => !alreadyIn.has(c.id)));
    setSelectedInvite(new Set());
    setShowInvite(true);
  };
  const doInvite = async () => {
    if (selectedInvite.size === 0) return;
    try {
      const { data } = await axios.post(`/api/messages/conversation/${conversation.id}/invite`, { userIds: [...selectedInvite] });
      setShowInvite(false);
      load();
      // 有好友开启了"不允许直接邀请进群"的隐私保护，友好提示未能全部拉入
      const blocked = Number(data?.blocked) || 0;
      const added = Number(data?.added) || 0;
      if (blocked > 0) {
        showToast(added > 0
          ? `已邀请 ${added} 人；${blocked} 位好友开启了群邀请保护，未能直接拉入`
          : `${blocked} 位好友开启了群邀请保护，请分享群二维码邀请其加入`, 'info');
      }
    } catch (e) { showToast(e.response?.data?.error || '邀请失败', 'error'); }
  };

  /* 退出群聊（非群主）*/
  const leaveGroup = async () => {
    if (!(await showConfirm('确认退出群聊？'))) return;
    try {
      await axios.post(`/api/messages/conversation/${conversation.id}/leave`);
      onLeave?.();
    } catch (e) { showToast(e.response?.data?.error || '退出群聊失败', 'error'); }
  };

  /* 解散群聊（仅群主）*/
  const dissolveGroup = async () => {
    if (!(await showConfirm('解散群聊后所有成员将无法继续聊天，确认解散？'))) return;
    try {
      await axios.post(`/api/messages/conversation/${conversation.id}/dissolve`);
      onLeave?.();
    } catch (e) { showToast(e.response?.data?.error || '解散群聊失败', 'error'); }
  };

  const clearMessages = async () => {
    if (!(await showConfirm(`确认双向删除「${info?.name || conversation.name || '该群聊'}」的全部聊天记录？所有群成员都将看不到这些记录。`))) return;
    try {
      await axios.delete(`/api/messages/conversation/${conversation.id}/messages`);
      onCleared?.();
    } catch (e) { showToast(e.response?.data?.error || '清空聊天记录失败', 'error'); }
  };

  const exportChat = async () => {
    try {
      const { data } = await axios.get(`/api/messages/conversation/${conversation.id}/export`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `聊天记录-${info?.name || conversation.name || conversation.id}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) { showToast(e.response?.data?.error || '导出失败', 'error'); }
  };

  /* 修改群头像 */
  const uploadAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast('仅支持 JPG、PNG、GIF、WebP 格式', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('图片大小不能超过 5MB', 'error');
      e.target.value = '';
      return;
    }
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const { data } = await axios.put(
        `/api/messages/conversation/${conversation.id}/avatar`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setInfo(i => ({ ...i, avatar: data.avatar }));
      onConvUpdate?.({ avatar: data.avatar });
    } catch (err) {
      showToast(err.response?.data?.error || '上传失败', 'error');
    }
    setUploadingAvatar(false);
    e.target.value = '';
  };

  if (loading) return (
    <div className="gi-panel gi-fcd gi-ccc">
      <div className="gi-fcd gi-fca gi-gap8">
        <div className="gi-spinner gi-spinner-green" />
        <span role="status" className="gi-loading-txt">加载中…</span>
      </div>
    </div>
  );
  if (!info) return null;

  return (
    <div className="gi-panel">
      {/* 顶部栏 */}
      <div className="gi-header">
        <span className="gi-title">群聊信息</span>
        <button
          className="gi-close-btn"
          onClick={onClose}
          aria-label="关闭群聊信息"
        ><IcoClose size={16} /></button>
      </div>

      <div className="gi-body">

        {/* 群名称 + 头像 */}
        <div className="gi-avinfo">
          <GroupAvatarUpload
            info={info}
            isAdmin={isAdmin}
            uploading={uploadingAvatar}
            inputRef={avatarInputRef}
            onAvatarClick={() => isAdmin && !uploadingAvatar && avatarInputRef.current?.click()}
            onChange={uploadAvatar}
          />
          <div className="gi-f1">
            {editName ? (
              <div className="gi-fca gi-gap6">
                <input value={nameVal} onChange={e => setNameVal(e.target.value)}
                  className="gi-name-edit" data-testid="group-rename-input" maxLength={30}
                  aria-label="群名称" autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditName(false); }} />
                <button className="gi-btn-edit" data-testid="group-rename-save" onClick={saveName}>保存</button>
                <button className="gi-btn-xl" onClick={() => setEditName(false)}>取消</button>
              </div>
            ) : (
              <div className="gi-name-row">
                <span className="gi-name">{info.name}</span>
                {isAdmin && <button className="gi-btn-name" onClick={() => setEditName(true)} aria-label="修改群名称"><IcoEdit size={14} /></button>}
              </div>
            )}
            <div className="gi-meta">
              {info.members.length} 位成员
              {info.group_number && <span className="gi-ml8">群号：{info.group_number}</span>}
            </div>
          </div>
        </div>

        {/* 群公告 */}
        <div className="gi-section gi-section-pad">
          <div className="gi-fcsb" style={{ marginBottom: editAnn ? 8 : 6 }}>
            <div className="gi-fca gi-gap5">
              <IcoCampaign size={14} className="gi-s14 gi-ann-icon" />
              <span className="gi-sec-tit">群公告</span>
            </div>
            {isAdmin && !editAnn && (
              <button className="gi-btn-edit" onClick={() => setEditAnn(true)}>编辑</button>
            )}
          </div>
          {editAnn ? (
            <>
              <textarea value={annVal} onChange={e => setAnnVal(e.target.value)}
                className="gi-ann-textarea" maxLength={500}
                autoFocus placeholder="填写群公告…" aria-label="群公告"
                onKeyDown={e => { if (e.key === 'Escape') setEditAnn(false); }} />
              <div className="gi-ann-bar">
                <button className="gi-btn-cancel" onClick={() => setEditAnn(false)}>取消</button>
                <button className="gi-btn-save" onClick={saveAnn}>保存</button>
              </div>
            </>
          ) : (
            <div className={info.announcement ? 'gi-t13 gi-ann-preview' : 'gi-t13m gi-ann-preview'}>
              {info.announcement || '暂无群公告，点击"编辑"添加'}
            </div>
          )}
        </div>

        {/* ── 群管理（群主和管理员可见，钉钉对标设计） ── */}
        {isManageable && (
          <div className="gi-section">
            <div
              className="gi-row gi-mg-click"
              role="button"
              tabIndex={0}
              aria-label="群管理"
              aria-expanded={showManage}
              onClick={() => setShowManage(v => !v)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowManage(v => !v); } }}
            >
              <div className="gi-ic30 gi-ic-mg-header">
                <IcoShield size={16} className="gi-s16" />
              </div>
              <div className="gi-f1">
                <span className="gi-text14 gi-fw5">群管理</span>
                {!!(info.mute_all || info.no_private_chat || info.no_add_friend) && (
                  <div className="gi-mg-active">
                    {[info.mute_all && '全员禁言', info.no_private_chat && '禁止私聊', info.no_add_friend && '禁止互加好友'].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <IcoChevronRight size={14} className="gi-s14 gi-chevron" style={{ transform: showManage ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
            </div>

            {showManage && (
              <div className="gi-mg-bg">
                {/* 全员禁言 */}
                <div className="gi-mg-row">
                  <div className="gi-ic28 gi-ic-mg1">
                    <IcoVolumeOff size={14} className="gi-s14" />
                  </div>
                  <div className="gi-f1">
                    <div className="gi-mg-label">全员禁言</div>
                    <div className="gi-mg-desc">开启后，只有群主和管理员可以发消息</div>
                  </div>
                  <Toggle on={!!info.mute_all} onChange={toggleMuteAll} disabled={togglingMute} label="全员禁言" />
                </div>

                {/* 禁止私聊 */}
                <div className="gi-mg-row">
                  <div className="gi-ic28 gi-ic-mg2">
                    <IcoChatOff size={14} className="gi-s14" />
                  </div>
                  <div className="gi-f1">
                    <div className="gi-mg-label">禁止私聊</div>
                    <div className="gi-mg-desc">开启后，普通成员无法与群成员私信</div>
                  </div>
                  <Toggle on={!!info.no_private_chat} onChange={toggleNoPrivateChat} disabled={togglingNoPrivate} label="禁止私聊" />
                </div>

                {/* 禁止群成员互相添加好友 */}
                <div className="gi-mg-row-last">
                  <div className="gi-ic28 gi-ic-mg3">
                    <IcoUserPlus size={14} className="gi-s14" />
                  </div>
                  <div className="gi-f1">
                    <div className="gi-mg-label">禁止群成员互相添加好友</div>
                    <div className="gi-mg-desc">开启后，群成员不可通过本群互加好友</div>
                  </div>
                  <Toggle on={!!info.no_add_friend} onChange={toggleNoAddFriend} disabled={togglingNoAddFriend} label="禁止群成员互相添加好友" />
                </div>

                {/* 允许普通成员邀请 */}
                <div className="gi-mg-row-last">
                  <div className="gi-ic28 gi-ic-mg3">
                    <IcoUsers size={14} className="gi-s14" />
                  </div>
                  <div className="gi-f1">
                    <div className="gi-mg-label">允许普通成员邀请</div>
                    <div className="gi-mg-desc">开启后，普通成员可以邀请好友进群</div>
                  </div>
                  <Toggle on={!!info.member_can_invite} onChange={toggleMemberInvite} disabled={togglingMemberInvite} label="允许普通成员邀请" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 状态提示条（非管理员时展示当前限制） */}
        {!isAdmin && !!(info.mute_all || info.no_private_chat || info.no_add_friend) && (
          <div className="gi-warn">
            {!!info.mute_all && (
              <div className="gi-warn-row">
                <IcoVolumeOff size={12} className="gi-s12 gi-warn-icon" />
                全员禁言已开启，您当前无法发送消息
              </div>
            )}
            {!!info.no_private_chat && (
              <div className="gi-warn-row">
                <IcoAlert size={12} className="gi-s12 gi-warn-icon" />
                禁止私聊已开启，您无法与群成员私信
              </div>
            )}
            {!!info.no_add_friend && (
              <div className="gi-warn-row">
                <IcoAlert size={12} className="gi-s12 gi-warn-icon" />
                禁止互加好友已开启，不可通过本群添加群成员为好友
              </div>
            )}
          </div>
        )}

        {/* 群成员列表 */}
        <div className="gi-section">
          {/* 标题行 + 搜索框 */}
          <div className="gi-ml-head">
            <div className="gi-fcsb gi-ml-last">
              <span className="gi-grp-tit">
                群成员 ({info.members.length})
              </span>
            </div>
            {/* 仅管理员显示搜索框（用于快速找人踢出） */}
            {isAdmin && (
              <div className="gi-ml-search">
                <IcoSearchSm size={13} className="gi-s13 gi-search-icon" />
                <input
                  value={kickSearch}
                  onChange={e => setKickSearch(e.target.value)}
                  placeholder="搜索成员…"
                  aria-label="搜索成员"
                  className="gi-ml-si"
                />
                {kickSearch && (
                  <button className="gi-clear-search" onClick={() => setKickSearch('')} aria-label="清空搜索"><IcoClose size={14} /></button>
                )}
              </div>
            )}
          </div>

          <div className="gi-ml-body">
            {/* 邀请按钮：管理员始终可见；普通成员需群开启了允许成员邀请 */}
            {!kickSearch && (isAdmin || !!info.member_can_invite) && (
              <div className="gi-inv-row" role="button" tabIndex={0} onClick={openInvite} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInvite(); } }}>
                <div className="gi-inv-box"><IcoPlus size={22} /></div>
                <span className="gi-inv-txt">邀请成员</span>
              </div>
            )}

            {/* 成员列表（支持搜索过滤；>50 人时虚拟化渲染） */}
            {(() => {
              const q = kickSearch.toLowerCase();
              const filtered = kickSearch
                ? info.members.filter(m => m.username.toLowerCase().includes(q))
                : info.members;
              if (kickSearch && filtered.length === 0) {
                return <div className="gi-no-match">未找到匹配成员</div>;
              }
              const itemData = { filtered, kickSearch, isOwner, isAdmin, currentUserId, toggleAdmin, transferOwner, kickMember };
              if (filtered.length > 50) {
                return (
                  <FixedSizeList
                    height={Math.min(filtered.length * 52, 400)}
                    itemCount={filtered.length}
                    itemSize={52}
                    width="100%"
                    itemData={itemData}
                  >
                    {GroupMemberRow}
                  </FixedSizeList>
                );
              }
              return filtered.map((m, index) => (
                <GroupMemberRow key={m.id} index={index} style={{}} data={itemData} />
              ));
            })()}
          </div>
        </div>

        {/* 个人设置 */}
        <div className="gi-section">
          <div className="gi-row" style={{ cursor: 'pointer' }} role="button" tabIndex={0} onClick={() => onOpenChatFiles?.()} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenChatFiles?.(); } }}>
            <span className="gi-label">聊天文件</span>
            <IcoChevronRight size={14} className="gi-s14 gi-chevron" />
          </div>
          <div className="gi-row">
            <span className="gi-label">消息免打扰</span>
            <Toggle
              label="消息免打扰"
              on={myMuted}
              disabled={savingSetting}
              onChange={toggleMute}
            />
          </div>
          <div className="gi-row">
            <span className="gi-label">置顶聊天</span>
            <Toggle
              label="置顶聊天"
              on={myPinned}
              disabled={savingSetting}
              onChange={togglePin}
            />
          </div>
          <div className={`gi-row${conversation.background ? '' : ' gi-row-noborder'}`} style={{ cursor: 'pointer' }} role="button" tabIndex={0} onClick={() => onPickBackground?.()} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickBackground?.(); } }}>
            <span className="gi-label">设置聊天背景</span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm2)' }}>{conversation.background ? '更换' : '选择图片'} <IcoChevronRight size={16} style={{ verticalAlign: '-3px' }} /></span>
          </div>
          {conversation.background && (
            <div className="gi-row gi-row-noborder" style={{ cursor: 'pointer' }} role="button" tabIndex={0} onClick={() => onClearBackground?.()} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClearBackground?.(); } }}>
              <span className="gi-label" style={{ color: 'var(--color-badge)' }}>清除聊天背景</span>
            </div>
          )}
        </div>

        {/* 群昵称 */}
        <div className="gi-nk">
          <div className="gi-nk-hd">我在本群的昵称</div>
          <div className="gi-nk-bd">
            {editNickname ? (
              <>
                <input
                  autoFocus
                  value={nicknameVal}
                  onChange={e => setNicknameVal(e.target.value)}
                  placeholder="设置群昵称（最多30字）"
                  maxLength={30}
                  aria-label="群昵称"
                  className="gi-nick-input"
                  onKeyDown={e => { if (e.key === 'Enter') saveNickname(); if (e.key === 'Escape') setEditNickname(false); }}
                />
                <button className="gi-btn-save-sm" onClick={saveNickname}>保存</button>
                <button className="gi-btn-xl-sm" onClick={() => setEditNickname(false)}>取消</button>
              </>
            ) : (
              <div className="gi-f1 gi-fcsb gi-nk-cp" role="button" tabIndex={0} onClick={() => { setNicknameVal(myNickname || ''); setEditNickname(true); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setNicknameVal(myNickname || ''); setEditNickname(true); } }}>
                <span style={{ fontSize: 'var(--text-base)', color: myNickname ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{myNickname || '未设置'}</span>
                <IcoChevronRight size={14} className="gi-s14 gi-chevron" />
              </div>
            )}
          </div>
        </div>

        {/* 群二维码 */}
        <div className="gi-qr">
          <div className="gi-qr-row" role="button" tabIndex={0} onClick={loadQR} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadQR(); } }}>
            <span className="gi-text14">群二维码</span>
            <IcoChevronRight size={14} className="gi-s14 gi-chevron" />
          </div>
        </div>

        {/* 导出聊天记录 */}
        <div className="gi-qr">
          <div className="gi-qr-row" role="button" tabIndex={0} onClick={exportChat} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); exportChat(); } }}>
            <span className="gi-text14">导出聊天记录</span>
            <IcoChevronRight size={14} className="gi-s14 gi-chevron" />
          </div>
        </div>

        {/* 操作按钮区 */}
        <div className="gi-actions">
          <button onClick={clearMessages} className="gi-btn-danger">
            双向删除聊天记录
          </button>
          {isOwner ? (
            <button onClick={dissolveGroup} data-testid="group-dissolve-btn" className="gi-btn-danger">
              解散群聊
            </button>
          ) : (
            <button onClick={leaveGroup} data-testid="group-leave-btn" className="gi-btn-danger">
              退出群聊
            </button>
          )}
        </div>
      </div>

      {/* 群二维码弹窗 */}
      {showQR && (
        <div className="wc-modal-overlay" onClick={e => e.target === e.currentTarget && setShowQR(false)}>
          <div className="wc-modal gi-qr-panel" role="dialog" aria-modal="true" aria-label="群二维码">
            <div className="wc-modal-header">
              <span className="wc-modal-title">群二维码</span>
              <button className="wc-modal-close" onClick={() => setShowQR(false)} aria-label="关闭二维码"><IcoClose size={18} /></button>
            </div>
            <div className="gi-qr-wrap">
              {qrData ? (
                <>
                  <img loading="lazy" src={qrData.qrCode} alt="群二维码" className="gi-qr-img" />
                  <div className="gi-qr-nm">扫码加入 {info?.name}</div>
                  <div className="gi-qr-ex">7天内有效</div>
                  <button
                    className="gi-save-btn"
                    onClick={async () => {
                      try {
                        const resp = await fetch(qrData.qrCode);
                        const blob = await resp.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${info?.name || '群'}_邀请码.png`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch {
                        // 跨域下载失败时，尝试在新窗口打开
                        window.open(qrData.qrCode, '_blank');
                      }
                    }}
                  >保存图片</button>
                </>
              ) : (
                <div className="gi-qr-load">加载中…</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 邀请成员弹窗 */}
      {showInvite && (
        <div className="wc-modal-overlay" onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="wc-modal wide" role="dialog" aria-modal="true" aria-label="邀请成员">
            <div className="wc-modal-header">
              <span className="wc-modal-title">邀请成员</span>
              <button className="wc-modal-close" onClick={() => setShowInvite(false)} aria-label="关闭邀请"><IcoClose size={18} /></button>
            </div>
            <div className="wc-modal-body">
              <div className="gi-inv-hint">从通讯录选择（已选 {selectedInvite.size} 人）</div>
              <div className="gi-inv-list">
                {myContacts.length === 0
                  ? <div className="gi-inv-empty">所有好友已在群内</div>
                  : myContacts.map(c => (
                    <div key={c.id} className="wc-group-member-item" role="checkbox" tabIndex={0} aria-checked={selectedInvite.has(c.id)} onClick={() => setSelectedInvite(prev => { const s = new Set(prev); s.has(c.id) ? s.delete(c.id) : s.add(c.id); return s; })} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelectedInvite(prev => { const s = new Set(prev); s.has(c.id) ? s.delete(c.id) : s.add(c.id); return s; })}>
                      <div className={`wc-group-check${selectedInvite.has(c.id) ? ' checked' : ''}`}>{selectedInvite.has(c.id) ? <IcoCheck size={14} /> : null}</div>
                      <Avatar src={c.avatar} name={c.remark || c.username} size={36} />
                      <span className="gi-inv-name">{c.remark || c.username}</span>
                    </div>
                  ))
                }
              </div>
            </div>
            <div className="wc-modal-footer">
              <button className="wc-modal-btn secondary" onClick={() => setShowInvite(false)}>取消</button>
              <button className="wc-modal-btn primary" onClick={doInvite} disabled={selectedInvite.size === 0}>邀请 ({selectedInvite.size})</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
