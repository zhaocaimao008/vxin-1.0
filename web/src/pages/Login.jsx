import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useI18n, SUPPORTED_LANGS } from '../contexts/I18nContext';
import { timeoutSignal } from '../utils/config';
import { saveCred, loadCred, removeCred, lastRememberedPhone } from '../utils/rememberedCreds';
import { isDeprecatedServerUrl } from '../utils/url';
import '../styles/login.css';

const isElectron = !!window.__ELECTRON_CONFIG__;

export default function Login() {
  // 「记住账户和密码」：登录页首帧即回填上次勾选记住的手机号 + 密码，免手输。
  // 凭证仅在本地做可逆混淆存储，默认不勾选，详见 utils/rememberedCreds.js 安全边界。
  const initialPhone = lastRememberedPhone();
  const initialPwd = initialPhone ? loadCred(initialPhone) : '';
  const [loginMode, setLoginMode] = useState('phone'); // 'phone' or 'vxin'
  const [phone, setPhone] = useState(initialPhone);
  const [vxinId, setVxinId] = useState('');
  const [password, setPassword] = useState(initialPwd);
  const [remember, setRemember] = useState(!!initialPwd);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [showPwd, setShowPwd] = useState(false);
  // 《用户协议》《隐私政策》暂无落地页，链接点击不跳转（与 Register 现状一致）；
  // 勾选框本身是真实交互状态，未勾选禁止提交。
  const [agreed, setAgreed] = useState(false);
  const identifierOk = loginMode === 'phone' ? phone : vxinId;
  const { login, accounts, removeAccount, maxAccounts } = useAuth();
  const { lang, setLang } = useI18n();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const navigate = useNavigate();

  // 点击「最近登录」某账户：回填手机号，并在存有记住密码时一并回填密码 + 勾选记住。
  const fillAccount = (acct) => {
    const p = acct?.user?.phone || '';
    setPhone(p);
    const saved = loadCred(p);
    if (saved) { setPassword(saved); setRemember(true); }
    else { setPassword(''); setRemember(false); }
  };

  // ── 服务器切换（仅桌面端，登录前即可切换，无需重装） ──
  // 地址来自 localStorage（手动切换）或远程配置（CONFIG_URLS：jsDelivr + vxinchat.com）
  // 不再硬编码任何域名（统一走远程配置解析出的后端）
  // 自动清除已废弃的官方旧服务器地址（45.77.131.33 / 104.244.95.70），默认显示正式域名
  const storedServer = localStorage.getItem('vxin_server_url');
  const currentServer = (storedServer && !isDeprecatedServerUrl(storedServer))
    ? storedServer
    : (axios.defaults.baseURL || 'https://vxinchat.com');
  const [showServer, setShowServer] = useState(false);
  const [serverInput, setServerInput] = useState(currentServer);
  const [serverTest, setServerTest] = useState(null);
  const [serverBusy, setServerBusy] = useState(false);

  const testServer = async () => {
    const url = serverInput.trim().replace(/\/$/, '');
    if (!url.startsWith('http')) { setServerTest({ ok: false, msg: '请以 http:// 或 https:// 开头' }); return; }
    setServerBusy(true); setServerTest(null);
    try {
      await fetch(`${url}/health`, { signal: timeoutSignal(6000) });
      setServerTest({ ok: true, msg: '连接成功 ✓' });
    } catch {
      setServerTest({ ok: false, msg: '无法连接到该服务器，请检查地址' });
    } finally { setServerBusy(false); }
  };

  const saveServer = () => {
    const url = serverInput.trim().replace(/\/$/, '');
    if (!url.startsWith('http')) { setServerTest({ ok: false, msg: '请以 http:// 或 https:// 开头' }); return; }
    if (isDeprecatedServerUrl(url)) { setServerTest({ ok: false, msg: '该地址已废弃，请使用正式服务器 https://vxinchat.com' }); return; }
    localStorage.setItem('vxin_server_url', url);
    window.electronAPI?.setServerUrl?.(url);
    axios.defaults.baseURL = url;
    window.location.reload();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // 防连点/回车重复提交
    setError(''); setLoading(true);
    try {
      const payload = loginMode === 'phone'
        ? { phone, password }
        : { loginType: 'vxin', identifier: vxinId, password };
      const { data } = await axios.post('/api/auth/login', payload);
      // 登录成功后按勾选保存/清除本地记住的密码（凭证按手机号归档，可逆混淆存储）
      if (loginMode === 'phone') {
        if (remember) saveCred(phone, password);
        else removeCred(phone);
      }
      login(data.user, data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || '登录失败');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      {/* 顶部品牌角标（纯视觉，与右上角语言切换同排） */}
      <div className="auth-top-logo">
        <span className="auth-top-logo-icon" aria-hidden="true">
          <svg viewBox="0 0 100 100" fill="none">
            <rect x="0" y="0" width="100" height="100" rx="22" fill="#07C160"/>
            <rect x="47.8" y="48.4" width="27.6" height="21.6" rx="7.56" fill="#07C160"/>
            <polygon points="72.09,68.7 67.15,67.92 72.61,74.16" fill="#07C160"/>
            <circle cx="72.61" cy="74.16" r="0.83" fill="#07C160"/>
            <rect x="24" y="30.4" width="40" height="30.4" rx="9.12" fill="#fff"/>
            <polygon points="28.8,59 35.64,57.92 28.08,66.56" fill="#fff"/>
            <circle cx="28.08" cy="66.56" r="1.15" fill="#fff"/>
            <rect x="49.6" y="50.2" width="24" height="18" rx="5.76" fill="#fff"/>
            <polygon points="70.72,67 66.16,66.28 71.2,72.04" fill="#fff"/>
            <circle cx="71.2" cy="72.04" r="0.77" fill="#fff"/>
          </svg>
        </span>
        <span className="auth-top-logo-text">v信</span>
      </div>
      {/* 语言切换：真实 i18n（useI18n），不是装饰 */}
      <div className="auth-lang-switch">
        <button type="button" className="auth-lang-btn" onClick={() => setShowLangMenu(v => !v)}>
          {SUPPORTED_LANGS.find(l => l.code === lang)?.name || '简体中文'}
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
        </button>
        {showLangMenu && (
          <div className="auth-lang-menu" role="menu">
            {SUPPORTED_LANGS.map(l => (
              <button key={l.code} type="button" role="menuitem"
                className={`auth-lang-item${l.code === lang ? ' active' : ''}`}
                onClick={() => { setLang(l.code); setShowLangMenu(false); }}>
                {l.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="auth-split">
        <div className="auth-split-left">
          <div className="auth-split-left-dots" aria-hidden="true" />
          <div className="auth-brand">
            <div className="auth-brand-logo">
              <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
                <rect x="0" y="0" width="100" height="100" rx="22" fill="#07C160"/>
                <rect x="47.8" y="48.4" width="27.6" height="21.6" rx="7.56" fill="#07C160"/>
                <polygon points="72.09,68.7 67.15,67.92 72.61,74.16" fill="#07C160"/>
                <circle cx="72.61" cy="74.16" r="0.83" fill="#07C160"/>
                <rect x="24" y="30.4" width="40" height="30.4" rx="9.12" fill="#fff"/>
                <polygon points="28.8,59 35.64,57.92 28.08,66.56" fill="#fff"/>
                <circle cx="28.08" cy="66.56" r="1.15" fill="#fff"/>
                <rect x="49.6" y="50.2" width="24" height="18" rx="5.76" fill="#fff"/>
                <polygon points="70.72,67 66.16,66.28 71.2,72.04" fill="#fff"/>
                <circle cx="71.2" cy="72.04" r="0.77" fill="#fff"/>
              </svg>
            </div>
            <h1 className="auth-brand-name auth-brand-name--brand">v信</h1>
            <p className="auth-brand-desc">连接世界 · 沟通无限</p>
          </div>
        </div>
        <div className="auth-split-right">
      <div className="auth-container">
        <h1 className="auth-brand-name" style={{ fontSize: 24, textAlign: 'center', marginBottom: 6 }}>欢迎登录 <span style={{ color: 'var(--color-primary, #07C160)' }}>v信</span></h1>
        <p className="auth-brand-desc" style={{ textAlign: 'center', marginBottom: 24 }}>安全连接每一刻，畅享沟通新体验</p>

        {/* 登录方式切换：手机登录 | v信登录 */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${loginMode === 'phone' ? 'active' : ''}`}
            onClick={() => setLoginMode('phone')}
          >
            手机登录
          </button>
          <button
            type="button"
            className={`auth-tab ${loginMode === 'vxin' ? 'active' : ''}`}
            onClick={() => setLoginMode('vxin')}
          >
            v信登录
          </button>
        </div>

        {/* 最近登录：点击回填手机号；若曾记住密码则一并回填密码并自动勾选「记住密码」 */}
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
                  onClick={() => fillAccount(account)}
                  title={loadCred(account.user?.phone || '') ? '填入账户与密码' : '填入手机号'}
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
                  onClick={() => { removeCred(account.user?.phone || ''); removeAccount(account.id); }}
                  title="移除记录"
                  aria-label="移除记录"
                >✕</button>
              </div>
            ))}
          </div>
        )}

        {/* 登录表单 */}
        <form className="auth-form" onSubmit={handleSubmit}>
          {loginMode === 'phone' ? (
            <div className={`auth-field ${focusedField === 'phone' ? 'focused' : ''} ${phone ? 'has-value' : ''}`}>
              <label className="auth-field-label" htmlFor="login-phone">手机号</label>
              <div className="auth-field-input-wrap">
                <svg className="auth-field-icon" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <rect x="3" y="1" width="14" height="18" rx="3"/>
                  <line x1="8" y1="15" x2="12" y2="15"/>
                </svg>
                <input
                  id="login-phone"
                  data-testid="login-phone-input"
                  className="auth-field-input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="username"
                  placeholder="请输入手机号"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                  required
                />
                <span className="auth-field-cc">
                  +86
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>
                </span>
              </div>
            </div>
          ) : (
            <div className={`auth-field ${focusedField === 'vxin' ? 'focused' : ''} ${vxinId ? 'has-value' : ''}`}>
              <label className="auth-field-label" htmlFor="login-vxin">v信号</label>
              <div className="auth-field-input-wrap">
                <svg className="auth-field-icon" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <circle cx="10" cy="10" r="8"/>
                  <path d="M10 6v4l3 2"/>
                </svg>
                <input
                  id="login-vxin"
                  data-testid="login-vxin-input"
                  className="auth-field-input"
                  type="text"
                  autoComplete="username"
                  placeholder="请输入v信号"
                  value={vxinId}
                  onChange={e => setVxinId(e.target.value)}
                  onFocus={() => setFocusedField('vxin')}
                  onBlur={() => setFocusedField(null)}
                  required
                />
              </div>
            </div>
          )}

          <div className={`auth-field ${focusedField === 'password' ? 'focused' : ''} ${password ? 'has-value' : ''}`}>
            <label className="auth-field-label" htmlFor="login-password">密码</label>
            <div className="auth-field-input-wrap">
              <svg className="auth-field-icon" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <rect x="3" y="9" width="14" height="10" rx="2"/>
                <path d="M6 9V6a4 4 0 018 0v3"/>
              </svg>
              <input
                id="login-password"
                data-testid="login-password-input"
                className="auth-field-input"
                type={showPwd ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="请输入密码"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                required
              />
              <button type="button" className="auth-pwd-toggle" onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? '隐藏密码' : '显示密码'}>
                {showPwd ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="auth-error" role="alert" data-testid="auth-error-text">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 5h2v4H7V5zm0 5h2v2H7v-2z"/>
              </svg>
              {error}
            </div>
          )}

          <div className="auth-remember-row">
            <label className="auth-remember">
              <input
                type="checkbox"
                className="auth-remember-box"
                data-testid="login-remember-checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
              />
              记住密码
            </label>
            <Link to="/forgot-password" className="auth-link" style={{ fontSize: 'var(--text-sm2)' }}>忘记密码？</Link>
          </div>

          <button type="submit" className="auth-submit" data-testid="login-submit-btn" disabled={loading || !identifierOk || !password || !agreed}>
            {loading ? (
              <span className="auth-spinner" />
            ) : (
              '登录'
            )}
          </button>
        </form>

        <p className="auth-footer">
          还没有账号？<Link to="/register" className="auth-link">立即注册</Link>
        </p>

        {/* 用户协议：真实勾选状态，未勾选禁止提交；协议/隐私政策暂无落地页，链接点击不跳转
            位置对齐参考图（图标参考同目录 Web登录页面-ref.png）：协议行在"立即注册"下方 */}
        <div className="auth-agreement-row">
          <input
            type="checkbox"
            className="auth-agreement-box"
            data-testid="login-agreement-checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
          />
          <p className="auth-agreement">
            我已阅读并同意 <a href="#" onClick={e => e.preventDefault()}>《用户协议》</a> 和{' '}
            <a href="#" onClick={e => e.preventDefault()}>《隐私政策》</a>
          </p>
        </div>

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
                  aria-label="服务器地址"
                  value={serverInput}
                  onChange={e => { setServerInput(e.target.value); setServerTest(null); }}
                  placeholder="https://example.com"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                {serverTest && (
                  <div className="auth-server-result" role="alert" style={{ color: serverTest.ok ? 'var(--green)' : 'var(--color-danger)' }}>
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
      </div>
      {!isElectron && (
        <div className="auth-page-footer">
          © {new Date().getFullYear()} v信. 保留所有权利。{' '}
          <a href="#" onClick={e => e.preventDefault()}>用户协议</a>{' | '}
          <a href="#" onClick={e => e.preventDefault()}>隐私政策</a>{' | '}
          <a href="#" onClick={e => e.preventDefault()}>帮助中心</a>
        </div>
      )}
    </div>
  );
}
