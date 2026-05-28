import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', { phone, password });
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || '登录失败');
    } finally { setLoading(false); }
  };

  return (
    <div className="wc-auth">
      <div className="wc-auth-card">
        <div className="wc-auth-logo">
          <div className="wc-auth-logo-icon">v信</div>
        </div>
        <h2 className="wc-auth-title">登录</h2>
        <form onSubmit={handleSubmit}>
          <div className="wc-auth-field">
            <label>手机号</label>
            <input className="wc-auth-input" type="tel" placeholder="请输入手机号" value={phone} onChange={e => setPhone(e.target.value)} required />
          </div>
          <div className="wc-auth-field">
            <label>密码</label>
            <input className="wc-auth-input" type="password" placeholder="请输入密码" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <p className="wc-auth-error">{error}</p>}
          <button type="submit" className="wc-auth-btn" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        <p className="wc-auth-link">还没有账号？<Link to="/register">注册</Link></p>
      </div>
    </div>
  );
}
