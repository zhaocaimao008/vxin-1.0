import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ username: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/register', form);
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || '注册失败');
    } finally { setLoading(false); }
  };

  const fields = [
    { key: 'username', label: '昵称', type: 'text', placeholder: '请输入昵称', icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M10 11a4 4 0 100-8 4 4 0 000 8zM3 18c0-3.3 3.1-6 7-6s7 2.7 7 6"/>
      </svg>
    )},
    { key: 'phone', label: '手机号', type: 'tel', placeholder: '请输入手机号', icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="1" width="14" height="18" rx="3"/>
        <line x1="8" y1="15" x2="12" y2="15"/>
      </svg>
    )},
    { key: 'password', label: '密码', type: 'password', placeholder: '请设置密码（至少8位，字母+数字）', icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="9" width="14" height="10" rx="2"/>
        <path d="M6 9V6a4 4 0 018 0v3"/>
      </svg>
    )},
  ];

  return (
    <div className="auth-page">
      <div className="auth-bg-circle auth-bg-circle-1" />
      <div className="auth-bg-circle auth-bg-circle-2" />
      <div className="auth-bg-circle auth-bg-circle-3" />

      <div className="auth-container" style={{ width: 400 }}>
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
              <rect width="28" height="28" rx="8" fill="currentColor"/>
              <path d="M8 10h12M8 14h8M8 18h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="auth-brand-name">创建账号</h1>
          <p className="auth-brand-desc">注册 v信，开始畅聊</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {fields.map(f => (
            <div key={f.key} className={`auth-field ${focusedField === f.key ? 'focused' : ''} ${form[f.key] ? 'has-value' : ''}`}>
              <label className="auth-field-label">{f.label}</label>
              <div className="auth-field-input-wrap">
                <span className="auth-field-icon">{f.icon}</span>
                <input
                  className="auth-field-input"
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm({...form, [f.key]: e.target.value})}
                  onFocus={() => setFocusedField(f.key)}
                  onBlur={() => setFocusedField(null)}
                  required
                />
              </div>
            </div>
          ))}

          {error && (
            <div className="auth-error">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 5h2v4H7V5zm0 5h2v2H7v-2z"/>
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={loading || !form.username || !form.phone || !form.password}>
            {loading ? <span className="auth-spinner" /> : '注册'}
          </button>
        </form>

        <p className="auth-footer">
          已有账号？<Link to="/login" className="auth-link">登录</Link>
        </p>
      </div>
    </div>
  );
}
