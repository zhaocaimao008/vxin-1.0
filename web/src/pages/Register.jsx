import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ username: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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

  return (
    <div className="wc-auth">
      <div className="wc-auth-card">
        <div className="wc-auth-logo">
          <div className="wc-auth-logo-icon">v信</div>
        </div>
        <h2 className="wc-auth-title">注册账号</h2>
        <form onSubmit={handleSubmit}>
          <div className="wc-auth-field">
            <label>昵称</label>
            <input className="wc-auth-input" type="text" placeholder="请输入昵称" value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
          </div>
          <div className="wc-auth-field">
            <label>手机号</label>
            <input className="wc-auth-input" type="tel" placeholder="请输入手机号" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required />
          </div>
          <div className="wc-auth-field">
            <label>密码</label>
            <input className="wc-auth-input" type="password" placeholder="请设置密码（6位以上）" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          </div>
          {error && <p className="wc-auth-error">{error}</p>}
          <button type="submit" className="wc-auth-btn" disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </button>
        </form>
        <p className="wc-auth-link">已有账号？<Link to="/login">登录</Link></p>
      </div>
    </div>
  );
}
