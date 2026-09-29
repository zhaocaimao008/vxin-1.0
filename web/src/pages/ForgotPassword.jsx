import React, { useState } from 'react';
import { IcoLightbulb, IcoLock, IcoPhoneIphone, IcoTicket, IcoVisibility, IcoVisibilityOff } from '../components/Icons';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import '../styles/login.css';

export default function ForgotPassword() {
  const [form, setForm] = useState({ phone: '', inviteCode: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [showPwd, setShowPwd] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // 防连点/回车重复提交
    setError('');
    // 手机号格式校验（与后端 resetPassword 规则一致，后端为权威）
    if (!/^\+?[\d\s-]{5,20}$/.test(form.phone.trim())) {
      setError('手机号格式不正确');
      return;
    }
    if (!/^\d{6}$/.test(form.inviteCode)) {
      setError('邀请码必须是6位数字');
      return;
    }
    if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(form.newPassword)) {
      setError('密码必须至少8位，且至少包含1个字母和1个数字');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      await axios.post('/api/auth/reset-password', {
        phone: form.phone.trim(),
        inviteCode: form.inviteCode.trim(),
        newPassword: form.newPassword,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || '重置失败');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: 'phone', label: '手机号', type: 'tel', inputMode: 'tel', autocomplete: 'username', placeholder: '请输入注册时的手机号', icon: (
      <IcoPhoneIphone size={18} aria-hidden="true" />
    )},
    { key: 'inviteCode', label: '邀请码', type: 'text', inputMode: 'numeric', autocomplete: 'off', placeholder: '请输入6位邀请码', maxLength: 6, icon: (
      <IcoTicket size={18} aria-hidden="true" />
    )},
    { key: 'newPassword', label: '新密码', type: 'password', autocomplete: 'new-password', placeholder: '至少8位，含字母和数字', icon: (
      <IcoLock size={18} aria-hidden="true" />
    )},
    { key: 'confirmPassword', label: '确认新密码', type: 'password', autocomplete: 'new-password', placeholder: '再次输入新密码', icon: (
      <IcoLock size={18} aria-hidden="true" />
    )},
  ];

  if (success) {
    return (
      <div className="auth-page">
      <div className="auth-split">
        <div className="auth-split-left">
          <div className="auth-brand">
            <div className="auth-brand-logo">
              <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
                <rect x="0" y="0" width="100" height="100" rx="22" fill="#0A0A0A"/>
                <path d="M 31.5 29.3 L 50 64.9 L 68.6 29.3" fill="none" stroke="#FFD700" strokeWidth="12.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="50" cy="69" r="5.9" fill="#FFD700"/>
              </svg>
            </div>
            <h1 className="auth-brand-name auth-brand-name--brand">v信</h1>
            <p className="auth-brand-desc">连接 · 沟通 · 未来</p>
          </div>
        </div>
        <div className="auth-split-right">
        <div className="auth-container">
          <h1 className="auth-brand-name" style={{ fontSize: 22, textAlign: 'left', marginBottom: 4 }}>密码已重置</h1>
          <p className="auth-brand-desc" style={{ textAlign: 'left', marginBottom: 24 }}>请使用新密码登录</p>
          <button type="button" className="auth-submit" onClick={() => navigate('/login')}>
            返回登录
          </button>
        </div>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-split">
        <div className="auth-split-left">
          <div className="auth-brand">
            <div className="auth-brand-logo">
              <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
                <rect x="0" y="0" width="100" height="100" rx="22" fill="#0A0A0A"/>
                <path d="M 31.5 29.3 L 50 64.9 L 68.6 29.3" fill="none" stroke="#FFD700" strokeWidth="12.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="50" cy="69" r="5.9" fill="#FFD700"/>
              </svg>
            </div>
            <h1 className="auth-brand-name auth-brand-name--brand">v信</h1>
            <p className="auth-brand-desc">连接 · 沟通 · 未来</p>
          </div>
        </div>
        <div className="auth-split-right">
      <div className="auth-container">
        <h1 className="auth-brand-name" style={{ fontSize: 22, textAlign: 'left', marginBottom: 4 }}>忘记密码</h1>
        <p className="auth-brand-desc" style={{ textAlign: 'left', marginBottom: 20 }}>使用注册时的手机号和邀请码重置</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-note">
            <IcoLightbulb size={15} style={{ verticalAlign: '-3px' }} /> 需要邀请码？请向已有账号的用户询问，或联系管理员获取
          </div>

          {fields.map(f => (
            <div key={f.key} className={`auth-field ${focusedField === f.key ? 'focused' : ''} ${form[f.key] ? 'has-value' : ''}`}>
              <label className="auth-field-label" htmlFor={`fp-${f.key}`}>{f.label}</label>
              <div className="auth-field-input-wrap">
                <span className="auth-field-icon" aria-hidden="true">{f.icon}</span>
                <input
                  id={`fp-${f.key}`}
                  className="auth-field-input"
                  type={(f.key === 'newPassword' || f.key === 'confirmPassword') ? (showPwd ? 'text' : 'password') : f.type}
                  inputMode={f.inputMode}
                  autoComplete={f.autocomplete}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  maxLength={f.maxLength}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  onFocus={() => setFocusedField(f.key)}
                  onBlur={() => setFocusedField(null)}
                  required
                />
                {(f.key === 'newPassword' || f.key === 'confirmPassword') && (
                  <button type="button" className="auth-pwd-toggle" onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? '隐藏密码' : '显示密码'}>
                    {showPwd ? (
                      <IcoVisibilityOff size={18} aria-hidden="true" />
                    ) : (
                      <IcoVisibility size={18} aria-hidden="true" />
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

          <button
            type="submit"
            className="auth-submit"
            disabled={loading || !form.phone || !form.inviteCode || !form.newPassword || !form.confirmPassword}
          >
            {loading ? <span className="auth-spinner" /> : '重置密码'}
          </button>
        </form>

        <p className="auth-footer">
          想起密码了？<Link to="/login" className="auth-link">返回登录</Link>
        </p>
      </div>
        </div>
      </div>
    </div>
  );
}
