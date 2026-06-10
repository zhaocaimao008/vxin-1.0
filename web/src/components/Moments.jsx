import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import { useAuth } from '../contexts/AuthContext';

function ago(sec) {
  const d = Date.now() / 1000 - sec;
  if (d < 60) return '刚刚';
  if (d < 3600) return Math.floor(d / 60) + '分钟前';
  if (d < 86400) return Math.floor(d / 3600) + '小时前';
  if (d < 2592000) return Math.floor(d / 86400) + '天前';
  return new Date(sec * 1000).toLocaleDateString('zh-CN');
}

/* 单条动态 */
function MomentCard({ m, meId, onLike, onComment, onDelete, onDeleteComment }) {
  const [commenting, setCommenting] = useState(false);
  const [text, setText] = useState('');

  const submit = () => {
    if (!text.trim()) return;
    onComment(m, text.trim(), () => { setText(''); setCommenting(false); });
  };

  return (
    <div style={{ display: 'flex', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--border-color)' }}>
      <Avatar src={m.author?.avatar} name={m.author?.username} size={42} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{m.author?.username || '用户'}</span>
          {m.user_id === meId && (
            <button onClick={() => onDelete(m)} style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'none', cursor: 'pointer' }}>删除</button>
          )}
        </div>
        {m.content && <div style={{ fontSize: 14.5, color: 'var(--text-primary)', margin: '4px 0 8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}>{m.content}</div>}

        {/* 图片九宫格 */}
        {m.images?.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(m.images.length, 3)}, 1fr)`, gap: 4, margin: '6px 0 8px', maxWidth: 300 }}>
            {m.images.map((src, i) => (
              <img key={i} src={src} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6 }} />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{ago(m.created_at)}</span>
          <button onClick={() => onLike(m)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', cursor: 'pointer', fontSize: 13, color: m.liked ? '#07C160' : 'var(--text-secondary)' }}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            {m.likeCount > 0 ? m.likeCount : '赞'}
          </button>
          <button onClick={() => setCommenting(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            {m.commentCount > 0 ? m.commentCount : '评论'}
          </button>
        </div>

        {/* 点赞者 */}
        {m.likes?.length > 0 && (
          <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--bg-hover)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            <span style={{ color: '#07C160' }}>♥ </span>
            {m.likes.map(l => l.username).join('、')}
          </div>
        )}

        {/* 评论列表 */}
        {m.comments?.length > 0 && (
          <div style={{ marginTop: 6, padding: '4px 10px', background: 'var(--bg-hover)', borderRadius: 8 }}>
            {m.comments.map(c => (
              <div key={c.id} style={{ fontSize: 13, color: 'var(--text-primary)', padding: '3px 0', lineHeight: 1.5 }}>
                <span style={{ color: '#576B95', fontWeight: 500 }}>{c.username}</span>
                {c.reply_to_user ? <span style={{ color: 'var(--text-tertiary)' }}> 回复 {c.reply_to_user}</span> : null}
                <span>：{c.content}</span>
                {(c.user_id === meId || m.user_id === meId) && (
                  <button onClick={() => onDeleteComment(m, c)} style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-tertiary)', background: 'none', cursor: 'pointer' }}>删</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 评论输入 */}
        {commenting && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input autoFocus value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setCommenting(false); }}
              placeholder="评论…" maxLength={500}
              style={{ flex: 1, fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }} />
            <button onClick={submit} style={{ padding: '0 14px', borderRadius: 8, background: '#07C160', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>发送</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Moments() {
  const { user } = useAuth();
  const meId = user?.id;
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [composing, setComposing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    axios.get('/api/moments').then(r => setList(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const publish = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      const { data } = await axios.post('/api/moments', { content: text.trim() });
      setList(p => [data, ...p]);
      setText(''); setComposing(false);
    } catch (e) { alert(e.response?.data?.error || '发布失败'); }
    setPosting(false);
  };

  const onLike = async (m) => {
    try {
      const { data } = await axios.post(`/api/moments/${m.id}/like`);
      setList(p => p.map(x => {
        if (x.id !== m.id) return x;
        const likes = data.liked
          ? [...(x.likes || []), { user_id: meId, username: user?.username }]
          : (x.likes || []).filter(l => l.user_id !== meId);
        return { ...x, liked: data.liked, likeCount: data.likeCount, likes };
      }));
    } catch {}
  };

  const onComment = async (m, content, clear) => {
    try {
      const { data } = await axios.post(`/api/moments/${m.id}/comment`, { content });
      setList(p => p.map(x => x.id === m.id ? { ...x, comments: [...(x.comments || []), data], commentCount: (x.commentCount || 0) + 1 } : x));
      clear();
    } catch (e) { alert(e.response?.data?.error || '评论失败'); }
  };

  const onDelete = async (m) => {
    if (!window.confirm('删除这条动态？')) return;
    try { await axios.delete(`/api/moments/${m.id}`); setList(p => p.filter(x => x.id !== m.id)); } catch {}
  };

  const onDeleteComment = async (m, c) => {
    try {
      await axios.delete(`/api/moments/comments/${c.id}`);
      setList(p => p.map(x => x.id === m.id ? { ...x, comments: x.comments.filter(cc => cc.id !== c.id), commentCount: x.commentCount - 1 } : x));
    } catch {}
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 发布区 */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        {!composing ? (
          <button onClick={() => setComposing(true)}
            style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 10, background: 'var(--bg-search)', color: 'var(--text-tertiary)', fontSize: 14, cursor: 'pointer', border: '1px solid var(--border-color)' }}>
            分享新动态…
          </button>
        ) : (
          <div>
            <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={3}
              placeholder="这一刻的想法…" maxLength={5000}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 14, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none', resize: 'none', lineHeight: 1.5 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button onClick={() => { setComposing(false); setText(''); }}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-search)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>取消</button>
              <button onClick={publish} disabled={posting || !text.trim()}
                style={{ padding: '7px 18px', borderRadius: 8, background: posting || !text.trim() ? 'rgba(7,193,96,.4)' : '#07C160', color: '#fff', fontSize: 13, fontWeight: 600, cursor: posting || !text.trim() ? 'not-allowed' : 'pointer' }}>
                {posting ? '发布中…' : '发布'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 时间线 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 13 }}>加载中…</div>
        ) : list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 13 }}>还没有动态，发布第一条吧</div>
        ) : (
          list.map(m => (
            <MomentCard key={m.id} m={m} meId={meId}
              onLike={onLike} onComment={onComment} onDelete={onDelete} onDeleteComment={onDeleteComment} />
          ))
        )}
      </div>
    </div>
  );
}
