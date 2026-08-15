import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import '../styles/login.css';

export default function Register() {
  // 从邀请链接 /register?invite=123456 预填邀请码（好友分享链接一点即注册）——
  // 惰性初始化，避免 effect 内 setState 造成的额外渲染
  const [form, setForm] = useState(() => {
    let inviteCode = '';
    try {
      const code = new URLSearchParams(window.location.search).get('invite');
      if (code && /^\d{6}$/.test(code)) inviteCode = code;
    } catch { /* SSR/无 window 时忽略 */ }
    return { phone: '', verifyCode: '', password: '', inviteCode };
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [showPwd, setShowPwd] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  // 是否需要邀请码由后台开关决定（GET /api/config）。默认 true，避免加载前误放行 UI。
  const [inviteRequired, setInviteRequired] = useState(false); // 参考图显示邀请码为"选填"
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/config')
      .then(r => setInviteRequired(r.data?.features?.inviteRequired !== false))
      .catch(() => {}); // 拉取失败保持默认（需要邀请码），后端仍会最终裁决
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = async () => {
    if (sendingCode || countdown > 0) return;
    if (!/^\d{11}$/.test(form.phone)) {
      setError('请输入正确的手机号');
      return;
    }

    setSendingCode(true);
    setError('');

    try {
      await axios.post('/api/auth/send-verify-code', { phone: form.phone });
      setCountdown(60);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || '发送验证码失败');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // 防连点/回车重复提交（避免重复注册）
    setError(''); setLoading(true);

    // 前端基础校验
    if (!/^\d{11}$/.test(form.phone)) {
      setError('请输入 11 位手机号'); setLoading(false); return;
    }
    if (!form.verifyCode || form.verifyCode.length !== 6) {
      setError('请输入6位验证码'); setLoading(false); return;
    }
    if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(form.password)) {
      setError('密码至少8位且需包含字母和数字'); setLoading(false); return;
    }
    if (inviteRequired && form.inviteCode && !/^\d{6}$/.test(form.inviteCode)) {
      setError('邀请码必须是6位数字'); setLoading(false); return;
    }
    if (!agreed) {
      setError('请先阅读并同意用户协议和隐私政策'); setLoading(false); return;
    }

    try {
      const { data } = await axios.post('/api/auth/register', {
        phone: form.phone,
        verifyCode: form.verifyCode,
        password: form.password,
        inviteCode: form.inviteCode || undefined
      });
      login(data.user, data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || '注册失败');
    } finally { setLoading(false); }
  };

  const fields = [
    { key: 'phone', label: '手机号', type: 'tel', inputMode: 'tel', autocomplete: 'username', placeholder: '请输入手机号', maxLength: 11, icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="1" width="14" height="18" rx="3"/>
        <line x1="8" y1="15" x2="12" y2="15"/>
      </svg>
    )},
    { key: 'verifyCode', label: '验证码', type: 'text', inputMode: 'numeric', autocomplete: 'one-time-code', placeholder: '请输入验证码', maxLength: 6, hasButton: true, icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M10 2a8 8 0 100 16 8 8 0 000-16z"/>
        <path d="M10 6v4l2 2"/>
      </svg>
    )},
    { key: 'password', label: '密码', type: 'password', autocomplete: 'new-password', placeholder: '请输入密码', icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="9" width="14" height="10" rx="2"/>
        <path d="M6 9V6a4 4 0 018 0v3"/>
      </svg>
    )},
    { key: 'inviteCode', label: '邀请码', type: 'text', inputMode: 'numeric', autocomplete: 'off', placeholder: '邀请码（选填）', maxLength: 6, optional: true, icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M10 11a4 4 0 100-8 4 4 0 000 8zM3 18c0-3.3 3.1-6 7-6s7 2.7 7 6"/>
      </svg>
    )},
  ];

  return (
    <div className="auth-page">
      <div className="auth-split">
        <div className="auth-split-left">
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
        <h1 className="auth-brand-name" style={{ fontSize: 22, textAlign: 'left', marginBottom: 4 }}>欢迎注册 v信</h1>
        <p className="auth-brand-desc" style={{ textAlign: 'left', marginBottom: 20 }}>安全连接每一刻，畅享沟通新体验</p>

        {/* 注册方式：当前仅「手机注册」有真实后端支持（/api/auth/register 仅按手机号注册）。
            参考图上的「v信注册」没有对应后端能力，未实现，避免伪造入口。 */}
        <div className="auth-tabs">
          <span className="auth-tab active">手机注册</span>
          <span className="auth-tab">v信注册</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {fields.map(f => (
            <div key={f.key} className={`auth-field ${focusedField === f.key ? 'focused' : ''} ${form[f.key] ? 'has-value' : ''}`}>
              <label className="auth-field-label" htmlFor={`reg-${f.key}`}>{f.label}</label>
              <div className="auth-field-input-wrap">
                <span className="auth-field-icon" aria-hidden="true">{f.icon}</span>
                <input
                  data-testid={f.key === 'inviteCode' ? 'register-invite-input' : `register-${f.key}-input`}
                  id={`reg-${f.key}`}
                  className="auth-field-input"
                  type={f.key === 'password' ? (showPwd ? 'text' : 'password') : f.type}
                  inputMode={f.inputMode}
                  autoComplete={f.autocomplete}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  maxLength={f.maxLength}
                  onChange={e => setForm({...form, [f.key]: e.target.value})}
                  onFocus={() => setFocusedField(f.key)}
                  onBlur={() => setFocusedField(null)}
                  required={!f.optional}
                />
                {f.key === 'phone' && <span className="auth-field-cc">+86</span>}
                {f.key === 'verifyCode' && (
                  <button
                    type="button"
                    className="auth-verify-code-btn"
                    onClick={handleSendCode}
                    disabled={sendingCode || countdown > 0 || !/^\d{11}$/.test(form.phone)}
                  >
                    {countdown > 0 ? `${countdown}秒后重试` : sendingCode ? '发送中...' : '获取验证码'}
                  </button>
                )}
                {f.key === 'password' && (
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
                )}
              </div>
            </div>
          ))}

          {error && (
            <div className="auth-error" role="alert">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 5h2v4H7V5zm0 5h2v2H7v-2z"/>
              </svg>
              {error}
            </div>
          )}

          <button type="submit" data-testid="register-submit-btn" className="auth-submit" disabled={loading || !form.phone || !form.verifyCode || !form.password || !agreed}>
            {loading ? <span className="auth-spinner" /> : '注册'}
          </button>

          {/* 用户协议：真实勾选状态，未勾选禁止提交；协议/隐私政策暂无落地页，链接点击不跳转 */}
          <div className="auth-agreement-row">
            <input
              type="checkbox"
              className="auth-agreement-box"
              data-testid="register-agreement-checkbox"
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
          已有账号？<Link to="/login" className="auth-link">立即登录</Link>
        </p>
      </div>
        </div>
      </div>
    </div>
  );
}
