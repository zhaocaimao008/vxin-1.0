import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const isElectron = !!window.__ELECTRON_CONFIG__;

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const { login, accounts, removeAccount, maxAccounts } = useAuth();
  const navigate = useNavigate();

  // ── 服务器切换（仅桌面端，登录前即可切换，无需重装） ──
  const currentServer = isElectron
    ? (localStorage.getItem('vxin_server_url') || window.__ELECTRON_CONFIG__.serverUrl)
    : '';
  const [showServer, setShowServer] = useState(false);
  const [serverInput, setServerInput] = useState(currentServer);
  const [serverTest, setServerTest] = useState(null);
  const [serverBusy, setServerBusy] = useState(false);

  const testServer = async () => {
    const url = serverInput.trim().replace(/\/$/, '');
    if (!url.startsWith('http')) { setServerTest({ ok: false, msg: '请以 http:// 或 https:// 开头' }); return; }
    setServerBusy(true); setServerTest(null);
    try {
      // 只要服务器有 HTTP 响应就算可达（health 返回 200）
      await fetch(`${url}/health`, { signal: AbortSignal.timeout(6000) });
      setServerTest({ ok: true, msg: '连接成功 ✓' });
    } catch {
      setServerTest({ ok: false, msg: '无法连接到该服务器，请检查地址' });
    } finally { setServerBusy(false); }
  };

  const saveServer = () => {
    const url = serverInput.trim().replace(/\/$/, '');
    if (!url.startsWith('http')) { setServerTest({ ok: false, msg: '请以 http:// 或 https:// 开头' }); return; }
    localStorage.setItem('vxin_server_url', url);
    window.electron?.setServerUrl?.(url);
    // 重载页面，main.jsx 会读取新地址重设 axios baseURL 和 socket
    window.location.reload();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', { phone, password });
      login(data.user, data.token);
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
            <svg viewBox="0 0 40 40" width="38" height="38" fill="none">
              <path d="M5 7a3 3 0 013-3h16a3 3 0 013 3v12a3 3 0 01-3 3H14l-5 5V7z" fill="rgba(255,255,255,.3)"/>
              <path d="M17 15a3 3 0 013-3h11a3 3 0 013 3v10a3 3 0 01-3 3h-3v4l-5-4h-3a3 3 0 01-3-3V15z" fill="white"/>
            </svg>
          </div>
          <h1 className="auth-brand-name">v信</h1>
          <p className="auth-brand-desc">安全 · 私密 · 畅聊</p>
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
            <label className="auth-field-label" htmlFor="login-phone">手机号</label>
            <div className="auth-field-input-wrap">
              <svg className="auth-field-icon" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <rect x="3" y="1" width="14" height="18" rx="3"/>
                <line x1="8" y1="15" x2="12" y2="15"/>
              </svg>
              <input
                id="login-phone"
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
            <label className="auth-field-label" htmlFor="login-password">密码</label>
            <div className="auth-field-input-wrap">
              <svg className="auth-field-icon" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <rect x="3" y="9" width="14" height="10" rx="2"/>
                <path d="M6 9V6a4 4 0 018 0v3"/>
              </svg>
              <input
                id="login-password"
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

        {/* 服务器切换 — 仅桌面端 */}
        {isElectron && (
          <div className="auth-server">
            {!showServer ? (
              <button type="button" className="auth-server-toggle" onClick={() => setShowServer(true)}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style={{ marginRight: 5, verticalAlign: '-2px' }}>
                  <path d="M4 1h16a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1zm0 8h16a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4a1 1 0 011-1zm2-5a1 1 0 100 2 1 1 0 000-2zm0 8a1 1 0 100 2 1 1 0 000-2z"/>
                </svg>
                当前服务器：{currentServer.replace(/^https?:\/\//, '')} · 切换
              </button>
            ) : (
              <div className="auth-server-panel">
                <div className="auth-server-title">服务器地址（IP 或域名）</div>
                <input
                  className="auth-server-input"
                  value={serverInput}
                  onChange={e => { setServerInput(e.target.value); setServerTest(null); }}
                  placeholder="https://example.com"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                {serverTest && (
                  <div className="auth-server-result" style={{ color: serverTest.ok ? '#07C160' : '#FF7575' }}>
                    {serverTest.msg}
                  </div>
                )}
                <div className="auth-server-btns">
                  <button type="button" onClick={testServer} disabled={serverBusy} className="auth-server-btn ghost">
                    {serverBusy ? '检测中…' : '测试连接'}
                  </button>
                  <button type="button" onClick={saveServer} className="auth-server-btn primary">保存并切换</button>
                </div>
                <button type="button" className="auth-server-cancel" onClick={() => { setShowServer(false); setServerInput(currentServer); setServerTest(null); }}>取消</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
