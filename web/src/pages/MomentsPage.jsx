import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';

const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, fill: '#191919' }}>
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
  </svg>
);

export default function MomentsPage({ onBack }) {
  const { user } = useAuth();
  const [moments, setMoments] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [publishText, setPublishText] = useState('');
  const [publishImages, setPublishImages] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});
  const [submittingComment, setSubmittingComment] = useState(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  const fetchMoments = useCallback(async (p = 1) => {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await axios.get('/api/moments', {
        params: { page: p, limit: 20 },
      });
      const items = Array.isArray(data) ? data : (data.moments || data.items || []);
      if (p === 1) {
        setMoments(items);
      } else {
        setMoments(prev => [...prev, ...items]);
      }
      setHasMore(items.length === 20);
      setPage(p);
    } catch (err) {
      console.error('Failed to load moments:', err);
    }
    setLoading(false);
  }, [loading]);

  useEffect(() => { fetchMoments(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || loading || !hasMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      fetchMoments(page + 1);
    }
  }, [loading, hasMore, page, fetchMoments]);

  const handlePublish = async () => {
    if (!publishText.trim() && publishImages.length === 0) return;
    setPublishing(true);
    try {
      const { data } = await axios.post('/api/moments', {
        text: publishText.trim(),
        images: publishImages,
      });
      setMoments(prev => [data.moment || data, ...prev]);
      setShowPublish(false);
      setPublishText('');
      setPublishImages([]);
    } catch (err) {
      alert(err.response?.data?.error || '发布失败');
    }
    setPublishing(false);
  };

  const handleLike = async (momentId) => {
    try {
      await axios.post(`/api/moments/${momentId}/like`);
      setMoments(prev => prev.map(m => {
        if (m.id !== momentId) return m;
        const liked = m.liked_by_me ?? m.isLiked ?? false;
        return {
          ...m,
          liked_by_me: !liked,
          likes_count: liked ? (m.likes_count || 0) - 1 : (m.likes_count || 0) + 1,
        };
      }));
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  const handleComment = async (momentId) => {
    const text = commentInputs[momentId]?.trim();
    if (!text) return;
    setSubmittingComment(momentId);
    try {
      const { data } = await axios.post(`/api/moments/${momentId}/comment`, { text });
      const newComment = data.comment || data;
      setMoments(prev => prev.map(m => {
        if (m.id !== momentId) return m;
        return { ...m, comments: [...(m.comments || []), newComment] };
      }));
      setCommentInputs(prev => ({ ...prev, [momentId]: '' }));
    } catch (err) {
      alert(err.response?.data?.error || '评论失败');
    }
    setSubmittingComment(null);
  };

  const handleImagePick = (e) => {
    const files = Array.from(e.target.files || []);
    setPublishImages(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F5F5F5' }}>
      {/* Header */}
      <div className="wc-panel-topbar" style={{ justifyContent: 'space-between', padding: '0 14px' }}>
        <button onClick={onBack} style={{ color: '#191919', display: 'flex', alignItems: 'center', gap: 4, fontSize: 15 }}>
          <ChevronLeft />
          发现
        </button>
        <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>朋友圈</span>
        <button
          onClick={() => setShowPublish(true)}
          style={{
            color: '#07C160', fontSize: 14, fontWeight: 500,
            padding: '4px 12px', borderRadius: 4,
            border: '1px solid #07C160',
          }}
        >
          发布
        </button>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}
      >
        {moments.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>📷</div>
            <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>暂无朋友圈动态</p>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>点击右上角「发布」分享生活</p>
          </div>
        )}

        {moments.map((moment) => {
          const isLiked = moment.liked_by_me ?? moment.isLiked ?? false;
          const images = moment.images || [];
          const comments = moment.comments || [];

          return (
            <div key={moment.id} className="wc-moment-card">
              <div style={{ display: 'flex', gap: 12, padding: '14px 16px' }}>
                {/* Avatar */}
                <div style={{ flexShrink: 0 }}>
                  <Avatar
                    src={moment.user?.avatar || moment.avatar}
                    name={moment.user?.username || moment.username || '?'}
                    size={42}
                  />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Username */}
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#576B95', marginBottom: 4 }}>
                    {moment.user?.username || moment.username || '用户'}
                  </div>

                  {/* Text content */}
                  {moment.text && (
                    <div style={{
                      fontSize: 15, color: '#191919', lineHeight: 1.55,
                      marginBottom: images.length > 0 ? 10 : 0,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {moment.text}
                    </div>
                  )}

                  {/* Images grid */}
                  {images.length > 0 && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, 1fr)`,
                      gap: 4,
                      maxWidth: images.length === 1 ? 200 : 240,
                      marginBottom: 10,
                    }}>
                      {images.map((img, i) => (
                        <img
                          key={i}
                          src={img.thumbnail || img.url || img}
                          alt=""
                          style={{
                            width: '100%',
                            aspectRatio: images.length === 1 ? 'auto' : '1',
                            borderRadius: 4,
                            objectFit: 'cover',
                            cursor: 'pointer',
                            maxHeight: images.length === 1 ? 200 : undefined,
                          }}
                          onClick={() => window.open(img.url || img, '_blank')}
                        />
                      ))}
                    </div>
                  )}

                  {/* Time and actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#B2B2B2' }}>
                      {formatTime(moment.created_at)}
                    </span>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <button
                        onClick={() => handleLike(moment.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          fontSize: 12, color: isLiked ? '#07C160' : '#B2B2B2',
                          border: 'none', background: 'none', cursor: 'pointer',
                          padding: 2,
                        }}
                      >
                        <span>{isLiked ? '❤️' : '🤍'}</span>
                        {moment.likes_count > 0 && <span>{moment.likes_count}</span>}
                      </button>
                      <button
                        onClick={() => {
                          setCommentInputs(prev => ({
                            ...prev,
                            [moment.id]: prev[moment.id] ?? '',
                          }));
                          setTimeout(() => {
                            const el = document.getElementById(`comment-input-${moment.id}`);
                            el?.focus();
                          }, 100);
                        }}
                        style={{
                          fontSize: 12, color: '#B2B2B2',
                          border: 'none', background: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 3, padding: 2,
                        }}
                      >
                        💬 {comments.length > 0 && <span>{comments.length}</span>}
                      </button>
                    </div>
                  </div>

                  {/* Comments section */}
                  {comments.length > 0 && (
                    <div style={{
                      background: 'rgba(0,0,0,.03)',
                      borderRadius: 4, padding: '8px 10px',
                      marginBottom: 6,
                    }}>
                      {comments.map((c, ci) => (
                        <div key={c.id || ci} style={{
                          fontSize: 14, color: '#333', lineHeight: 1.6,
                          marginBottom: ci < comments.length - 1 ? 4 : 0,
                          wordBreak: 'break-word',
                        }}>
                          <span style={{ color: '#576B95', fontWeight: 500 }}>
                            {c.user?.username || c.username || '用户'}
                          </span>
                          : {c.text}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Comment input */}
                  {commentInputs[moment.id] !== undefined && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        id={`comment-input-${moment.id}`}
                        value={commentInputs[moment.id]}
                        onChange={e => setCommentInputs(prev => ({ ...prev, [moment.id]: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleComment(moment.id);
                          if (e.key === 'Escape') {
                            setCommentInputs(prev => {
                              const next = { ...prev };
                              delete next[moment.id];
                              return next;
                            });
                          }
                        }}
                        placeholder="写评论..."
                        style={{
                          flex: 1, fontSize: 13, padding: '6px 10px',
                          borderRadius: 4, border: '1px solid rgba(0,0,0,.1)',
                          outline: 'none', background: '#fff',
                        }}
                      />
                      <button
                        onClick={() => handleComment(moment.id)}
                        disabled={submittingComment === moment.id || !commentInputs[moment.id]?.trim()}
                        style={{
                          fontSize: 12, color: '#fff', background: '#07C160',
                          border: 'none', borderRadius: 4, padding: '6px 12px',
                          cursor: 'pointer', opacity: submittingComment === moment.id ? 0.6 : 1,
                        }}
                      >
                        {submittingComment === moment.id ? '...' : '发送'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: 'var(--text-tertiary)' }}>
            加载中…
          </div>
        )}

        {!hasMore && moments.length > 0 && (
          <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: '#B2B2B2' }}>
            — 没有更多了 —
          </div>
        )}
      </div>

      {/* Publish modal */}
      {showPublish && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(0,0,0,.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPublish(false); }}
        >
          <div style={{
            width: 400, maxWidth: '90vw', maxHeight: '80vh',
            background: '#fff', borderRadius: 12,
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 12px 40px rgba(0,0,0,.2)',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 16px', borderBottom: '1px solid #EBEBEB',
            }}>
              <button onClick={() => setShowPublish(false)} style={{ fontSize: 14, color: '#999' }}>取消</button>
              <span style={{ fontSize: 16, fontWeight: 600 }}>发表朋友圈</span>
              <button
                onClick={handlePublish}
                disabled={publishing || (!publishText.trim() && publishImages.length === 0)}
                style={{
                  fontSize: 14, color: '#fff', background: '#07C160',
                  padding: '6px 16px', borderRadius: 4, border: 'none',
                  cursor: 'pointer', opacity: publishing ? 0.6 : 1,
                }}
              >
                {publishing ? '发布中…' : '发表'}
              </button>
            </div>
            <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
              <textarea
                autoFocus
                value={publishText}
                onChange={e => setPublishText(e.target.value)}
                placeholder="分享生活点滴..."
                rows={4}
                style={{
                  width: '100%', fontSize: 15, border: 'none', outline: 'none',
                  resize: 'none', lineHeight: 1.55, marginBottom: 12,
                }}
              />
              {publishImages.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {publishImages.map((img, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img
                        src={img}
                        alt=""
                        style={{ width: 80, height: 80, borderRadius: 4, objectFit: 'cover' }}
                      />
                      <button
                        onClick={() => setPublishImages(prev => prev.filter((_, j) => j !== i))}
                        style={{
                          position: 'absolute', top: -6, right: -6,
                          width: 20, height: 20, borderRadius: 10,
                          background: '#FA5151', color: '#fff', fontSize: 12,
                          border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, color: '#07C160', cursor: 'pointer',
                padding: '6px 12px', borderRadius: 4,
                border: '1px dashed #07C160',
              }}>
                <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: '#07C160' }}>
                  <path d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/>
                </svg>
                添加图片
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImagePick}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
