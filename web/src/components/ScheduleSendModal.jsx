import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { IcoClock } from './Icons';

/**
 * 定时发送弹窗：选择发送时间后创建定时消息，到点由后端调度器自动发出。
 *
 * Props:
 *   convId          — 目标会话 ID
 *   defaultContent  — 预填内容（来自输入框）
 *   onClose         — 取消/关闭回调
 *   onScheduled     — 创建成功回调 (content) => void
 */
// datetime-local value 格式化：Date → "YYYY-MM-DDTHH:MM"（精确到分）
function toLocalInput(d) {
  d.setSeconds(0, 0);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ScheduleSendModal({ convId, defaultContent = '', onClose, onScheduled }) {
  const [content, setContent] = useState(defaultContent);
  const [sendAtLocal, setSendAtLocal] = useState('');
  const [minDateTime, setMinDateTime] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  // 挂载时：读一次当前时间（副作用，不在 render 中调 Date.now，保证 render 纯净），
  // 默认发送时间=1 小时后，最小可选=15 分钟后。同时聚焦内容框。
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const now = Date.now();
    setSendAtLocal(toLocalInput(new Date(now + 3600 * 1000)));
    setMinDateTime(toLocalInput(new Date(now + 15 * 60 * 1000)));
    inputRef.current?.focus();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!content.trim()) { setError('请输入发送内容'); return; }
    const sendAt = Math.floor(new Date(sendAtLocal).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
    if (sendAt - now < 14 * 60) { setError('发送时间至少需在 15 分钟后'); return; }
    if (sendAt - now > 30 * 24 * 3600) { setError('发送时间最多 30 天内'); return; }

    setSaving(true);
    try {
      await axios.post('/api/messages/schedule', {
        conversation_id: convId,
        content: content.trim(),
        type: 'text',
        send_at: sendAt,
      });
      onScheduled?.(content.trim());
    } catch (err) {
      setError(err.response?.data?.error || '创建定时消息失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="定时发送"
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* 遮罩 */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'var(--scrim, rgba(0,0,0,.4))' }}
      />
      {/* 弹窗 */}
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="ssm-card"
        style={{
          position: 'relative', zIndex: 1,
          background: 'var(--nt-surface)',
          border: '1px solid var(--nt-border)',
          borderRadius: 'var(--nt-r-xl)',
          boxShadow: 'var(--nt-shadow-lg)',
          width: Math.min(420, window.innerWidth - 32),
          padding: 24,
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--nt-text)', display: 'flex', alignItems: 'center', gap: 8 }}><IcoClock size={20} style={{ color: 'var(--nt-primary)' }} />定时发送</h3>

        {/* 内容 */}
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
            消息内容
          </span>
          <textarea
            className="ssm-input"
            ref={inputRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={3}
            placeholder="输入要定时发送的消息…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 10px', borderRadius: 'var(--nt-r-md)',
              border: '1px solid var(--nt-border-strong)',
              background: 'var(--nt-surface)',
              color: 'var(--text-primary)', fontSize: 'var(--text-base)', resize: 'vertical',
            }}
          />
        </label>

        {/* 时间选择 */}
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
            发送时间（15 分钟~30 天后）
          </span>
          <input
            className="ssm-input"
            type="datetime-local"
            value={sendAtLocal}
            min={minDateTime}
            onChange={e => setSendAtLocal(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 10px', borderRadius: 'var(--nt-r-md)',
              border: '1px solid var(--nt-border-strong)',
              background: 'var(--nt-surface)',
              color: 'var(--text-primary)', fontSize: 'var(--text-base)',
            }}
          />
        </label>

        {error && (
          <div style={{ fontSize: 'var(--text-sm2)', color: 'var(--color-danger)',
            marginBottom: 12, padding: '6px 10px',
            background: 'rgba(var(--nt-danger-rgb), .08)', borderRadius: 'var(--nt-r-sm)' }}>
            {error}
          </div>
        )}

        {/* 操作按钮 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="ssm-btn ssm-btn-secondary"
            style={{
              padding: '8px 18px', borderRadius: 'var(--nt-r-md)',
              border: '1px solid transparent',
              background: 'var(--nt-fill)', color: 'var(--nt-text)',
              cursor: 'pointer', fontSize: 'var(--text-base)',
            }}
          >取消</button>
          <button
            type="submit"
            disabled={saving || !content.trim()}
            className="ssm-btn ssm-btn-primary"
            style={{
              padding: '8px 18px', borderRadius: 'var(--nt-r-md)',
              border: 'none', background: 'var(--nt-primary)',
              color: 'var(--nt-on-primary)', cursor: 'pointer', fontSize: 'var(--text-base)', fontWeight: 600,
              opacity: (saving || !content.trim()) ? 0.4 : 1,
            }}
          >{saving ? '设置中…' : '确认定时发送'}</button>
        </div>
      </form>
    </div>
  );
}
