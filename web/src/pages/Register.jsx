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
    return { phone: '', vxinId: '', password: '', inviteCode };
  });
  const [registerMode, setRegisterMode] = useState('phone'); // 'phone' | 'vxin'
  const [vxinRegister, setVxinRegister] = useState(false); // 后端开关（GET /api/config features.vxinRegister）
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [showPwd, setShowPwd] = useState(false);
  const [agreed, setAgreed] = useState(false);
  // 是否需要邀请码由后台开关决定（GET /api/config）。默认 true，避免加载前误放行 UI。
  const [inviteRequired, setInviteRequired] = useState(true); // 默认开启：拉取失败/未返回时保守显示邀请码，避免无码注册被误放行
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/config')
      .then(r => {
        setInviteRequired(r.data?.features?.inviteRequired !== false);
        setVxinRegister(r.data?.features?.vxinRegister !== false);
      })
      .catch(() => {}); // 拉取失败保持默认（需要邀请码），后端仍会最终裁决
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // 防连点/回车重复提交（避免重复注册）
    setError(''); setLoading(true);

    // 前端基础校验（按注册方式：手机号注册 / v信号注册）
    if (registerMode === 'phone') {
      if (!/^\d{11}$/.test(form.phone)) {
        setError('请输入 11 位手机号'); setLoading(false); return;
      }
    } else {
      if (!/^\d{6}$/.test(form.vxinId)) {
        setError('请输入 6 位数字 v信号'); setLoading(false); return;
      }
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
      const payload = registerMode === 'phone'
        ? { phone: form.phone, password: form.password, inviteCode: form.inviteCode || undefined }
        : { loginType: 'vxin', identifier: form.vxinId, password: form.password, inviteCode: form.inviteCode || undefined };
      const { data } = await axios.post('/api/auth/register', payload);
      login(data.user, data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || '注册失败');
    } finally { setLoading(false); }
  };

  const accountField = registerMode === 'phone'
    ? { key: 'phone', label: '手机号', type: 'tel', inputMode: 'tel', autocomplete: 'username', placeholder: '请输入手机号', maxLength: 11, icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="1" width="14" height="18" rx="3"/>
        <line x1="8" y1="15" x2="12" y2="15"/>
      </svg>
    )}
    : { key: 'vxinId', label: 'v信号', type: 'text', inputMode: 'numeric', autocomplete: 'username', placeholder: '请输入6位数字v信号', maxLength: 6, icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="1" width="14" height="18" rx="3"/>
        <line x1="8" y1="15" x2="12" y2="15"/>
      </svg>
    )};
  const fields = [
    accountField,
    { key: 'password', label: '密码', type: 'password', autocomplete: 'new-password', placeholder: '请输入密码', icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="9" width="14" height="10" rx="2"/>
        <path d="M6 9V6a4 4 0 018 0v3"/>
      </svg>
    )},
    // 后台关闭「注册需邀请码」后隐藏邀请码输入框（四端一致）；重新开启后恢复
    ...(inviteRequired ? [{ key: 'inviteCode', label: '邀请码', type: 'text', inputMode: 'numeric', autocomplete: 'off', placeholder: '请输入邀请码', maxLength: 6, optional: false, icon: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M10 11a4 4 0 100-8 4 4 0 000 8zM3 18c0-3.3 3.1-6 7-6s7 2.7 7 6"/>
      </svg>
    ) }] : []),
  ];

  // 切换注册方式时清空错误
  const switchMode = (mode) => {
    if (mode === registerMode) return;
    setRegisterMode(mode);
    setError('');
  };

  return (
    <div className="auth-page">
      <div className="auth-split">
        <div className="auth-split-left">
          <div className="auth-brand">
            <div className="auth-brand-logo">
              <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
                <rect x="0" y="0" width="100" height="100" rx="22" fill="#000000"/>
                <polygon points="14,80 28,80 12,96" fill="#000000"/>
                <circle cx="12" cy="96" r="2" fill="#000000"/>
                <circle cx="50" cy="46" r="30" fill="none" stroke="#FFD700" strokeWidth="2.5" opacity="0.85"/>
                <polygon points="38.28,32.23 46.09,51.77 53.91,51.77 61.72,32.23 55.86,32.23 50,43.95 44.14,32.23" fill="#FFD700"/>
              </svg>
            </div>
            <h1 className="auth-brand-name auth-brand-name--brand">v信</h1>
            <p className="auth-brand-desc">连接 · 沟通 · 未来</p>
          </div>
        </div>
        <div className="auth-split-right">
      <div className="auth-container">
        <h1 className="auth-brand-name" style={{ fontSize: 22, textAlign: 'left', marginBottom: 4 }}>欢迎注册 v信</h1>
        <p className="auth-brand-desc" style={{ textAlign: 'left', marginBottom: 20 }}>安全连接每一刻，畅享沟通新体验</p>

        {/* 注册方式切换：手机注册 | v信号注册（v信号注册由后端开关 feature_vxin_register 控制，关闭时不显示） */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${registerMode === 'phone' ? 'active' : ''}`}
            onClick={() => switchMode('phone')}
          >
            手机注册
          </button>
          {vxinRegister && (
            <button
              type="button"
              className={`auth-tab ${registerMode === 'vxin' ? 'active' : ''}`}
              onClick={() => switchMode('vxin')}
            >
              v信号注册
            </button>
          )}
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

          <button type="submit" data-testid="register-submit-btn" className="auth-submit" disabled={loading || (registerMode === 'phone' ? !form.phone : !form.vxinId) || !form.password || !agreed}>
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
