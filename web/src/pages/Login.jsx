import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const { login, accounts, removeAccount, maxAccounts } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', { phone, password });
      login(data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || '登录失败');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      {/* 装饰性背景圆 */}
      <div className="auth-bg-circle auth-bg-circle-1" />
      <div className="auth-bg-circle auth-bg-circle-2" />
      <div className="auth-bg-circle auth-bg-circle-3" />

      <div className="auth-container">
        {/* Logo区域 */}
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <svg viewBox="0 0 32 32" width="32" height="32" fill="none">
              <path d="M6 8C6 6.9 6.9 6 8 6h16c1.1 0 2 .9 2 2v3H6V8z" fill="rgba(255,255,255,.25)"/>
              <rect x="6" y="11" width="20" height="15" rx="1" fill="rgba(255,255,255,.12)"/>
              <path d="M10 16h12M10 20h8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="24" cy="22" r="5" fill="#07C160"/>
              <path d="M22 22l1.5 1.5L26 20" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="auth-brand-name">v信</h1>
          <p className="auth-brand-desc">企业级安全通讯平台</p>
        </div>

        {/* 最近登录：点击填入手机号，仍需手动输入密码 */}
        {accounts.length > 0 && (
          <div className="auth-accounts">
            <div className="auth-accounts-header">
              <span className="auth-accounts-title">最近登录</span>
              <span className="auth-accounts-count">{accounts.length}/{maxAccounts}</span>
            </div>
            {accounts.map(account => (
              <div key={account.id} className="auth-account-row">
                <button
                  type="button"
                  className="auth-account-btn"
                  onClick={() => setPhone(account.user?.phone || '')}
                  title="填入手机号"
                >
                  <div className="auth-account-avatar">
                    {(account.user?.username || '?')[0].toUpperCase()}
                  </div>
                  <div className="auth-account-info">
                    <span className="auth-account-name">{account.user?.username || '未命名'}</span>
                    <span className="auth-account-id">v信ID {account.user?.wechat_id || account.user?.phone}</span>
                  </div>
                </button>
                <button
                  type="button"
                  className="auth-account-remove"
                  onClick={() => removeAccount(account.id)}
                  title="移除记录"
                >✕</button>
              </div>
            ))}
          </div>
        )}

        {/* 登录表单 */}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className={`auth-field ${focusedField === 'phone' ? 'focused' : ''} ${phone ? 'has-value' : ''}`}>
            <label className="auth-field-label">手机号</label>
            <div className="auth-field-input-wrap">
              <svg className="auth-field-icon" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="1" width="14" height="18" rx="3"/>
                <line x1="8" y1="15" x2="12" y2="15"/>
              </svg>
              <input
                className="auth-field-input"
                type="tel"
                placeholder="请输入手机号"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
                required
              />
            </div>
          </div>

          <div className={`auth-field ${focusedField === 'password' ? 'focused' : ''} ${password ? 'has-value' : ''}`}>
            <label className="auth-field-label">密码</label>
            <div className="auth-field-input-wrap">
              <svg className="auth-field-icon" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="9" width="14" height="10" rx="2"/>
                <path d="M6 9V6a4 4 0 018 0v3"/>
              </svg>
              <input
                className="auth-field-input"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                required
              />
            </div>
          </div>

          {error && (
            <div className="auth-error">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 5h2v4H7V5zm0 5h2v2H7v-2z"/>
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={loading || !phone || !password}>
            {loading ? (
              <span className="auth-spinner" />
            ) : (
              '登录'
            )}
          </button>
        </form>

        <p className="auth-footer">
          还没有账号？<Link to="/register" className="auth-link">注册新账号</Link>
        </p>
      </div>
    </div>
  );
}
