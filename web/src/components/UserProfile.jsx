import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import { useAuth } from '../contexts/AuthContext';
import { mediaUrl } from '../utils/url';
import { showToast, showConfirm } from '../utils/toast';
import { copyToClipboard } from '../utils/clipboard';
import useFocusTrap from '../hooks/useFocusTrap';
import { formatLastOnline } from '../utils/time';
import { IcoClose, IcoChevronRight, IcoUserPlus, IcoCheck, IcoChat, IcoNudge, IcoBlock, IcoTrash } from './Icons';

export default function UserProfile({ userId, onClose, onStartChat, onFriendAdded, onFriendDeleted, onNudge }) {
  const { user: currentUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRemarkEdit, setShowRemarkEdit] = useState(false);
  const [remark, setRemark] = useState('');
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [addStep, setAddStep] = useState('idle'); // idle | composing | sent
  const [verifyMsg, setVerifyMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [blocked, setBlocked] = useState(false);
  // 弹窗焦点陷阱：把键盘焦点锁在资料卡内，Tab 循环、关闭后还原焦点
  const trapRef = useFocusTrap(!loading && !!user);

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // userId 变化时复位加载态：render 期派生（存上一次 userId），避免 effect 内同步 setState
  const [loadedId, setLoadedId] = useState(userId);
  if (userId !== loadedId) {
    setLoadedId(userId);
    setLoading(true);
    setAddStep('idle');
    setErrMsg('');
  }

  useEffect(() => {
    let alive = true;
    axios.get(`/api/users/${userId}`).then(r => {
      if (!alive) return;
      setUser(r.data);
      setBlocked(!!r.data.isBlocked);
      if (r.data.isFriend) setAddStep('idle');
      else if (r.data.hasPendingRequest) setAddStep('sent');
      setLoading(false);
    }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId]);

  const sendRequest = async () => {
    setSending(true);
    setErrMsg('');
    try {
      const { data } = await axios.post('/api/users/friend-request', { toId: userId, message: verifyMsg.trim() || '我是 ' + (user?.username || '') });
      if (data.autoAccepted) {
        // 对方免验证，直接成为好友
        setUser(u => ({ ...u, isFriend: true }));
        onFriendAdded?.();
      } else {
        setAddStep('sent');
        onFriendAdded?.();
      }
    } catch (err) {
      const msg = err.response?.data?.error || '发送失败，请重试';
      setErrMsg(msg);
      // 若服务端说已是好友或请求已存在，同步本地状态
      if (msg === '已是好友') {
        setUser(u => u ? { ...u, isFriend: true } : u);
      } else if (msg === '请求已发送') {
        setAddStep('sent');
      }
    }
    setSending(false);
  };

  const saveRemark = async () => {
    setRemarkSaving(true);
    try {
      const next = remark.trim();
      await axios.put(`/api/users/contacts/${userId}/remark`, { remark: next });
      setUser(u => ({ ...u, remark: next }));
      setShowRemarkEdit(false);
      window.dispatchEvent(new CustomEvent('vxin:remark-changed', { detail: { userId, remark: next } }));
      onFriendAdded?.();
    } catch (err) {
      setErrMsg(err.response?.data?.error || '保存失败');
    }
    setRemarkSaving(false);
  };

  const deleteFriend = async () => {
    if (!(await showConfirm(`确认删除好友「${user.remark || user.username}」？`))) return;
    try {
      await axios.delete(`/api/users/contacts/${userId}`);
      onFriendAdded?.();
      onFriendDeleted?.();
      onClose();
    } catch (e) {
      // 删除失败时不关闭弹窗，提示用户以免误以为已删除
      showToast(e.response?.data?.error || '删除失败，请重试', 'error');
    }
  };

  const toggleBlock = async () => {
    try {
      if (blocked) {
        await axios.delete(`/api/users/block/${userId}`);
        setBlocked(false);
      } else {
        if (!(await showConfirm(`确认将「${user.remark || user.username}」加入黑名单？`))) return;
        await axios.post(`/api/users/block/${userId}`);
        setBlocked(true);
      }
    } catch (e) {
      showToast(e.response?.data?.error || '操作失败，请重试', 'error');
    }
  };

  const startChat = async () => {
    try {
      const { data } = await axios.post('/api/messages/conversation/private', { userId });
      onStartChat?.({ id: data.conversationId, type: 'private', name: user.remark || user.username, avatar: user.avatar, otherUser: user });
      onClose();
    } catch (e) {
      showToast(e.response?.data?.error || '打开会话失败，请重试', 'error');
    }
  };

  if (loading) return (
    <div className="up-overlay" onClick={onClose}>
      <div className="up-card" role="dialog" aria-modal="true" aria-label="联系人资料" onClick={e => e.stopPropagation()} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <div className="up-loading-dot" />
      </div>
    </div>
  );
  if (!user) return null;

  const displayName = user.remark || user.username;

  return (
    <div className="up-overlay" ref={trapRef} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="up-card" role="dialog" aria-modal="true" aria-label="联系人资料" onClick={e => e.stopPropagation()}>

        {/* 顶部封面区 */}
        <div className="up-header">
          {user.cover_photo
            ? <img src={mediaUrl(user.cover_photo)} loading="lazy" className="up-cover" alt=""
                   onError={e => { e.currentTarget.onerror = null; e.currentTarget.className = 'up-cover-default'; e.currentTarget.removeAttribute('src'); }} />
            : <div className="up-cover-default" />
          }
          <button className="up-close-btn" onClick={onClose} aria-label="关闭">
            <IcoClose size={18} />
          </button>
          <div className="up-avatar-wrap">
            <Avatar src={user.avatar} name={displayName} size={64} style={{ borderRadius: 'var(--radius-bubble-tip)', boxShadow: '0 2px 12px rgba(0,0,0,.3)' }} />
          </div>
        </div>

        {/* 名字 + ID */}
        <div className="up-identity">
          <div className="up-name">{displayName}</div>
          {user.remark && <div className="up-sub">昵称：{user.username}</div>}
          {user.wechat_id && (
            <button
              type="button"
              className="up-sub up-copyable"
              title="点击复制 v信号"
              aria-label={`v信号 ${user.wechat_id}，点击复制`}
              onClick={async () => { const ok = await copyToClipboard(user.wechat_id); showToast(ok ? '已复制 v信号' : '复制失败，请长按手动复制', ok ? 'success' : 'error'); }}
            >v信号：{user.wechat_id}</button>
          )}
          {user.bio && <div className="up-bio">{user.bio}</div>}
          {/* 特权账户：精确最后在线时间 */}
          {user.last_online_at !== undefined && (() => {
            const isOnline = user.status === 'online';
            const label = formatLastOnline(user.last_online_at, isOnline);
            return label ? (
              <div
                className={`up-last-online${isOnline ? '' : ' up-last-online-offline'}`}
                title="最后在线时间（特权可见）"
              >
                <span className="up-status-dot" aria-hidden="true" />
                {label}
              </div>
            ) : null;
          })()}
        </div>

        {/* 好友信息行 */}
        {user.isFriend && (
          <div className="up-rows">
            <button type="button" className="up-row" onClick={() => { setRemark(user.remark || ''); setShowRemarkEdit(true); }}>
              <span className="up-row-label">备注名</span>
              <span className="up-row-value">{user.remark || <span style={{ color: 'var(--text-tertiary)' }}>未设置</span>}</span>
              <IcoChevronRight size={14} className="up-row-chevron" />
            </button>
            {user.phone && (
              <div className="up-row">
                <span className="up-row-label">手机号</span>
                <span className="up-row-value">{user.phone}</span>
              </div>
            )}
          </div>
        )}

        {/* 备注编辑内嵌 */}
        {showRemarkEdit && (
          <div className="up-remark-box">
            <div className="up-remark-label">设置备注（仅自己可见）</div>
            <input
              className="up-remark-input"
              placeholder="输入备注名"
              value={remark}
              onChange={e => setRemark(e.target.value)}
              autoFocus
              maxLength={20}
            />
            <div className="up-remark-actions">
              <button className="up-btn-ghost" onClick={() => setShowRemarkEdit(false)}>取消</button>
              <button className="up-btn-primary" onClick={saveRemark} disabled={remarkSaving}>
                {remarkSaving ? '保存中…' : '确认'}
              </button>
            </div>
          </div>
        )}

        {/* 申请好友区域（非好友） */}
        {!user.isFriend && userId !== currentUser?.id && (
          <div className="up-add-area">
            {addStep === 'idle' && (
              <button className="up-btn-primary up-btn-full" onClick={() => setAddStep('composing')}>
                <IcoUserPlus size={16} style={{ marginRight: 6 }} />
                申请添加好友
              </button>
            )}
            {addStep === 'composing' && (
              <div className="up-verify-box">
                <div className="up-verify-label">验证消息</div>
                <textarea
                  className="up-verify-input"
                  placeholder={`我是 ${user.username}`}
                  value={verifyMsg}
                  onChange={e => setVerifyMsg(e.target.value)}
                  maxLength={100}
                  autoFocus
                  rows={3}
                />
                {errMsg && <div className="up-err">{errMsg}</div>}
                <div className="up-verify-actions">
                  <button className="up-btn-ghost" onClick={() => { setAddStep('idle'); setErrMsg(''); }}>取消</button>
                  <button className="up-btn-primary" onClick={sendRequest} disabled={sending}>
                    {sending ? '发送中…' : '发送申请'}
                  </button>
                </div>
              </div>
            )}
            {addStep === 'sent' && (
              <div className="up-sent-tip">
                <IcoCheck size={16} style={{ color: 'var(--nt-primary)' }} />
                申请已发送，等待对方确认
              </div>
            )}
          </div>
        )}

        {/* 好友操作按钮 */}
        {user.isFriend && (
          <div className="up-actions">
            <button className="up-action-btn up-action-chat" onClick={startChat}>
              <IcoChat size={20} />
              <span>发消息</span>
            </button>
            {onNudge && userId !== currentUser?.id && (
              <button className="up-action-btn up-action-grey" onClick={() => { onNudge(userId); showToast('已发送拍一拍'); onClose?.(); }}>
                <IcoNudge size={20} />
                <span>拍一拍</span>
              </button>
            )}
            <button className={`up-action-btn ${blocked ? 'up-action-warn' : 'up-action-grey'}`} onClick={toggleBlock}>
              <IcoBlock size={20} />
              <span>{blocked ? '已拉黑' : '拉黑'}</span>
            </button>
            <button className="up-action-btn up-action-danger" onClick={deleteFriend}>
              <IcoTrash size={20} />
              <span>删除</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
