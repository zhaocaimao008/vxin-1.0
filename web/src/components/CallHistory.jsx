import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import { Skeleton } from './StateViews';

function ago(sec) {
  // 钳到 0：时钟偏差/服务器时间超前时避免出现「-3分钟前」
  const d = Math.max(0, Date.now() / 1000 - sec);
  if (d < 60) return '刚刚';
  if (d < 3600) return Math.floor(d / 60) + '分钟前';
  if (d < 86400) return Math.floor(d / 3600) + '小时前';
  const dt = new Date(sec * 1000);
  return `${dt.getMonth() + 1}月${dt.getDate()}日`;
}

function fmtDuration(s) {
  if (!s) return '';
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}分${sec}秒` : `${sec}秒`;
}

// 状态 → 中文 + 颜色
const STATUS = {
  completed: { label: '已接通', color: 'var(--text-tertiary)' },
  missed:    { label: '未接听', color: 'var(--color-badge)' },
  canceled:  { label: '已取消', color: 'var(--color-badge)' },
  rejected:  { label: '已拒绝', color: 'var(--color-badge)' },
  ongoing:   { label: '通话中', color: 'var(--green)' },
};

export default function CallHistory({ onOpenChat }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // 重试用：显示转圈后重新拉取
  const load = useCallback(() => {
    setLoading(true);
    axios.get('/api/users/me/call-logs')
      .then(r => { setList(r.data); setLoadError(false); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  // 初次挂载拉取：loading 初值已为 true，effect 内不做同步 setState（避免级联渲染）
  useEffect(() => {
    let alive = true;
    axios.get('/api/users/me/call-logs')
      .then(r => { if (alive) { setList(r.data); setLoadError(false); } })
      .catch(() => { if (alive) setLoadError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // 点击通话记录 → 打开对方会话（回拨/继续聊天），对齐移动端
  const openPeer = async (c) => {
    if (!c.peer_id || !onOpenChat) return;
    try {
      const { data } = await axios.post('/api/messages/conversation/private', { userId: c.peer_id });
      onOpenChat({ id: data.conversationId, type: 'private', name: c.peer_name, avatar: c.peer_avatar, otherUser: { id: c.peer_id, username: c.peer_name, avatar: c.peer_avatar } });
    } catch { /* 静默失败，用户可重试 */ }
  };

  return (
    <div className="ch-page">
      {/* 顶栏 */}
      <div className="ch-header">
        <span className="ch-title">最近通话</span>
      </div>
      {loading ? (
        <Skeleton rows={6} avatar />
      ) : loadError && list.length === 0 ? (
        <div className="ch-empty" role="status">
          加载失败，<button onClick={load} className="ch-retry">点击重试</button>
        </div>
      ) : list.length === 0 ? (
        <div className="ch-empty" role="status">
          <svg viewBox="0 0 48 48" width="48" height="48" fill="none" className="ch-empty-ico">
            <circle cx="24" cy="24" r="22" fill="rgba(7,193,96,.08)"/>
            <path d="M16.6 20.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V30c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L16.6 20.8z" fill="rgba(7,193,96,.35)"/>
          </svg>
          <span>暂无通话记录</span>
        </div>
      ) : (
        <div className="ch-list">
          {list.map(c => {
            const st = STATUS[c.status] || STATUS.completed;
            const isMissed = c.direction === 'in' && (c.status === 'missed' || c.status === 'canceled');
            return (
              <div key={c.id} data-testid="call-log-item"
                className="ch-item"
                onClick={() => openPeer(c)}
                role={onOpenChat ? 'button' : undefined}
                tabIndex={onOpenChat ? 0 : undefined}
                onKeyDown={e => { if (onOpenChat && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPeer(c); } }}
              >
                <Avatar src={c.peer_avatar} name={c.peer_name} size={44} />
                <div className="ch-info">
                  <div className={`ch-name${isMissed ? ' missed' : ''}`}>
                    {c.peer_name || '用户'}
                  </div>
                  <div className="ch-meta">
                    {/* 方向图标 */}
                    <svg className={`ch-dir-ico${isMissed ? ' missed' : ''}`} viewBox="0 0 16 16" fill="currentColor">
                      {c.direction === 'out'
                        ? <path d="M13 3L3 13M13 3H7M13 3V9"/>
                        : <path d="M3 3L13 13M3 3H9M3 3V9"/>
                      }
                    </svg>
                    <span style={{ color: st.color }}>
                      {c.direction === 'out' ? '去电' : '来电'} · {c.type === 'video' ? '视频' : '语音'} · {st.label}
                    </span>
                    {c.duration > 0 && <span className="ch-dur">{fmtDuration(c.duration)}</span>}
                  </div>
                </div>
                <div className="ch-right">
                  <span className="ch-time">{ago(c.created_at)}</span>
                  {/* 回拨按钮 */}
                  {onOpenChat && (
                    <svg className="ch-call-ico" viewBox="0 0 24 24" fill="currentColor" title="发起通话">
                      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
