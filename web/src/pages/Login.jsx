import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useI18n, SUPPORTED_LANGS } from '../contexts/I18nContext';
import { timeoutSignal } from '../utils/config';
import { saveCred, loadCred, removeCred, lastRememberedPhone } from '../utils/rememberedCreds';
import '../styles/login.css';

const isElectron = !!window.__ELECTRON_CONFIG__;

export default function Login() {
  // 「记住账户和密码」：登录页首帧即回填上次勾选记住的手机号 + 密码，免手输。
  // 凭证仅在本地做可逆混淆存储，默认不勾选，详见 utils/rememberedCreds.js 安全边界。
  const initialPhone = lastRememberedPhone();
  const initialPwd = initialPhone ? loadCred(initialPhone) : '';
  const [phone, setPhone] = useState(initialPhone);
  const [password, setPassword] = useState(initialPwd);
  const [remember, setRemember] = useState(!!initialPwd);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [showPwd, setShowPwd] = useState(false);
  // 《用户协议》《隐私政策》暂无落地页，链接点击不跳转（与 Register 现状一致）；
  // 勾选框本身是真实交互状态，未勾选禁止提交。
  const [agreed, setAgreed] = useState(false);
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
  // 地址来自 localStorage（手动切换）或远程配置（CONFIG_URLS：jsDelivr + dipsin.com）
  // 不再硬编码任何域名（config/api/ws/cdn 子域名均未启用，统一走 dipsin.com）
  const currentServer = localStorage.getItem('vxin_server_url') || axios.defaults.baseURL || '';
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
    localStorage.setItem('vxin_server_url', url);
    axios.defaults.baseURL = url;
    window.location.reload();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // 防连点/回车重复提交
    setError(''); setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', { phone, password });
      // 登录成功后按勾选保存/清除本地记住的密码（凭证按手机号归档，可逆混淆存储）
      if (remember) saveCred(phone, password);
      else removeCred(phone);
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
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M12.5 4C6.7 4 2 7.9 2 12.7c0 2.7 1.5 5.1 3.9 6.7-.2.9-.7 2.4-.8 2.8-.1.3.1.4.3.3.5-.2 2.4-1.3 3.3-1.9.9.2 1.8.4 2.8.4 5.8 0 10.5-3.9 10.5-8.7C22 7.9 17.3 4 11.5 4h1z" fill="#3AC756"/>
            <circle cx="8.6" cy="11.4" r="1.15" fill="#fff"/>
            <circle cx="14.4" cy="11.4" r="1.15" fill="#fff"/>
            <path d="M20.7 11.3c-4.8 0-8.7 3.3-8.7 7.3 0 1.9 1 3.6 2.5 4.9l-.6 2.1c-.1.3.1.4.3.3l2.5-1.4c1.2.4 2 .5 2.7.5.4 0 .8 0 1.2-.1 4.4-.5 7.7-3.7 7.7-7.4.1-4-3.8-6.2-7.6-6.2z" fill="#3AC756" opacity=".92"/>
            <circle cx="18.1" cy="18.3" r="1" fill="#fff"/>
            <circle cx="22.7" cy="18.3" r="1" fill="#fff"/>
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
                <circle cx="35" cy="40" r="28" fill="#07C160"/>
                <circle cx="35" cy="40" r="28" fill="#07C160" opacity="0.9"/>
                <ellipse cx="28" cy="35" rx="4" ry="5" fill="white"/>
                <ellipse cx="42" cy="35" rx="4" ry="5" fill="white"/>
                <circle cx="65" cy="55" r="22" fill="#07C160"/>
                <ellipse cx="59" cy="50" rx="3" ry="4" fill="white"/>
                <ellipse cx="71" cy="50" rx="3" ry="4" fill="white"/>
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
        {/* 登录方式：当前仅「手机登录」有真实后端支持（/api/auth/login 仅按手机号查询）。
            参考图上的「v信登录」（按 v信号登录）没有对应后端能力 —— 为对齐参考图布局保留第二个
            Tab 的视觉位置，但设为禁用态、不可点击、不触发任何逻辑，避免伪造未实现的功能。 */}
        <div className="auth-tabs">
          <span className="auth-tab active">手机登录</span>
          <span className="auth-tab disabled" aria-disabled="true" title="暂未开放">v信登录</span>
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

          <button type="submit" className="auth-submit" data-testid="login-submit-btn" disabled={loading || !phone || !password || !agreed}>
            {loading ? (
              <span className="auth-spinner" />
            ) : (
              '登录'
            )}
          </button>

          {/* 用户协议：真实勾选状态，未勾选禁止提交；协议/隐私政策暂无落地页，链接点击不跳转 */}
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
        </form>

        <p className="auth-footer">
          还没有账号？<Link to="/register" className="auth-link">立即注册</Link>
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
