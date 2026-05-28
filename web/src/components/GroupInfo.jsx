import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Avatar from './Avatar';

// 群头像拼图（微信风格）
export function GroupAvatar({ members = [], size = 46 }) {
  const n = Math.min(members.length, 9);
  if (n === 0) return <Avatar name="群" size={size} />;
  if (n === 1) return <Avatar src={members[0].avatar} name={members[0].username} size={size} />;

  const grid = n <= 4 ? 2 : 3;
  const cellSize = Math.floor((size - (grid + 1) * 2) / grid);
  const total = size;

  return (
    <div style={{
      width: total, height: total, borderRadius: Math.round(total * 0.22),
      background: '#DCDCDC', display: 'grid', overflow: 'hidden',
      gridTemplateColumns: `repeat(${grid}, ${cellSize}px)`,
      gap: 2, padding: 2, flexShrink: 0
    }}>
      {members.slice(0, grid * grid).map((m, i) => (
        <div key={i} style={{ width: cellSize, height: cellSize, borderRadius: 2, overflow: 'hidden', background: '#C0C0C0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {m.avatar
            ? <img src={m.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: cellSize * 0.45, fontWeight: 600, color: '#fff' }}>{(m.username || '?')[0]}</span>
          }
        </div>
      ))}
    </div>
  );
}

// 群详情面板（ChatWindow内嵌）
export default function GroupInfo({ conversation, currentUserId, onClose, onLeave, onConvUpdate }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [editAnn, setEditAnn] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [annVal, setAnnVal] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [myContacts, setMyContacts] = useState([]);
  const [selectedInvite, setSelectedInvite] = useState(new Set());

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

  const isOwner = info?.owner_id === currentUserId;

  const saveName = async () => {
    if (!nameVal.trim()) return;
    await axios.put(`/api/messages/conversation/${conversation.id}`, { name: nameVal.trim() });
    setInfo(i => ({ ...i, name: nameVal.trim() }));
    setEditName(false);
    onConvUpdate?.({ name: nameVal.trim() });
  };

  const saveAnn = async () => {
    await axios.put(`/api/messages/conversation/${conversation.id}`, { announcement: annVal });
    setInfo(i => ({ ...i, announcement: annVal }));
    setEditAnn(false);
  };

  const kickMember = async (uid) => {
    const member = info.members.find(m => m.id === uid);
    if (!confirm(`确认移出成员「${member?.username}」？`)) return;
    await axios.delete(`/api/messages/conversation/${conversation.id}/members/${uid}`);
    setInfo(i => ({ ...i, members: i.members.filter(m => m.id !== uid) }));
  };

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

  const leaveGroup = async () => {
    const msg = isOwner ? '解散群聊后所有成员将无法继续聊天，确认解散？' : '确认退出群聊？';
    if (!confirm(msg)) return;
    await axios.post(`/api/messages/conversation/${conversation.id}/leave`);
    onLeave?.();
  };

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: '#B2B2B2' }}>加载中...</div>;
  if (!info) return null;

  return (
    <div style={{ width: 280, borderLeft: '1px solid #E5E5E5', background: '#F5F5F5', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', background: '#EDEDED', borderBottom: '1px solid #E0E0E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>群聊信息</span>
        <button style={{ color: '#888', fontSize: 16 }} onClick={onClose}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Group identity */}
        <div style={{ background: '#fff', padding: '16px', marginBottom: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
          <GroupAvatar members={info.members} size={52} />
          <div style={{ flex: 1 }}>
            {editName ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  value={nameVal}
                  onChange={e => setNameVal(e.target.value)}
                  style={{ flex: 1, fontSize: 15, border: '1px solid #07C160', borderRadius: 4, padding: '4px 8px', outline: 'none' }}
                  autoFocus onKeyDown={e => e.key === 'Enter' && saveName()}
                />
                <button style={{ color: '#07C160', fontSize: 13, fontWeight: 500 }} onClick={saveName}>保存</button>
                <button style={{ color: '#888', fontSize: 13 }} onClick={() => setEditName(false)}>取消</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{info.name}</span>
                <button style={{ color: '#B2B2B2', fontSize: 12 }} onClick={() => setEditName(true)} title="修改群名">✎</button>
              </div>
            )}
            <div style={{ fontSize: 12, color: '#B2B2B2', marginTop: 3 }}>{info.members.length}人</div>
          </div>
        </div>

        {/* Announcement */}
        <div style={{ background: '#fff', margin: '0 0 10px', padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>群公告</span>
            {isOwner && <button style={{ fontSize: 12, color: '#07C160' }} onClick={() => setEditAnn(true)}>编辑</button>}
          </div>
          {editAnn ? (
            <>
              <textarea
                value={annVal}
                onChange={e => setAnnVal(e.target.value)}
                style={{ width: '100%', height: 70, border: '1px solid #E5E5E5', borderRadius: 4, padding: '6px 8px', fontSize: 13, resize: 'none', outline: 'none' }}
                autoFocus placeholder="填写群公告..."
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button style={{ flex: 1, padding: '6px', background: '#F5F5F5', borderRadius: 4, fontSize: 13, color: '#555' }} onClick={() => setEditAnn(false)}>取消</button>
                <button style={{ flex: 1, padding: '6px', background: '#07C160', color: '#fff', borderRadius: 4, fontSize: 13 }} onClick={saveAnn}>保存</button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: info.announcement ? '#333' : '#B2B2B2', lineHeight: 1.6 }}>
              {info.announcement || '暂无群公告'}
            </div>
          )}
        </div>

        {/* Members */}
        <div style={{ background: '#fff', marginBottom: 10 }}>
          <div style={{ padding: '10px 14px 6px', fontSize: 13, fontWeight: 600, color: '#555', borderBottom: '1px solid #F5F5F5' }}>
            群成员 ({info.members.length})
          </div>
          <div style={{ padding: '6px 10px' }}>
            {/* Add member button */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', cursor: 'pointer', borderRadius: 6 }}
              onClick={openInvite}
            >
              <div style={{ width: 40, height: 40, borderRadius: 8, border: '1.5px dashed #07C160', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#07C160', fontSize: 22 }}>+</div>
              <span style={{ fontSize: 14, color: '#07C160' }}>邀请成员</span>
            </div>

            {info.members.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 6px', borderRadius: 6 }}>
                <Avatar src={m.avatar} name={m.username} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.username}
                    {m.isOwner ? <span style={{ fontSize: 10, color: '#07C160', marginLeft: 4, background: '#E8F5E9', padding: '1px 4px', borderRadius: 3 }}>群主</span> : null}
                  </div>
                </div>
                {isOwner && m.id !== currentUserId && (
                  <button style={{ color: '#FA5151', fontSize: 12, padding: '2px 6px', border: '1px solid #FFCDD2', borderRadius: 4 }} onClick={() => kickMember(m.id)}>移出</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div style={{ background: '#fff', marginBottom: 10 }}>
          <div className="wc-menu-item" style={{ borderBottom: '1px solid #F5F5F5' }}>
            <span className="wc-menu-label">消息免打扰</span>
            <span className="wc-menu-arrow">›</span>
          </div>
          <div className="wc-menu-item">
            <span className="wc-menu-label">置顶聊天</span>
            <span className="wc-menu-arrow">›</span>
          </div>
        </div>

        {/* Leave */}
        <button
          onClick={leaveGroup}
          style={{ width: 'calc(100% - 28px)', margin: '0 14px 20px', padding: '12px', background: '#fff', color: '#FA5151', borderRadius: 8, fontSize: 15, fontWeight: 500, border: 'none', cursor: 'pointer' }}
        >
          {isOwner ? '解散群聊' : '退出群聊'}
        </button>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="wc-modal-overlay" onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="wc-modal wide">
            <div className="wc-modal-header">
              <span className="wc-modal-title">邀请成员</span>
              <button className="wc-modal-close" onClick={() => setShowInvite(false)}>✕</button>
            </div>
            <div className="wc-modal-body">
              <div style={{ padding: '6px 12px', fontSize: 13, color: '#888' }}>从好友中选择（已选 {selectedInvite.size} 人）</div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {myContacts.length === 0
                  ? <div style={{ padding: '30px', textAlign: 'center', color: '#B2B2B2', fontSize: 13 }}>所有好友已在群内</div>
                  : myContacts.map(c => (
                    <div key={c.id} className="wc-group-member-item" onClick={() => {
                      setSelectedInvite(prev => {
                        const s = new Set(prev);
                        if (s.has(c.id)) s.delete(c.id); else s.add(c.id);
                        return s;
                      });
                    }}>
                      <div className={`wc-group-check${selectedInvite.has(c.id) ? ' checked' : ''}`}>{selectedInvite.has(c.id) ? '✓' : ''}</div>
                      <Avatar src={c.avatar} name={c.username} size={36} />
                      <span style={{ fontSize: 15 }}>{c.remark || c.username}</span>
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
