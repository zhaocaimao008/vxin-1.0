import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import { mediaUrl } from '../utils/url';

/* ── 群头像拼图（微信风格 N宫格，支持自定义头像） ── */
export function GroupAvatar({ members = [], size = 46, avatar = '' }) {
  // 有自定义群头像直接显示
  if (avatar) {
    return <img src={mediaUrl(avatar)} alt="" style={{ width: size, height: size, borderRadius: Math.round(size * 0.22), objectFit: 'cover', flexShrink: 0 }} />;
  }
  const n = Math.min(members.length, 9);
  if (n === 0) return <Avatar name="群" size={size} />;
  if (n === 1) return <Avatar src={members[0].avatar} name={members[0].username} size={size} />;
  const grid = n <= 4 ? 2 : 3;
  const cellSize = Math.floor((size - (grid + 1) * 2) / grid);
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.22), background: '#DCDCDC', display: 'grid', overflow: 'hidden', gridTemplateColumns: `repeat(${grid}, ${cellSize}px)`, gap: 2, padding: 2, flexShrink: 0 }}>
      {members.slice(0, grid * grid).map((m, i) => (
        <div key={i} style={{ width: cellSize, height: cellSize, borderRadius: 2, overflow: 'hidden', background: '#C0C0C0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {m.avatar ? <img src={mediaUrl(m.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: cellSize * 0.45, fontWeight: 600, color: '#fff' }}>{(m.username || '?')[0]}</span>}
        </div>
      ))}
    </div>
  );
}

/* ── 群头像上传（管理员 hover 显示相机图标） ── */
function GroupAvatarUpload({ info, isAdmin, uploading, inputRef, onAvatarClick, onChange }) {
  const [hovered, setHovered] = useState(false);
  const r = Math.round(50 * 0.22);
  return (
    <div
      style={{ position: 'relative', flexShrink: 0, cursor: isAdmin ? 'pointer' : 'default', width: 50, height: 50 }}
      onMouseEnter={() => isAdmin && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onAvatarClick}
      title={isAdmin ? '点击更换群头像' : undefined}
    >
      {info.avatar
        ? <img src={mediaUrl(info.avatar)} alt="" style={{ width: 50, height: 50, borderRadius: r, objectFit: 'cover', display: 'block' }} />
        : <GroupAvatar members={info.members} size={50} />
      }
      {isAdmin && (hovered || uploading) && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: r,
          background: 'rgba(0,0,0,.42)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
        }}>
          {uploading
            ? <span style={{ color: '#fff', fontSize: 9, lineHeight: 1 }}>上传中…</span>
            : <>
                <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: '#fff' }}>
                  <path d="M12 15.2A3.2 3.2 0 0 1 8.8 12 3.2 3.2 0 0 1 12 8.8a3.2 3.2 0 0 1 3.2 3.2 3.2 3.2 0 0 1-3.2 3.2M20 4h-3.17L15 2H9L7.17 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
                </svg>
                <span style={{ color: '#fff', fontSize: 8, lineHeight: 1 }}>更换头像</span>
              </>
          }
        </div>
      )}
      {isAdmin && (
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onChange} />
      )}
    </div>
  );
}

/* ── 微信风格 Toggle 开关 ── */
function Toggle({ on, onChange, disabled }) {
  return (
    <div
      onClick={() => !disabled && onChange(!on)}
      style={{
        width: 44, height: 26, borderRadius: 13, flexShrink: 0,
        background: on ? '#07C160' : '#D8D8D8',
        position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s', opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: on ? 21 : 3,
        width: 20, height: 20, borderRadius: 10, background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        transition: 'left 0.18s cubic-bezier(.2,0,.38,.9)',
      }} />
    </div>
  );
}

/* ── 角色标签 ── */
function RoleBadge({ role }) {
  if (role === 'owner') return <span style={{ fontSize: 10, color: '#FF7A00', background: '#FFF0E0', padding: '1px 5px', borderRadius: 3, marginLeft: 5, fontWeight: 500 }}>群主</span>;
  if (role === 'admin') return <span style={{ fontSize: 10, color: '#07C160', background: '#E8F5E9', padding: '1px 5px', borderRadius: 3, marginLeft: 5, fontWeight: 500 }}>管理员</span>;
  return null;
}

/* ── 主组件 ── */
export default function GroupInfo({ conversation, currentUserId, onClose, onLeave, onConvUpdate, onCleared }) {
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
  // 个人会话设置
  const [myMuted, setMyMuted] = useState(!!conversation.muted);
  const [myPinned, setMyPinned] = useState(!!conversation.pinned);
  const [togglingMyMute, setTogglingMyMute] = useState(false);
  const [togglingMyPin, setTogglingMyPin] = useState(false);
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

  const load = () => {
    setLoading(true);
    axios.get(`/api/messages/conversation/${conversation.id}/info`).then(r => {
      setInfo(r.data);
      setNameVal(r.data.name || '');
      setAnnVal(r.data.announcement || '');
      // 找到自己的群昵称
      const me = (r.data.members || []).find(m => m.id === currentUserId);
      if (me?.nickname) { setMyNickname(me.nickname); setNicknameVal(me.nickname); }
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [conversation.id]);

  const myRole = info?.myRole || 'member';
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin' || isOwner;
  const isManageable = isAdmin; // 群主和管理员都可以看到群管理

  /* 保存群昵称 */
  const saveNickname = async () => {
    try {
      await axios.put(`/api/messages/conversation/${conversation.id}/nickname`, { nickname: nicknameVal.trim() || null });
      setMyNickname(nicknameVal.trim() || null);
      setEditNickname(false);
    } catch (e) { alert(e.response?.data?.error || '修改失败'); }
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
    if (!nameVal.trim()) return;
    await axios.put(`/api/messages/conversation/${conversation.id}`, { name: nameVal.trim() });
    setInfo(i => ({ ...i, name: nameVal.trim() }));
    setEditName(false);
    onConvUpdate?.({ name: nameVal.trim() });
  };

  /* 修改群公告 */
  const saveAnn = async () => {
    await axios.put(`/api/messages/conversation/${conversation.id}`, { announcement: annVal });
    setInfo(i => ({ ...i, announcement: annVal }));
    setEditAnn(false);
  };

  /* 切换全群禁言 */
  const toggleMuteAll = async (val) => {
    setTogglingMute(true);
    try {
      const { data } = await axios.put(`/api/messages/conversation/${conversation.id}/manage`, { mute_all: val });
      setInfo(i => ({ ...i, mute_all: data.mute_all }));
      onConvUpdate?.({ mute_all: data.mute_all });
    } catch (e) { alert(e.response?.data?.error || '操作失败'); }
    setTogglingMute(false);
  };

  /* 切换禁止私聊 */
  const toggleNoPrivateChat = async (val) => {
    setTogglingNoPrivate(true);
    try {
      const { data } = await axios.put(`/api/messages/conversation/${conversation.id}/manage`, { no_private_chat: val });
      setInfo(i => ({ ...i, no_private_chat: data.no_private_chat }));
      onConvUpdate?.({ no_private_chat: data.no_private_chat });
    } catch (e) { alert(e.response?.data?.error || '操作失败'); }
    setTogglingNoPrivate(false);
  };

  /* 切换禁止互加好友 */
  const toggleNoAddFriend = async (val) => {
    setTogglingNoAddFriend(true);
    try {
      const { data } = await axios.put(`/api/messages/conversation/${conversation.id}/manage`, { no_add_friend: val });
      setInfo(i => ({ ...i, no_add_friend: data.no_add_friend }));
      onConvUpdate?.({ no_add_friend: data.no_add_friend });
    } catch (e) { alert(e.response?.data?.error || '操作失败'); }
    setTogglingNoAddFriend(false);
  };

  /* 设置/取消管理员（仅群主） */
  const toggleAdmin = async (uid, currentRole) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    const name = info.members.find(m => m.id === uid)?.username || '未知用户';
    const action = newRole === 'admin' ? `设置「${name}」为管理员` : `撤销「${name}」的管理员`;
    if (!confirm(action + '？')) return;
    await axios.put(`/api/messages/conversation/${conversation.id}/members/${uid}/role`, { role: newRole });
    setInfo(i => ({ ...i, members: i.members.map(m => m.id === uid ? { ...m, role: newRole } : m) }));
  };

  /* 移出成员 */
  const kickMember = async (uid) => {
    const name = info.members.find(m => m.id === uid)?.username || '未知用户';
    if (!confirm(`确认移出成员「${name}」？`)) return;
    await axios.delete(`/api/messages/conversation/${conversation.id}/members/${uid}`);
    setInfo(i => ({ ...i, members: i.members.filter(m => m.id !== uid) }));
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
    await axios.post(`/api/messages/conversation/${conversation.id}/invite`, { userIds: [...selectedInvite] });
    setShowInvite(false);
    load();
  };

  /* 退出/解散 */
  const leaveGroup = async () => {
    const msg = isOwner ? '解散群聊后所有成员将无法继续聊天，确认解散？' : '确认退出群聊？';
    if (!confirm(msg)) return;
    await axios.post(`/api/messages/conversation/${conversation.id}/leave`);
    onLeave?.();
  };

  const clearMessages = async () => {
    if (!confirm(`确认双向删除「${info?.name || conversation.name || '该群聊'}」的全部聊天记录？所有群成员都将看不到这些记录。`)) return;
    await axios.delete(`/api/messages/conversation/${conversation.id}/messages`);
    onCleared?.();
  };

  /* 修改群头像 */
  const uploadAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
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
      alert(err.response?.data?.error || '上传失败');
    }
    setUploadingAvatar(false);
    e.target.value = '';
  };

  /* ── section 样式 ── */
  const S = {
    panel:       { width: 286, borderLeft: '1px solid var(--border-color)', background: 'var(--bg-panel)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 },
    header:      { padding: '0 14px', height: 52, background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    section:     { background: 'var(--bg-msg-other)', marginBottom: 8, borderRadius: 0 },
    sectionHeader: { padding: '7px 14px 5px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '.4px', textTransform: 'uppercase' },
    row:         { display: 'flex', alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid var(--border-color)', gap: 10 },
    rowLast:     { display: 'flex', alignItems: 'center', padding: '11px 14px', gap: 10 },
    rowLabel:    { flex: 1, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.4 },
    rowSub:      { fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.4 },
    closeBtn:    { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 14, cursor: 'pointer', borderRadius: 4, transition: 'background .12s' },
  };

  if (loading) return (
    <div style={{ ...S.panel, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, border: '2px solid var(--border-color)', borderTopColor: '#07C160', borderRadius: '50%', animation: 'wc-spin .7s linear infinite' }} />
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>加载中…</span>
      </div>
    </div>
  );
  if (!info) return null;

  return (
    <div style={S.panel}>
      {/* 顶部栏 */}
      <div style={S.header}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '.2px' }}>群聊信息</span>
        <button
          style={S.closeBtn}
          onClick={onClose}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* 群名称 + 头像 */}
        <div style={{ background: 'var(--bg-msg-other)', padding: '16px 14px 14px', display: 'flex', gap: 13, alignItems: 'center', marginBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
          <GroupAvatarUpload
            info={info}
            isAdmin={isAdmin}
            uploading={uploadingAvatar}
            inputRef={avatarInputRef}
            onAvatarClick={() => isAdmin && !uploadingAvatar && avatarInputRef.current?.click()}
            onChange={uploadAvatar}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            {editName ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input value={nameVal} onChange={e => setNameVal(e.target.value)}
                  style={{ flex: 1, fontSize: 14, border: '1px solid #07C160', borderRadius: 5, padding: '4px 8px', outline: 'none', color: 'var(--text-primary)', background: 'var(--bg-input)' }}
                  autoFocus onKeyDown={e => e.key === 'Enter' && saveName()} />
                <button style={{ color: '#07C160', fontSize: 12, fontWeight: 500 }} onClick={saveName}>保存</button>
                <button style={{ color: 'var(--text-tertiary)', fontSize: 12 }} onClick={() => setEditName(false)}>取消</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.name}</span>
                {isAdmin && <button style={{ color: 'var(--text-tertiary)', fontSize: 13, flexShrink: 0, padding: '0 2px' }} onClick={() => setEditName(true)}>✎</button>}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
              {info.members.length} 位成员
              {info.group_number && <span style={{ marginLeft: 8 }}>群号：{info.group_number}</span>}
            </div>
          </div>
        </div>

        {/* 群公告 */}
        <div style={{ ...S.section, padding: '12px 14px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editAnn ? 8 : 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: '#FA8C16', flexShrink: 0 }}>
                <path d="M18 11v2H6v-2h12zm-6-7L6.35 7H4v10h2.35L12 20l5.65-3H20V7h-2.35L12 4zm4 13.02l-4 2.26-4-2.26V9h8v8.02z"/>
              </svg>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '.2px' }}>群公告</span>
            </div>
            {isAdmin && !editAnn && (
              <button style={{ fontSize: 12, color: '#07C160', fontWeight: 500 }} onClick={() => setEditAnn(true)}>编辑</button>
            )}
          </div>
          {editAnn ? (
            <>
              <textarea value={annVal} onChange={e => setAnnVal(e.target.value)}
                style={{ width: '100%', height: 72, border: '1px solid var(--border-color)', borderRadius: 5, padding: '7px 10px', fontSize: 13, resize: 'none', outline: 'none', color: 'var(--text-primary)', background: 'var(--bg-input)', lineHeight: 1.6 }}
                autoFocus placeholder="填写群公告…" />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button style={{ flex: 1, padding: '7px', background: 'var(--bg-search)', borderRadius: 5, fontSize: 13, color: 'var(--text-secondary)' }} onClick={() => setEditAnn(false)}>取消</button>
                <button style={{ flex: 1, padding: '7px', background: '#07C160', color: '#fff', borderRadius: 5, fontSize: 13, fontWeight: 500 }} onClick={saveAnn}>保存</button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: info.announcement ? 'var(--text-primary)' : 'var(--text-tertiary)', lineHeight: 1.65, maxHeight: 70, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {info.announcement || '暂无群公告，点击"编辑"添加'}
            </div>
          )}
        </div>

        {/* ── 群管理（群主和管理员可见，钉钉对标设计） ── */}
        {isManageable && (
          <div style={{ ...S.section, marginBottom: 8 }}>
            <div
              style={{ ...S.row, cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setShowManage(v => !v)}
            >
              <div style={{ width: 30, height: 30, borderRadius: 7, background: 'linear-gradient(135deg,#FF9500,#FF6B00)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: '#fff' }}>
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5z"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>群管理</span>
                {(info.mute_all || info.no_private_chat || info.no_add_friend) && (
                  <div style={{ fontSize: 11, color: '#FA8C16', marginTop: 1 }}>
                    {[info.mute_all && '全员禁言', info.no_private_chat && '禁止私聊', info.no_add_friend && '禁止互加好友'].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: '#C7C7CC', flexShrink: 0, transform: showManage ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </div>

            {showManage && (
              <div style={{ background: 'var(--bg-search)', borderTop: '1px solid var(--border-color)' }}>
                {/* 全员禁言 */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border-color)', gap: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 5, background: '#FFF0E0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: '#FA8C16' }}><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>全员禁言</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1 }}>开启后，只有群主和管理员可以发消息</div>
                  </div>
                  <Toggle on={!!info.mute_all} onChange={toggleMuteAll} disabled={togglingMute} />
                </div>

                {/* 禁止私聊 */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border-color)', gap: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 5, background: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: '#07C160' }}><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>禁止私聊</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1 }}>开启后，普通成员无法与群成员私信</div>
                  </div>
                  <Toggle on={!!info.no_private_chat} onChange={toggleNoPrivateChat} disabled={togglingNoPrivate} />
                </div>

                {/* 禁止群成员互相添加好友 */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 5, background: '#FFF0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: '#FA5151' }}><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>禁止群成员互相添加好友</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1 }}>开启后，群成员不可通过本群互加好友</div>
                  </div>
                  <Toggle on={!!info.no_add_friend} onChange={toggleNoAddFriend} disabled={togglingNoAddFriend} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 状态提示条（非管理员时展示当前限制） */}
        {!isAdmin && (info.mute_all || info.no_private_chat || info.no_add_friend) && (
          <div style={{ margin: '0 0 8px', background: '#FFFBEF', borderTop: '1px solid #FFE082', borderBottom: '1px solid #FFE082', padding: '9px 14px' }}>
            {info.mute_all && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#9E6A00', lineHeight: 1.65 }}>
                <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: '#FA8C16', flexShrink: 0 }}><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                全员禁言已开启，您当前无法发送消息
              </div>
            )}
            {info.no_private_chat && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#9E6A00', lineHeight: 1.65 }}>
                <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: '#FA8C16', flexShrink: 0 }}><path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1zm-1 5h2v6h-2zm0 8h2v2h-2z"/></svg>
                禁止私聊已开启，您无法与群成员私信
              </div>
            )}
            {info.no_add_friend && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#9E6A00', lineHeight: 1.65 }}>
                <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: '#FA8C16', flexShrink: 0 }}><path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1zm-1 5h2v6h-2zm0 8h2v2h-2z"/></svg>
                禁止互加好友已开启，不可通过本群添加群成员为好友
              </div>
            )}
          </div>
        )}

        {/* 群成员列表 */}
        <div style={{ ...S.section, marginBottom: 8 }}>
          {/* 标题行 + 搜索框 */}
          <div style={{ padding: '9px 14px 0', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '.3px' }}>
                群成员 ({info.members.length})
              </span>
            </div>
            {/* 仅管理员显示搜索框（用于快速找人踢出） */}
            {isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg-search)', borderRadius: 5, padding: '4px 8px', marginBottom: 8 }}>
                <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, fill: 'var(--text-tertiary)', flexShrink: 0 }}>
                  <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <input
                  value={kickSearch}
                  onChange={e => setKickSearch(e.target.value)}
                  placeholder="搜索成员…"
                  style={{ flex: 1, fontSize: 12, background: 'transparent', color: 'var(--text-primary)' }}
                />
                {kickSearch && (
                  <button style={{ color: '#ADADAD', fontSize: 13, lineHeight: 1 }} onClick={() => setKickSearch('')}>✕</button>
                )}
              </div>
            )}
          </div>

          <div style={{ padding: '4px 8px' }}>
            {/* 邀请按钮（搜索时隐藏） */}
            {!kickSearch && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 6px', cursor: 'pointer', borderRadius: 6 }} onClick={openInvite}>
                <div style={{ width: 38, height: 38, borderRadius: 7, border: '1.5px dashed #07C160', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#07C160', fontSize: 20 }}>+</div>
                <span style={{ fontSize: 13, color: '#07C160' }}>邀请成员</span>
              </div>
            )}

            {/* 成员列表（支持搜索过滤） */}
            {(() => {
              const q = kickSearch.toLowerCase();
              const filtered = kickSearch
                ? info.members.filter(m => m.username.toLowerCase().includes(q))
                : info.members;
              if (kickSearch && filtered.length === 0) {
                return <div style={{ textAlign: 'center', padding: '16px 0', color: '#B2B2B2', fontSize: 13 }}>未找到匹配成员</div>;
              }
              return filtered.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 6px', borderRadius: 6 }}>
                  <Avatar src={m.avatar} name={m.username} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                      {/* 搜索时高亮匹配字符 */}
                      {kickSearch && m.username.toLowerCase().includes(kickSearch.toLowerCase())
                        ? (() => {
                            const idx = m.username.toLowerCase().indexOf(kickSearch.toLowerCase());
                            return (
                              <>
                                {m.username.slice(0, idx)}
                                <span style={{ color: '#07C160', fontWeight: 600 }}>{m.username.slice(idx, idx + kickSearch.length)}</span>
                                {m.username.slice(idx + kickSearch.length)}
                              </>
                            );
                          })()
                        : m.username
                      }
                      <RoleBadge role={m.role} />
                    </div>
                  </div>
                  {/* 群主可以设置管理员 */}
                  {isOwner && m.role !== 'owner' && (
                    <button
                      style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, color: m.role === 'admin' ? '#888' : '#07C160', border: `1px solid ${m.role === 'admin' ? '#E0E0E0' : '#07C160'}`, background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => toggleAdmin(m.id, m.role)}
                    >{m.role === 'admin' ? '撤销管理员' : '设为管理员'}</button>
                  )}
                  {/* 群主和管理员可以踢普通成员（管理员不能踢管理员） */}
                  {isAdmin && m.id !== currentUserId && m.role === 'member' && (
                    <button
                      style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, color: '#FA5151', border: '1px solid #FFCDD2', background: 'transparent', cursor: 'pointer', flexShrink: 0, marginLeft: 2 }}
                      onClick={() => kickMember(m.id)}
                    >移出</button>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>

        {/* 个人设置 */}
        <div style={{ ...S.section, marginBottom: 8 }}>
          <div style={{ ...S.row, borderBottom: '1px solid var(--border-color)' }}>
            <span style={S.rowLabel}>消息免打扰</span>
            <Toggle
              on={myMuted}
              disabled={togglingMyMute}
              onChange={async (val) => {
                setTogglingMyMute(true);
                try {
                  await axios.post(`/api/messages/conversation/${conversation.id}/mute`, { muted: val ? 1 : 0 });
                  setMyMuted(val);
                  onConvUpdate?.({ muted: val ? 1 : 0 });
                } catch { alert('操作失败'); }
                setTogglingMyMute(false);
              }}
            />
          </div>
          <div style={S.row}>
            <span style={S.rowLabel}>置顶聊天</span>
            <Toggle
              on={myPinned}
              disabled={togglingMyPin}
              onChange={async (val) => {
                setTogglingMyPin(true);
                try {
                  await axios.post(`/api/messages/conversation/${conversation.id}/pin`, { pinned: val ? 1 : 0 });
                  setMyPinned(val);
                  onConvUpdate?.({ pinned: val ? 1 : 0 });
                } catch { alert('操作失败'); }
                setTogglingMyPin(false);
              }}
            />
          </div>
        </div>

        {/* 群昵称 */}
        <div style={{ background: 'var(--bg-msg-other)', marginBottom: 8 }}>
          <div style={{ padding: '0 14px', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: '32px', borderBottom: '1px solid var(--border-color)' }}>我在本群的昵称</div>
          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            {editNickname ? (
              <>
                <input
                  autoFocus
                  value={nicknameVal}
                  onChange={e => setNicknameVal(e.target.value)}
                  placeholder="设置群昵称（最多30字）"
                  maxLength={30}
                  style={{ flex: 1, fontSize: 14, padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: 5, background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  onKeyDown={e => { if (e.key === 'Enter') saveNickname(); if (e.key === 'Escape') setEditNickname(false); }}
                />
                <button style={{ color: '#07C160', fontSize: 13 }} onClick={saveNickname}>保存</button>
                <button style={{ color: 'var(--text-tertiary)', fontSize: 13 }} onClick={() => setEditNickname(false)}>取消</button>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => { setNicknameVal(myNickname || ''); setEditNickname(true); }}>
                <span style={{ fontSize: 14, color: myNickname ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{myNickname || '未设置'}</span>
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'var(--text-tertiary)' }}><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
              </div>
            )}
          </div>
        </div>

        {/* 群二维码 */}
        <div style={{ background: 'var(--bg-msg-other)', marginBottom: 8 }}>
          <div
            style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={loadQR}
          >
            <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>群二维码</span>
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'var(--text-tertiary)' }}><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </div>
        </div>

        {/* 操作按钮区 */}
        <div style={{ padding: '0 12px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={clearMessages}
            style={{ width: '100%', padding: '11px', background: 'var(--bg-msg-other)', color: '#FA5151', borderRadius: 7, fontSize: 14, fontWeight: 500, border: '1px solid rgba(250,81,81,.2)', cursor: 'pointer', transition: 'background .12s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-msg-other)'}
          >
            双向删除聊天记录
          </button>
          <button
            onClick={leaveGroup}
            style={{ width: '100%', padding: '11px', background: 'var(--bg-msg-other)', color: '#FA5151', borderRadius: 7, fontSize: 14, fontWeight: 500, border: '1px solid rgba(250,81,81,.2)', cursor: 'pointer', transition: 'background .12s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-msg-other)'}
          >
            {isOwner ? '解散群聊' : '退出群聊'}
          </button>
        </div>
      </div>

      {/* 群二维码弹窗 */}
      {showQR && (
        <div className="wc-modal-overlay" onClick={e => e.target === e.currentTarget && setShowQR(false)}>
          <div className="wc-modal" style={{ width: 300, textAlign: 'center' }}>
            <div className="wc-modal-header">
              <span className="wc-modal-title">群二维码</span>
              <button className="wc-modal-close" onClick={() => setShowQR(false)}>✕</button>
            </div>
            <div style={{ padding: '24px 20px 20px' }}>
              {qrData ? (
                <>
                  <img src={qrData.qrCode} alt="群二维码" style={{ width: 200, height: 200, display: 'block', margin: '0 auto 16px', borderRadius: 8, border: '1px solid #E5E5E5' }} />
                  <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>扫码加入 {info?.name}</div>
                  <div style={{ fontSize: 11, color: '#B2B2B2' }}>7天内有效</div>
                  <button
                    style={{ marginTop: 16, padding: '8px 24px', background: '#07C160', color: '#fff', borderRadius: 6, fontSize: 14 }}
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = qrData.qrCode;
                      a.download = `${info?.name || '群'}_邀请码.png`;
                      a.click();
                    }}
                  >保存图片</button>
                </>
              ) : (
                <div style={{ padding: '40px 0', color: '#B2B2B2', fontSize: 13 }}>加载中…</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 邀请成员弹窗 */}
      {showInvite && (
        <div className="wc-modal-overlay" onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="wc-modal wide">
            <div className="wc-modal-header">
              <span className="wc-modal-title">邀请成员</span>
              <button className="wc-modal-close" onClick={() => setShowInvite(false)}>✕</button>
            </div>
            <div className="wc-modal-body">
              <div style={{ padding: '6px 16px 4px', fontSize: 12, color: '#888' }}>从通讯录选择（已选 {selectedInvite.size} 人）</div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {myContacts.length === 0
                  ? <div style={{ padding: 24, textAlign: 'center', color: '#B2B2B2', fontSize: 13 }}>所有好友已在群内</div>
                  : myContacts.map(c => (
                    <div key={c.id} className="wc-group-member-item" onClick={() => setSelectedInvite(prev => { const s = new Set(prev); s.has(c.id) ? s.delete(c.id) : s.add(c.id); return s; })}>
                      <div className={`wc-group-check${selectedInvite.has(c.id) ? ' checked' : ''}`}>{selectedInvite.has(c.id) ? '✓' : ''}</div>
                      <Avatar src={c.avatar} name={c.remark || c.username} size={36} />
                      <span style={{ fontSize: 14 }}>{c.remark || c.username}</span>
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
