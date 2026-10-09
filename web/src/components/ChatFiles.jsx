import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { mediaUrl } from '../utils/url';
import { downloadFile } from '../utils/download';
import { format } from '../utils/time';
import Avatar from './Avatar';
import ImagePreview from './ImagePreview';
import VideoPreview from './VideoPreview';
import { IcoArrowLeft, IcoFile, IcoFolder, IcoVideoFile } from './Icons';
import { EmptyState, ErrorState, Skeleton } from './StateViews';

/**
 * 聊天文件聚合视图（抽屉面板）
 * Props:  convId — 会话 ID  |  onClose — 关闭回调
 */

const TABS = [
  { key: 'all',   label: '全部' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'file',  label: '文件' },
];

const FILE_ICON_STYLE = { color: 'var(--nt-primary)', opacity: .75 };

export default function ChatFiles({ convId, onClose }) {
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [preview, setPreview] = useState(null);
  const loaderRef = useRef(null);
  const requestRef = useRef(null);
  const LIMIT = 30;

  const load = useCallback(async (currentOffset) => {
    if (requestRef.current) return;
    const request = new AbortController();
    requestRef.current = request;
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(
        `/api/messages/conversation/${convId}/files`,
        { params: { type: tab, offset: currentOffset, limit: LIMIT }, signal: request.signal, timeout: 15000 }
      );
      if (requestRef.current !== request) return;
      setItems(prev => currentOffset === 0 ? data.items : [...prev, ...data.items]);
      setTotal(data.total);
      setHasMore(currentOffset + data.items.length < data.total);
      setOffset(currentOffset + data.items.length);
      setLoaded(true);
    } catch (err) {
      if (requestRef.current !== request || axios.isCancel(err)) return;
      setError(currentOffset === 0 ? '文件加载失败，请检查网络后重试' : '更多文件加载失败，已加载的文件仍可查看');
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [convId, tab]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
    setTotal(0);
    setLoaded(false);
    setPreview(null);
    load(0);
    return () => {
      const request = requestRef.current;
      requestRef.current = null;
      request?.abort();
    };
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && loaded && hasMore && !loading && !error) load(offset);
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, offset, load, error, loaded]);

  const handleClick = (item) => {
    if (item.type === 'image' || item.type === 'video') {
      setPreview({ url: mediaUrl(item.fileUrl), type: item.type, name: item.fileName });
    } else {
      downloadFile(mediaUrl(item.fileUrl), item.fileName || 'download');
    }
  };

  return (
    <div
      role="dialog"
      aria-label="聊天文件"
      style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}
    >
      {/* 遮罩 */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.28)' }}
      />

      {/* 面板 */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: Math.min(400, window.innerWidth),
        height: '100vh',
        background: 'var(--bg-panel)',
        display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
      }}>

        {/* 标题栏 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '14px 16px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-default)',
        }}>
          <button
            onClick={onClose}
            aria-label="关闭聊天文件"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 6, borderRadius: 8, color: 'var(--text-secondary)',
              transition: 'background .12s, color .12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <IcoArrowLeft size={20} style={{ display: 'block' }} />
          </button>
          <span style={{ fontWeight: 600, fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>聊天文件</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginLeft: 'auto' }}>
            {loaded ? `共 ${total} 项` : loading ? '加载中…' : '暂未加载'}
          </span>
        </div>

        {/* Tab 栏 */}
        <div style={{
          display: 'flex',
          padding: '6px 8px 0',
          background: 'var(--bg-panel)',
          borderBottom: '1px solid var(--border-default)',
          gap: 2,
        }} role="tablist" aria-label="文件类型">
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                onClick={() => setTab(t.key)}
                aria-selected={active}
                style={{
                  flex: 1,
                  padding: '7px 0 9px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm2)',
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--green)' : 'var(--text-tertiary)',
                  position: 'relative',
                  transition: 'color .15s',
                }}
              >
                {t.label}
                {active && (
                  <span style={{
                    position: 'absolute', bottom: 0, left: '50%',
                    transform: 'translateX(-50%)',
                    width: 24, height: 2.5,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--green)',
                    opacity: .85,
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* 文件列表 */}
        <div style={{
          flex: 1, overflowY: 'auto',
          background: 'var(--bg-messages)',
          padding: '6px 0',
        }}>
          {items.length === 0 && !loading && !error && loaded && <EmptyState icon={<IcoFolder size={28} />} title="暂无文件" desc="聊天中收到的图片、视频和文件会显示在这里" />}
          {items.length === 0 && loading && <Skeleton rows={5} />}

          {items.map(item => (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={`打开 ${item.fileName || item.caption || '文件'}`}
              onClick={() => handleClick(item)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(item); } }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px',
                margin: '0 8px 4px',
                borderRadius: 'var(--nt-r-md)',
                cursor: 'pointer',
                background: 'var(--bg-card)',
                boxShadow: 'var(--nt-shadow-xs)',
                transition: 'background .1s, box-shadow .1s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bg-card-hover)';
                e.currentTarget.style.boxShadow = 'var(--nt-shadow-sm)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--bg-card)';
                e.currentTarget.style.boxShadow = 'var(--nt-shadow-xs)';
              }}
            >
              {/* 缩略图 / 图标 */}
              <div style={{
                flexShrink: 0, width: 46, height: 46, borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                background: 'var(--nt-primary-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {item.type === 'image' ? (
                  <img
                    src={mediaUrl(item.fileUrl)}
                    alt={item.fileName}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                ) : item.type === 'video' ? <IcoVideoFile size={26} style={FILE_ICON_STYLE} /> : <IcoFile size={26} style={FILE_ICON_STYLE} />}
              </div>

              {/* 信息 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--text-sm2)', fontWeight: 500,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  color: 'var(--text-primary)',
                }}>
                  {item.fileName || (item.type === 'image' ? '图片' : item.type === 'video' ? '视频' : '文件')}
                </div>
                <div style={{
                  fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', marginTop: 3,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Avatar src={item.senderAvatar} name={item.senderName} size={13}
                    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.senderName} · {format(item.createdAt * 1000)}
                  </span>
                </div>
              </div>
            </div>
          ))}

          <div ref={loaderRef} style={{ height: 1 }} />
          {error && <ErrorState title="文件加载失败" desc={error} onRetry={() => load(offset)} />}
          {items.length > 0 && loading && (
            <div role="status" style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-secondary)', fontSize: 'var(--text-sm2)' }}>
              加载中…
            </div>
          )}
        </div>
      </div>

      {preview && (
        preview.type === 'video'
          ? <VideoPreview url={preview.url} name={preview.name} onClose={() => setPreview(null)} />
          : <ImagePreview url={preview.url} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
