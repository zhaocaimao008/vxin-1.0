import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import { useSocket } from '../contexts/SocketContext';

export default function NewFriendsPage({ onClose }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  // { [id]: 'loading' | 'accepted' }
  const [handled, setHandled] = useState({});
  const { socket } = useSocket();

  const fetchRequests = useCallback(() => {
    setLoading(true);
    axios.get('/api/users/friend-requests')
      .then(r => { setRequests(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    if (!socket) return;
    const onNew = (req) => setRequests(prev => [req, ...prev]);
    socket.on('new_friend_request', onNew);
    return () => socket.off('new_friend_request', onNew);
  }, [socket]);

  const accept = async (req) => {
    const id = req.id;
    setHandled(h => ({ ...h, [id]: 'loading' }));
    try {
      await axios.post(`/api/users/friend-request/${id}/handle`, { action: 'accepted' });
      setHandled(h => ({ ...h, [id]: 'accepted' }));
      // 通知 ContactList 刷新 badge
      window.dispatchEvent(new CustomEvent('vxin:friend-added'));
    } catch {
      setHandled(h => { const n = { ...h }; delete n[id]; return n; });
    }
  };

  const displayName = (req) => req.username || req.from?.username || '未知用户';
  const displayAvatar = (req) => req.avatar || req.from?.avatar;

  const visible = requests.filter(r => handled[r.id] !== 'rejected');

  return (
    <div className="nf-page">

      {/* ── 标题栏 ── */}
      <div className="nf-header">
        <span className="nf-header-title">新的朋友</span>
      </div>

      {/* ── 列表 ── */}
      <div className="nf-list">
        {loading && (
          <div className="nf-loading">
            <div className="nf-spinner" />
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="nf-empty" role="status">
            {/* 空状态 SVG：带 + 号的人群剪影 */}
            <svg className="nf-empty-icon" viewBox="0 0 120 96" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* 左侧人 */}
              <circle cx="38" cy="30" r="14" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              <path d="M10 80c0-15.46 12.54-28 28-28s28 12.54 28 80" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              {/* 右侧人（虚线） */}
              <circle cx="82" cy="30" r="12" stroke="currentColor" strokeWidth="2.5" strokeDasharray="5 3" strokeLinecap="round"/>
              <path d="M58 80c0-13.25 10.75-24 24-24" stroke="currentColor" strokeWidth="2.5" strokeDasharray="5 3" strokeLinecap="round"/>
              {/* + 号 */}
              <line x1="98" y1="56" x2="98" y2="76" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              <line x1="88" y1="66" x2="108" y2="66" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            <p className="nf-empty-title">暂无新的好友请求</p>
            <p className="nf-empty-sub">当有人申请添加你时，会在这里显示</p>
          </div>
        )}

        {!loading && visible.length > 0 && (
          <>
            <div className="nf-section-label">好友申请 · {visible.length} 条</div>
            {visible.map(req => {
              const id = req.id;
              const state = handled[id]; // undefined | 'loading' | 'accepted'
              const name = displayName(req);
              const avatar = displayAvatar(req);
              const msg = req.message || req.from?.message || '';

              return (
                <div key={id} className="nf-item">
                  {/* 头像 */}
                  <div className="nf-avatar">
                    <Avatar src={avatar} name={name} size={48} style={{ borderRadius: 10 }} />
                  </div>

                  {/* 昵称 + 验证消息 */}
                  <div className="nf-info">
                    <div className="nf-name">{name}</div>
                    {msg && <div className="nf-msg">{msg}</div>}
                  </div>

                  {/* 操作区 */}
                  <div className="nf-action">
                    {state === 'accepted' ? (
                      <span className="nf-accepted">已添加</span>
                    ) : (
                      <button
                        className="nf-accept-btn"
                        onClick={() => accept(req)}
                        disabled={state === 'loading'}
                      >
                        {state === 'loading'
                          ? <span className="nf-btn-spinner" />
                          : (
                            <>
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                              </svg>
                              同意
                            </>
                          )
                        }
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
