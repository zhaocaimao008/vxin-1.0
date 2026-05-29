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
    await axios.put(`/api/users/contacts/${userId}/remark`, { remark });
    setUser(u => ({ ...u, remark }));
    setShowRemark(false);
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
      <div className="wc-modal" style={{ width: 340 }}>
        {/* Profile header */}
        <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', padding: '24px 20px 16px', position: 'relative' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
            <Avatar src={user.avatar} name={user.username} size={64} style={{ borderRadius: 10, border: '2px solid rgba(255,255,255,0.3)' }} />
            <div>
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                {user.remark || user.username}
              </div>
              {user.remark && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 2 }}>昵称：{user.username}</div>}
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                {user.wechat_id ? `微信号：${user.wechat_id}` : `手机：${user.phone}`}
              </div>
            </div>
          </div>
          {user.bio && (
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 10 }}>
              {user.bio}
            </div>
          )}
          <div style={{ position: 'absolute', top: 10, right: 12, color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer' }} onClick={onClose}>✕</div>
        </div>

        {/* Actions */}
        <div className="wc-modal-body">
          {user.isFriend ? (
            <>
              {/* Friend actions */}
              <div className="wc-menu-item" onClick={startChat} style={{ borderBottom: '1px solid #F0F0F0' }}>
                <div className="wc-menu-icon" style={{ background: '#07C16022' }}>💬</div>
                <span className="wc-menu-label">发消息</span>
              </div>
              <div className="wc-menu-item" onClick={() => { setRemark(user.remark || ''); setShowRemark(true); }} style={{ borderBottom: '1px solid #F0F0F0' }}>
                <div className="wc-menu-icon" style={{ background: '#1890FF22' }}>✏️</div>
                <span className="wc-menu-label">设置备注</span>
                {user.remark && <span style={{ fontSize: 13, color: '#B2B2B2' }}>{user.remark}</span>}
              </div>
              <div className="wc-menu-item" style={{ borderBottom: '1px solid #F0F0F0' }}>
                <div className="wc-menu-icon" style={{ background: '#FA8C1622' }}>🔔</div>
                <span className="wc-menu-label">消息免打扰</span>
              </div>
              <div className="wc-menu-item" onClick={toggleBlock} style={{ borderBottom: '1px solid #F0F0F0' }}>
                <div className="wc-menu-icon" style={{ background: blocked ? '#8C8C8C22' : '#FA8C1622' }}>{blocked ? '🔓' : '🚫'}</div>
                <span className="wc-menu-label">{blocked ? '取消拉黑' : '加入黑名单'}</span>
              </div>
              <div className="wc-menu-item danger" onClick={deleteFriend} style={{ color: '#FA5151' }}>
                <div className="wc-menu-icon" style={{ background: '#FA515122' }}>🗑</div>
                <span className="wc-menu-label" style={{ color: '#FA5151' }}>删除好友</span>
              </div>
            </>
          ) : (
            <div style={{ padding: '20px 20px 16px', textAlign: 'center' }}>
              <div style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>还不是好友</div>
              <button
                style={{ width: '100%', padding: '11px', background: '#07C160', color: '#fff', borderRadius: 8, fontSize: 15, fontWeight: 500 }}
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
          <div style={{ padding: '12px 20px', borderTop: '1px solid #F0F0F0', background: '#FAFAFA' }}>
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
