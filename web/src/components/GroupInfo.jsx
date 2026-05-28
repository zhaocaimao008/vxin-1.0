import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Avatar from './Avatar';

/* ── 群头像拼图（微信风格 N宫格） ── */
export function GroupAvatar({ members = [], size = 46 }) {
  const n = Math.min(members.length, 9);
  if (n === 0) return <Avatar name="群" size={size} />;
  if (n === 1) return <Avatar src={members[0].avatar} name={members[0].username} size={size} />;
  const grid = n <= 4 ? 2 : 3;
  const cellSize = Math.floor((size - (grid + 1) * 2) / grid);
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.22), background: '#DCDCDC', display: 'grid', overflow: 'hidden', gridTemplateColumns: `repeat(${grid}, ${cellSize}px)`, gap: 2, padding: 2, flexShrink: 0 }}>
      {members.slice(0, grid * grid).map((m, i) => (
        <div key={i} style={{ width: cellSize, height: cellSize, borderRadius: 2, overflow: 'hidden', background: '#C0C0C0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {m.avatar ? <img src={m.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: cellSize * 0.45, fontWeight: 600, color: '#fff' }}>{(m.username || '?')[0]}</span>}
        </div>
      ))}
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
export default function GroupInfo({ conversation, currentUserId, onClose, onLeave, onConvUpdate }) {
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
  // 个人会话设置
  const [myMuted, setMyMuted] = useState(!!conversation.muted);
  const [myPinned, setMyPinned] = useState(!!conversation.pinned);
  const [togglingMyMute, setTogglingMyMute] = useState(false);
  const [togglingMyPin, setTogglingMyPin] = useState(false);

  const load = () => {
    setLoading(true);
    axios.get(`/api/messages/conversation/${conversation.id}/info`).then(r => {
      setInfo(r.data);
      setNameVal(r.data.name || '');
      setAnnVal(r.data.announcement || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [conversation.id]);

  const myRole = info?.myRole || 'member';
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin' || isOwner;
  const isManageable = isAdmin; // 群主和管理员都可以看到群管理

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

  /* 设置/取消管理员（仅群主） */
  const toggleAdmin = async (uid, currentRole) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    const name = info.members.find(m => m.id === uid)?.username;
    const action = newRole === 'admin' ? `设置「${name}」为管理员` : `撤销「${name}」的管理员`;
    if (!confirm(action + '？')) return;
    await axios.put(`/api/messages/conversation/${conversation.id}/members/${uid}/role`, { role: newRole });
    setInfo(i => ({ ...i, members: i.members.map(m => m.id === uid ? { ...m, role: newRole } : m) }));
  };

  /* 移出成员 */
  const kickMember = async (uid) => {
    const name = info.members.find(m => m.id === uid)?.username;
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

  /* ── section 样式 ── */
  const S = {
    panel: { width: 280, borderLeft: '1px solid #E0E0E0', background: '#F5F5F5', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 },
    header: { padding: '0 14px', height: 52, background: '#EDEDED', borderBottom: '1px solid #E0E0E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    section: { background: '#fff', marginBottom: 8 },
    row: { display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid #F5F5F5', gap: 10 },
    rowLabel: { flex: 1, fontSize: 14, color: '#191919' },
    rowSub: { fontSize: 12, color: '#888', marginTop: 2 },
    closeBtn: { color: '#888', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 2 },
  };

  if (loading) return (
    <div style={{ ...S.panel, alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#B2B2B2', fontSize: 13 }}>加载中...</span>
    </div>
  );
  if (!info) return null;

  return (
    <div style={S.panel}>
      {/* 顶部栏 */}
      <div style={S.header}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>群聊信息</span>
        <button style={S.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* 群名称 + 头像 */}
        <div style={{ ...S.section, padding: '14px 14px 12px', display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <GroupAvatar members={info.members} size={50} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {editName ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input value={nameVal} onChange={e => setNameVal(e.target.value)} style={{ flex: 1, fontSize: 15, border: '1px solid #07C160', borderRadius: 4, padding: '3px 7px', outline: 'none' }} autoFocus onKeyDown={e => e.key === 'Enter' && saveName()} />
                <button style={{ color: '#07C160', fontSize: 12 }} onClick={saveName}>保存</button>
                <button style={{ color: '#888', fontSize: 12 }} onClick={() => setEditName(false)}>取消</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.name}</span>
                <button style={{ color: '#B2B2B2', fontSize: 11, flexShrink: 0 }} onClick={() => setEditName(true)}>✎</button>
              </div>
            )}
            <div style={{ fontSize: 12, color: '#B2B2B2', marginTop: 2 }}>{info.members.length}人</div>
          </div>
        </div>

        {/* 群公告 */}
        <div style={{ ...S.section, padding: '11px 14px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editAnn ? 8 : 5 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>群公告</span>
            {isAdmin && !editAnn && <button style={{ fontSize: 12, color: '#07C160' }} onClick={() => setEditAnn(true)}>编辑</button>}
          </div>
          {editAnn ? (
            <>
              <textarea value={annVal} onChange={e => setAnnVal(e.target.value)} style={{ width: '100%', height: 68, border: '1px solid #E5E5E5', borderRadius: 4, padding: '6px 8px', fontSize: 13, resize: 'none', outline: 'none' }} autoFocus placeholder="填写群公告..." />
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button style={{ flex: 1, padding: '6px', background: '#F5F5F5', borderRadius: 4, fontSize: 13 }} onClick={() => setEditAnn(false)}>取消</button>
                <button style={{ flex: 1, padding: '6px', background: '#07C160', color: '#fff', borderRadius: 4, fontSize: 13 }} onClick={saveAnn}>保存</button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: info.announcement ? '#333' : '#B2B2B2', lineHeight: 1.6 }}>{info.announcement || '暂无群公告'}</div>
          )}
        </div>

        {/* ── 群管理入口（群主和管理员可见） ── */}
        {isManageable && (
          <div style={{ ...S.section, marginBottom: 8 }}>
            <div
              style={{ ...S.row, cursor: 'pointer' }}
              onClick={() => setShowManage(v => !v)}
            >
              <div style={{ width: 28, height: 28, borderRadius: 6, background: '#FF7A0022', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🛡️</div>
              <span style={S.rowLabel}>群管理</span>
              <span style={{ color: '#C7C7CC', fontSize: 16, transform: showManage ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
            </div>

            {showManage && (
              <div style={{ background: '#FAFAFA', borderTop: '1px solid #F0F0F0' }}>
                {/* 全群禁言 */}
                <div style={{ ...S.row, borderBottom: '1px solid #F0F0F0' }}>
                  <div style={{ flex: 1 }}>
                    <div style={S.rowLabel}>全员禁言</div>
                    <div style={S.rowSub}>开启后，只有群主和管理员可以发消息</div>
                  </div>
                  <Toggle
                    on={!!info.mute_all}
                    onChange={toggleMuteAll}
                    disabled={togglingMute}
                  />
                </div>

                {/* 禁止私聊 */}
                <div style={S.row}>
                  <div style={{ flex: 1 }}>
                    <div style={S.rowLabel}>禁止私聊</div>
                    <div style={S.rowSub}>开启后，普通成员无法查看其他成员资料或私聊</div>
                  </div>
                  <Toggle
                    on={!!info.no_private_chat}
                    onChange={toggleNoPrivateChat}
                    disabled={togglingNoPrivate}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 状态提示条（非管理员时展示当前限制） */}
        {!isAdmin && (info.mute_all || info.no_private_chat) && (
          <div style={{ margin: '0 0 8px', background: '#FFF8E1', borderTop: '1px solid #FFE082', borderBottom: '1px solid #FFE082', padding: '8px 14px' }}>
            {info.mute_all && <div style={{ fontSize: 12, color: '#9E6A00', lineHeight: 1.6 }}>🔇 全员禁言已开启，您当前无法发送消息</div>}
            {info.no_private_chat && <div style={{ fontSize: 12, color: '#9E6A00', lineHeight: 1.6 }}>🔒 禁止私聊已开启，您无法与群成员私信</div>}
          </div>
        )}

        {/* 群成员列表 */}
        <div style={{ ...S.section, marginBottom: 8 }}>
          <div style={{ padding: '9px 14px 6px', fontSize: 12, fontWeight: 600, color: '#888', borderBottom: '1px solid #F5F5F5', letterSpacing: '.3px' }}>
            群成员 ({info.members.length})
          </div>
          <div style={{ padding: '4px 8px' }}>
            {/* 邀请按钮 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 6px', cursor: 'pointer', borderRadius: 6 }} onClick={openInvite}>
              <div style={{ width: 38, height: 38, borderRadius: 7, border: '1.5px dashed #07C160', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#07C160', fontSize: 20 }}>+</div>
              <span style={{ fontSize: 13, color: '#07C160' }}>邀请成员</span>
            </div>

            {info.members.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 6px', borderRadius: 6 }}>
                <Avatar src={m.avatar} name={m.username} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                    {m.username}
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
            ))}
          </div>
        </div>

        {/* 个人设置 */}
        <div style={{ ...S.section, marginBottom: 8 }}>
          <div style={{ ...S.row, borderBottom: '1px solid #F5F5F5' }}>
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

        {/* 退出/解散按钮 */}
        <button
          onClick={leaveGroup}
          style={{ display: 'block', width: 'calc(100% - 24px)', margin: '0 12px 20px', padding: '11px', background: '#fff', color: '#FA5151', borderRadius: 6, fontSize: 14, fontWeight: 500, border: '1px solid rgba(250,81,81,.25)', cursor: 'pointer' }}
        >
          {isOwner ? '解散群聊' : '退出群聊'}
        </button>
      </div>

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
