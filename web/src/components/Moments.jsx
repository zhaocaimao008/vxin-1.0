import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import { useAuth } from '../contexts/AuthContext';
import { format } from '../utils/time';

export default function Moments({ onBack }) {
  const [moments, setMoments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState('');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);
  const { user, updateUser } = useAuth();

  useEffect(() => {
    axios.get('/api/moments').then(r => setMoments(r.data));
  }, []);

  const handleFiles = (e) => {
    const selected = [...e.target.files];
    setFiles(selected);
    setPreviews(selected.map(f => URL.createObjectURL(f)));
  };

  const post = async () => {
    if (!content.trim() && !files.length) return;
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append('content', content);
      files.forEach(f => fd.append('images', f));
      const { data } = await axios.post('/api/moments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMoments(prev => [data, ...prev]);
      setContent(''); setFiles([]); setPreviews([]); setShowForm(false);
    } catch { alert('发布失败'); }
    setPosting(false);
  };

  const like = async (id) => {
    const { data } = await axios.post(`/api/moments/${id}/like`);
    // refetch to get updated likedUsers
    const { data: updated } = await axios.get('/api/moments');
    setMoments(updated);
  };

  const deleteMoment = async (id) => {
    if (!window.confirm('确定删除这条朋友圈？')) return;
    await axios.delete(`/api/moments/${id}`);
    setMoments(prev => prev.filter(m => m.id !== id));
  };

  const addComment = (id, text) => {
    axios.post(`/api/moments/${id}/comment`, { content: text }).then(({ data }) => {
      setMoments(prev => prev.map(m => m.id === id ? { ...m, comments: [...(m.comments || []), data] } : m));
    });
  };

  const uploadCover = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('cover', file);
    const { data } = await axios.post('/api/users/cover', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    updateUser({ cover_photo: data.cover_photo });
  };

  return (
    <div className="wc-moments">
      {/* Cover */}
      <div className="wc-moments-cover" style={{ cursor: 'pointer' }} onClick={() => {}}>
        {user?.cover_photo
          ? <img src={user.cover_photo} alt="封面" />
          : <div className="wc-moments-cover-bg" />
        }
        <div className="wc-moments-profile">
          <span className="wc-moments-uname">{user?.username}</span>
          <Avatar src={user?.avatar} name={user?.username} size={56} style={{ borderRadius: 8, border: '2px solid rgba(255,255,255,0.8)' }} />
        </div>
        {/* Change cover */}
        <label style={{ position: 'absolute', bottom: 8, left: 12, background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer' }}>
          更换封面
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadCover} />
        </label>
      </div>

      {/* Post form */}
      {showForm && (
        <div style={{ background: '#fff', padding: 14, borderBottom: '6px solid #F5F5F5' }}>
          <textarea
            style={{ width: '100%', border: 'none', outline: 'none', fontSize: 15, lineHeight: 1.6, resize: 'none', minHeight: 80 }}
            placeholder="这一刻的想法..."
            value={content}
            onChange={e => setContent(e.target.value)}
            autoFocus
          />
          {previews.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(previews.length, 3)}, 80px)`, gap: 4, marginBottom: 10 }}>
              {previews.map((p, i) => (
                <img key={i} src={p} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }} alt="" />
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ cursor: 'pointer', color: '#888', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              🖼️ 图片
              <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={handleFiles} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ padding: '6px 14px', background: '#F5F5F5', borderRadius: 5, fontSize: 13, color: '#555' }} onClick={() => setShowForm(false)}>取消</button>
              <button style={{ padding: '6px 18px', background: '#07C160', color: '#fff', borderRadius: 5, fontSize: 13, fontWeight: 500 }} onClick={post} disabled={posting}>{posting ? '发送中...' : '发表'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Actions bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 14px', background: '#F5F5F5' }}>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#fff', border: '1px solid #E5E5E5', borderRadius: 18, fontSize: 13, color: '#555' }} onClick={() => setShowForm(!showForm)}>
          📷 发朋友圈
        </button>
      </div>

      {/* Feed */}
      <div className="wc-moments-feed">
        {moments.map(m => (
          <MomentCard key={m.id} moment={m} userId={user?.id} onLike={() => like(m.id)} onComment={(t) => addComment(m.id, t)} onDelete={m.user_id === user?.id ? () => deleteMoment(m.id) : null} />
        ))}
        {moments.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#B2B2B2', fontSize: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌐</div>
            还没有朋友圈，快来发布吧
          </div>
        )}
      </div>
    </div>
  );
}

function MomentCard({ moment, userId, onLike, onComment, onDelete }) {
  const [showComment, setShowComment] = useState(false);
  const [commentText, setCommentText] = useState('');
  const commentRef = useRef(null);
  const liked = moment.likes?.includes(userId);
  const images = moment.images || [];

  const cols = images.length === 1 ? 1 : images.length <= 4 ? 2 : 3;
  const imgSize = images.length === 1 ? 200 : undefined;

  const submitComment = () => {
    if (!commentText.trim()) return;
    onComment(commentText.trim());
    setCommentText(''); setShowComment(false);
  };

  return (
    <div className="wc-moment-card">
      <div className="wc-moment-left">
        <Avatar src={moment.avatar} name={moment.username} size={42} />
      </div>
      <div className="wc-moment-right">
        <div className="wc-moment-name">{moment.username}</div>
        {moment.content && <div className="wc-moment-text">{moment.content}</div>}
        {images.length > 0 && (
          <div className="wc-moment-images" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, maxWidth: cols === 1 ? imgSize : undefined }}>
            {images.map((img, i) => (
              <img key={i} src={img} className="wc-moment-img" alt="" onClick={() => window.open(img)}
                style={images.length === 1 ? { width: 200, height: 200, aspectRatio: undefined } : undefined} />
            ))}
          </div>
        )}
        <div className="wc-moment-meta">
          <span className="wc-moment-time">{format(moment.created_at * 1000)}</span>
          <div className="wc-moment-action-bar">
            {onDelete && (
              <button className="wc-moment-btn" style={{ color: '#FA5151' }} onClick={onDelete}>🗑️ 删除</button>
            )}
            <button className={`wc-moment-btn${liked ? ' liked' : ''}`} onClick={onLike}>
              👍 {liked ? '取消' : '赞'}
            </button>
            <button className="wc-moment-btn" onClick={() => { setShowComment(!showComment); setTimeout(() => commentRef.current?.focus(), 50); }}>
              💬 评论
            </button>
          </div>
        </div>

        {/* Social (likes + comments) */}
        {(moment.likes?.length > 0 || moment.comments?.length > 0) && (
          <div className="wc-moment-social">
            {moment.likes?.length > 0 && (
              <div className="wc-moment-likes">
                <span>👍</span>
                {(moment.likedUsers || []).map((u, i) => (
                  <span key={u.id} className="wc-moment-like-name">
                    {u.id === userId ? '你' : u.username}{i < moment.likes.length - 1 ? '，' : ''}
                  </span>
                ))}
              </div>
            )}
            {moment.comments?.length > 0 && moment.likes?.length > 0 && (
              <div style={{ height: 1, background: '#E0E0E0', marginBottom: 6 }} />
            )}
            <div className="wc-moment-comments">
              {moment.comments?.map(c => (
                <div key={c.id} className="wc-moment-comment">
                  <span className="wc-moment-comment-name">{c.username}</span>：{c.content}
                </div>
              ))}
            </div>
          </div>
        )}

        {showComment && (
          <div className="wc-moment-cmt-input">
            <input
              ref={commentRef}
              placeholder="评论..."
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitComment(); if (e.key === 'Escape') setShowComment(false); }}
            />
            <button className="wc-moment-cmt-send" onClick={submitComment}>发送</button>
          </div>
        )}
      </div>
    </div>
  );
}
