import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Avatar from './Avatar';

// 查看用户资料卡片（弹窗）
export default function UserProfile({ userId, onClose, onStartChat, onFriendAdded }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRemark, setShowRemark] = useState(false);
  const [remark, setRemark] = useState('');
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    axios.get(`/api/users/${userId}`).then(r => {
      setUser(r.data);
      setBlocked(!!r.data.isBlocked);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  const sendFriendRequest = async () => {
    setRequesting(true);
    try {
      await axios.post('/api/users/friend-request', { toId: userId, message: '请求添加您为好友' });
      alert('好友请求已发送');
      onFriendAdded?.();
    } catch (err) { alert(err.response?.data?.error || '发送失败'); }
    setRequesting(false);
  };

  const saveRemark = async () => {
    setRemarkSaving(true);
    try {
      const nextRemark = remark.trim();
      await axios.put(`/api/users/contacts/${userId}/remark`, { remark: nextRemark });
      setUser(u => ({ ...u, remark: nextRemark }));
      setShowRemark(false);
      window.dispatchEvent(new CustomEvent('vxin:remark-changed', { detail: { userId, remark: nextRemark } }));
      onFriendAdded?.();
    } catch (err) {
      alert(err.response?.data?.error || '保存失败');
    }
    setRemarkSaving(false);
  };

  const deleteFriend = async () => {
    if (!confirm(`确认删除好友「${user.remark || user.username}」？`)) return;
    await axios.delete(`/api/users/contacts/${userId}`);
    onClose();
  };

  const toggleBlock = async () => {
    if (blocked) {
      await axios.delete(`/api/users/block/${userId}`);
      setBlocked(false);
    } else {
      if (!confirm(`确认拉黑「${user.remark || user.username}」？拉黑后对方无法向你发送好友请求。`)) return;
      await axios.post(`/api/users/block/${userId}`);
      setBlocked(true);
    }
  };

  const startChat = async () => {
    const { data } = await axios.post('/api/messages/conversation/private', { userId });
    onStartChat?.({ id: data.conversationId, type: 'private', name: user.remark || user.username, avatar: user.avatar, otherUser: user });
    onClose();
  };

  if (loading) return (
    <div className="wc-modal-overlay" onClick={onClose}>
      <div className="wc-modal" style={{ padding: 40, textAlign: 'center' }}>
        <span style={{ color: '#B2B2B2' }}>加载中...</span>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="wc-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="wc-modal wc-user-profile-modal">
        <div className="wc-user-profile-top">
          <button className="wc-user-profile-close" onClick={onClose}>×</button>
          <div className="wc-user-profile-main">
            <Avatar src={user.avatar} name={user.remark || user.username} size={68} style={{ borderRadius: 10 }} />
            <div className="wc-user-profile-namebox">
              <div className="wc-user-profile-name">{user.remark || user.username}</div>
              {user.remark && <div className="wc-user-profile-line">昵称: {user.username}</div>}
              <div className="wc-user-profile-line">v信ID: {user.wechat_id || '-'}</div>
              {user.phone && <div className="wc-user-profile-line">手机号: {user.phone}</div>}
            </div>
          </div>
          {user.bio && <div className="wc-user-profile-bio">{user.bio}</div>}
        </div>

        <div className="wc-user-profile-body">
          {user.isFriend ? (
            <>
              <div className="wc-user-profile-section">
                <ProfileRow label="设置备注和标签" value={user.remark || ''} onClick={() => { setRemark(user.remark || ''); setShowRemark(true); }} />
                <ProfileRow label="朋友权限" onClick={() => {}} />
              </div>
              <div className="wc-user-profile-section">
                <ProfileRow label="更多信息" onClick={() => {}} />
              </div>
              <div className="wc-user-profile-actions">
                <button className="wc-user-profile-primary" onClick={startChat}>发消息</button>
                <button className="wc-user-profile-secondary" onClick={toggleBlock}>{blocked ? '取消加入黑名单' : '加入黑名单'}</button>
                <button className="wc-user-profile-danger" onClick={deleteFriend}>删除好友</button>
              </div>
            </>
          ) : (
            <div className="wc-user-profile-actions">
              <button
                className="wc-user-profile-primary"
                onClick={sendFriendRequest}
                disabled={requesting}
              >
                {requesting ? '发送中...' : '添加到通讯录'}
              </button>
            </div>
          )}
        </div>

        {/* Remark editor */}
        {showRemark && (
          <div className="wc-user-profile-remark">
            <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>设置备注名（仅自己可见）</div>
            <input
              className="wc-modal-input"
              placeholder="备注名"
              value={remark}
              onChange={e => setRemark(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="wc-modal-btn secondary" onClick={() => setShowRemark(false)}>取消</button>
              <button className="wc-modal-btn primary" onClick={saveRemark} disabled={remarkSaving}>
                {remarkSaving ? '保存中...' : '确认'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileRow({ label, value, onClick }) {
  return (
    <div className="wc-user-profile-row" onClick={onClick}>
      <span>{label}</span>
      <div>
        {value && <em>{value}</em>}
        <b>›</b>
      </div>
    </div>
  );
}
