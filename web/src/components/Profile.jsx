import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n, SUPPORTED_LANGS } from '../contexts/I18nContext';
import { goLogin } from '../utils/url';
import { showConfirm, showToast } from '../utils/toast';
import { copyToClipboard } from '../utils/clipboard';
import { timeoutSignal } from '../utils/config';
import { IcoDesktop as IcoDeviceDesktop, IcoMobile as IcoDeviceMobile, IcoClose } from './Icons';

/* ─── 小工具 ─── */
// role="button" 的 div 应同时支持 Enter 和空格触发（空格默认会滚动页面，需 preventDefault）
const activateOnKey = (fn) => (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); }
};

const ChevronRight = () => (
  <svg className="wc-chevron" viewBox="0 0 24 24">
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
  </svg>
);

function Toggle({ checked, onChange, disabled }) {
  return (
    <button type="button" className={`wc-switch${checked ? ' on' : ''}`}
      onClick={e => { e.stopPropagation(); if (!disabled) onChange?.(!checked); }}
      disabled={disabled}
      aria-pressed={checked}>
      <span />
    </button>
  );
}

/* ─── SVG icons ─── */
const Ico = ({ d }) => <svg className="wc-ico" viewBox="0 0 24 24"><path d={d}/></svg>;
const IcoDesktop = () => <Ico d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zm-8-1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm8-3H4V6h16v8z"/>;
const IcoMoon    = () => <Ico d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>;
const IcoBell    = () => <Ico d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>;
const IcoShield  = () => <Ico d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>;
const IcoServer  = () => <Ico d="M4 1h16a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1zm0 8h16a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4a1 1 0 011-1zm0 8h16a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4a1 1 0 011-1zM6 4a1 1 0 100 2 1 1 0 000-2zm0 8a1 1 0 100 2 1 1 0 000-2zm0 8a1 1 0 100 2 1 1 0 000-2z"/>;
const IcoKeyboard = () => <Ico d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 5H5v-2h2v2zm0-3H5v-2h2v2zm0-3H5V8h2v2zm10 6H7v-2h10v2zm0-3h-2v-2h2v2zm0-3h-2V8h2v2zm3 6h-2v-2h2v2zm0-3h-2v-2h2v2zm0-3h-2V8h2v2z"/>;
// 设置页「账号信息」分组新增图标（chat-window/settings-page 改版沿用同一套 Ico 包装）
const IcoPhoneRow = () => <Ico d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>;
const IcoKeyRow   = () => <Ico d="M12.65 10A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>;
const IcoLockRow  = () => <Ico d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm3 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>;
const IcoGlobeRow = () => <Ico d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56A8.03 8.03 0 0 1 18.93 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.81 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.987 7.987 0 0 1 5.07 16zm2.95-8H5.07a7.987 7.987 0 0 1 4.33-3.56C8.8 5.55 8.34 6.75 8.02 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z"/>;
const IcoTrashRow = () => <Ico d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>;
/* ─── 通用 UI 零件 ─── */
function PageBg({ children }) {
  return <div className="wc-page-bg">{children}</div>;
}

function PageHeader({ title, onBack, right }) {
  return (
    <div className="wc-page-header">
      {/* 内嵌进两栏设置面板时不传 onBack：没有"返回"这个概念（换点别的导航项即可），隐藏按钮 */}
      {onBack && <button className="wc-page-header-back" onClick={onBack}>‹ 返回</button>}
      <span className="wc-page-header-title">{title}</span>
      <div className="wc-page-header-right">{right}</div>
    </div>
  );
}

function SLabel({ children }) {
  return <div className="wc-slabel">{children}</div>;
}

function Card({ children, style, className }) {
  return <div className={`wc-card${className ? ' ' + className : ''}`} style={style}>{children}</div>;
}

function CRow({ icon, bg, label, value, desc, onClick, right, danger }) {
  return (
    <div className={`wc-crow${onClick ? ' wc-crow-clickable' : ''}`}
      onClick={onClick}
      role="button" tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? activateOnKey(onClick) : undefined}>
      {icon && (
        <div className="wc-crow-icon" style={{ background: bg }}>
          {icon}
        </div>
      )}
      <div className="wc-crow-body">
        <div className={danger ? 'wc-crow-label wc-crow-label-danger' : 'wc-crow-label'}>{label}</div>
        {desc && <div className="wc-crow-desc">{desc}</div>}
      </div>
      {value != null && <span className={`wc-crow-value${onClick ? ' wc-crow-value-gap' : ''}`}>{value}</span>}
      {right}
      {onClick && !right && <ChevronRight />}
    </div>
  );
}

/* ── 修改昵称 ── */
function EditName({ user, updateUser, onBack }) {
  const [username, setUsername] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const MAX = 20;

  const save = async () => {
    if (saving) return; // 防连点：回车提交会绕过 disabled 按钮
    const trimmed = username.trim();
    if (!trimmed) { setError('昵称不能为空'); return; }
    if (trimmed.length > MAX) { setError(`昵称最多 ${MAX} 个字符`); return; }
    setSaving(true);
    setError('');
    try {
      const { data } = await axios.put('/api/users/profile', { username: trimmed });
      updateUser(data);
      onBack();
    } catch (err) {
      setError(err.response?.data?.error || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageBg>
      <PageHeader title="修改昵称" onBack={onBack}
        right={
          <button className="wc-save-btn" onClick={save} disabled={saving}>
            {saving ? '保存中' : '保存'}
          </button>
        }
      />
      <div className="wc-edit-pad">
        <Card>
          <div className="wc-edit-wrap">
            <input
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && save()}
              maxLength={MAX}
              autoFocus
              placeholder="请输入昵称"
              aria-label="修改昵称"
              className="wc-edit-input"
            />
            <span className="wc-edit-counter">{username.length}/{MAX}</span>
          </div>
        </Card>
        {error && <div className="wc-edit-error" role="alert">{error}</div>}
        <div className="wc-edit-hint">昵称会对所有联系人显示</div>
      </div>
    </PageBg>
  );
}

/* ── 修改个性签名 ── */
function EditBio({ user, updateUser, onBack }) {
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const MAX = 100;

  const save = async () => {
    if (saving) return; // 防连点：回车提交会绕过 disabled 按钮
    const trimmed = bio.trim();
    if (trimmed.length > MAX) { setError(`签名最多 ${MAX} 个字符`); return; }
    setSaving(true);
    setError('');
    try {
      const { data } = await axios.put('/api/users/profile', { bio: trimmed });
      updateUser(data);
      onBack();
    } catch (err) {
      setError(err.response?.data?.error || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageBg>
      <PageHeader title="修改个性签名" onBack={onBack}
        right={
          <button className="wc-save-btn" onClick={save} disabled={saving}>
            {saving ? '保存中' : '保存'}
          </button>
        }
      />
      <div className="wc-edit-pad">
        <Card>
          <div className="wc-edit-wrap">
            <textarea
              value={bio}
              onChange={e => { setBio(e.target.value); setError(''); }}
              maxLength={MAX}
              autoFocus
              placeholder="请输入个性签名"
              aria-label="修改个性签名"
              className="wc-edit-input wc-edit-textarea"
              rows={3}
            />
            <span className="wc-edit-counter">{bio.length}/{MAX}</span>
          </div>
        </Card>
        {error && <div className="wc-edit-error" role="alert">{error}</div>}
        <div className="wc-edit-hint">个性签名会在好友资料中显示</div>
      </div>
    </PageBg>
  );
}

/* ── 换绑手机号 ── */
function ChangePhone({ user, updateUser, onBack }) {
  const [newPhone, setNewPhone]   = useState('');
  const [password, setPassword]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const save = async () => {
    if (saving) return;
    if (!newPhone.trim() || !password) { setError('请填写新手机号和密码'); return; }
    setSaving(true);
    setError('');
    try {
      const { data } = await axios.put('/api/users/me/phone', {
        new_phone: newPhone.trim(),
        password,
      });
      // 更新本地用户信息中的手机号
      updateUser({ ...user, phone: data.phone });
      showToast('手机号已换绑成功', 'success');
      onBack();
    } catch (err) {
      setError(err.response?.data?.error || '换绑失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageBg>
      <PageHeader title="换绑手机号" onBack={onBack}
        right={
          <button className="wc-save-btn" onClick={save} disabled={saving}>
            {saving ? '保存中' : '保存'}
          </button>
        }
      />
      <div className="wc-edit-pad">
        <Card>
          <div style={{ padding: 'var(--sp-3) var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 4 }}>当前手机号</div>
              <div style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>{user?.phone || '未绑定'}</div>
            </div>
            <div>
              <label htmlFor="cp-phone" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>新手机号</label>
              <input
                id="cp-phone"
                type="tel"
                value={newPhone}
                onChange={e => { setNewPhone(e.target.value); setError(''); }}
                placeholder="请输入新手机号"
                aria-label="新手机号"
                className="wc-edit-input"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="cp-pass" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>登录密码（用于验证身份）</label>
              <input
                id="cp-pass"
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && save()}
                placeholder="请输入登录密码"
                aria-label="登录密码"
                className="wc-edit-input"
              />
            </div>
          </div>
        </Card>
        {error && <div className="wc-edit-error" role="alert">{error}</div>}
        <div className="wc-edit-hint">换绑后请使用新手机号登录</div>
      </div>
    </PageBg>
  );
}

/* ── 修改登录密码（settings-page 改版新增 UI，调用已有的 PUT /api/auth/change-password，
     不新增后端）。密码规则跟后端 auth.service.js changePassword() 校验一致：
     至少 8 位且需同时包含字母和数字，具体错误文案由后端返回，这里只做基本非空校验。── */
function ChangePassword({ onBack }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (saving) return;
    if (!oldPassword || !newPassword) { setError('请填写完整'); return; }
    if (newPassword !== confirmPassword) { setError('两次输入的新密码不一致'); return; }
    setSaving(true);
    setError('');
    try {
      // 响应里的 token 只有 Bearer 客户端（Electron/移动端）需要覆盖本地存储；
      // 本组件只在纯浏览器 WebSettingsShell 里可达（Cookie 鉴权），改密后端已经
      // 顺带刷新了 Cookie（见 auth.controller.js changePassword），这里无需处理 token。
      await axios.put('/api/auth/change-password', { oldPassword, newPassword });
      showToast('密码已修改', 'success');
      onBack();
    } catch (err) {
      setError(err.response?.data?.error || '修改失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageBg>
      <PageHeader title="修改登录密码" onBack={onBack}
        right={
          <button className="wc-save-btn" onClick={save} disabled={saving}>
            {saving ? '保存中' : '保存'}
          </button>
        }
      />
      <div className="wc-edit-pad">
        <Card>
          <div style={{ padding: 'var(--sp-3) var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <div>
              <label htmlFor="cpw-old" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>当前密码</label>
              <input
                id="cpw-old" type="password"
                value={oldPassword}
                onChange={e => { setOldPassword(e.target.value); setError(''); }}
                placeholder="请输入当前密码"
                aria-label="当前密码"
                className="wc-edit-input"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="cpw-new" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>新密码</label>
              <input
                id="cpw-new" type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setError(''); }}
                placeholder="至少 8 位，需包含字母和数字"
                aria-label="新密码"
                className="wc-edit-input"
              />
            </div>
            <div>
              <label htmlFor="cpw-confirm" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>确认新密码</label>
              <input
                id="cpw-confirm" type="password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && save()}
                placeholder="请再次输入新密码"
                aria-label="确认新密码"
                className="wc-edit-input"
              />
            </div>
          </div>
        </Card>
        {error && <div className="wc-edit-error" role="alert">{error}</div>}
        <div className="wc-edit-hint">修改后需重新登录，其他已登录设备会被强制下线</div>
      </div>
    </PageBg>
  );
}


function Wallet({ onBack }) {
  const [balance, setBalance] = useState(null);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recharging, setRecharging] = useState(false);
  const [error, setError] = useState('');
  const [rechargeInput, setRechargeInput] = useState('');
  const [showRecharge, setShowRecharge] = useState(false);

  const fetchWallet = useCallback(async (isAlive = () => true) => {
    try {
      const [b, t] = await Promise.all([
        axios.get('/api/wallet'),
        axios.get('/api/wallet/transactions', { params: { limit: 50 } }),
      ]);
      if (!isAlive()) return;
      setBalance(b.data?.balance ?? 0);
      setTxns(Array.isArray(t.data) ? t.data : []);
    } catch { /* 静默：余额显示为 — */ }
    if (isAlive()) setLoading(false);
  }, []);
  // 充值后刷新用（显示转圈）
  const load = useCallback(() => { setLoading(true); fetchWallet(); }, [fetchWallet]);
  // 初次挂载：loading 初值已为 true，effect 内不做同步 setState（fetchWallet 内 setState 均在 await 之后）
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchWallet 为异步取数，setState 发生在 await 之后
    fetchWallet(() => alive);
    return () => { alive = false; };
  }, [fetchWallet]);

  const recharge = async () => {
    if (recharging) return; // 防连点：回车提交会绕过 disabled 按钮，避免重复充值
    const amt = parseInt(rechargeInput, 10);
    if (!Number.isInteger(amt) || amt < 1 || amt > 100000) { setError('请输入 1-100000 的整数'); return; }
    setRecharging(true); setError('');
    try {
      const { data } = await axios.post('/api/wallet/recharge', { amount: amt });
      setBalance(data?.balance ?? balance);
      setRechargeInput('');
      setShowRecharge(false);
      load();
    } catch (e) { setError(e.response?.data?.error || '充值失败'); }
    setRecharging(false);
  };

  const TYPE_LABEL = { recharge: '充值', red_packet: '发红包', red_packet_refund: '红包退回', red_packet_claim: '领红包' };
  const fmtTime = (s) => { try { return new Date(s * 1000).toLocaleString(); } catch { return ''; } };

  return (
    <PageBg>
      <PageHeader title="我的钱包" onBack={onBack}
        right={<button className="wc-save-btn" onClick={() => { setShowRecharge(v => !v); setError(''); }}>{showRecharge ? '取消' : '充值'}</button>} />
      <div className="wc-section-pad">
        <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px var(--sp-4)', gap: 'var(--sp-1h)' }}>
          <div style={{ fontSize: 'var(--text-sm2)', color: 'var(--text-secondary)' }}>金币余额</div>
          <div style={{ fontSize: 'var(--text-display-xl)', fontWeight: 700, color: 'var(--green)' }}>{loading ? '…' : (balance ?? '—')}</div>
        </Card>
        {showRecharge && (
          <Card style={{ marginTop: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <input
              type="number" min="1" max="100000"
              placeholder="充值金币数量（1-100000）"
              aria-label="充值金币数量"
              value={rechargeInput}
              onChange={e => { setRechargeInput(e.target.value); setError(''); }}
              className="wc-server-input"
              style={{ marginTop: 0, flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && recharge()}
            />
            <button className="wc-save-btn" onClick={recharge} disabled={recharging || !rechargeInput}>
              {recharging ? '充值中' : '确认'}
            </button>
          </Card>
        )}
        {error && <div className="wc-edit-error" role="alert">{error}</div>}
      </div>
      <SLabel>交易记录</SLabel>
      <div className="wc-section-pad">
        <Card>
          {loading ? (
            <CRow label="加载中…" />
          ) : txns.length === 0 ? (
            <CRow label="暂无交易记录" />
          ) : txns.map(t => (
            <CRow key={t.id}
              label={TYPE_LABEL[t.type] || t.memo || t.type}
              desc={fmtTime(t.created_at)}
              right={<span style={{ color: t.amount >= 0 ? 'var(--green)' : 'var(--text-primary)', fontWeight: 600 }}>
                {t.amount >= 0 ? '+' : ''}{t.amount}
              </span>} />
          ))}
        </Card>
      </div>
    </PageBg>
  );
}

/* ── 邀请好友（专属邀请码 + 裂变战绩）── */
function InviteFriends({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');   // '' | 'code' | 'link'

  useEffect(() => {
    let alive = true;
    axios.get('/api/users/me/invite')
      .then(r => { if (alive) setData(r.data); })
      .catch(() => { if (alive) setData({ code: '', invitedCount: 0, invitees: [] }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // 浏览器端才有可分享的公网链接；桌面端 file:// 无意义，只给复制邀请码。
  const origin = window.location.origin;
  const inviteLink = /^https?:/.test(origin) && data?.code ? `${origin}/register?invite=${data.code}` : '';

  const copyText = async (text, which) => {
    if (!text) return;
    if (await copyToClipboard(text)) {
      setCopied(which);
      setTimeout(() => setCopied(''), 1500);
    } else {
      showToast('复制失败，请长按手动复制', 'error');
    }
  };

  const fmtTime = (s) => { try { return new Date(s * 1000).toLocaleDateString(); } catch { return ''; } };

  return (
    <PageBg>
      <PageHeader title="邀请好友" onBack={onBack} />
      <div className="wc-section-pad">
        <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px var(--sp-4)', gap: 'var(--sp-2h)' }}>
          <div style={{ fontSize: 'var(--text-sm2)', color: 'var(--text-secondary)' }}>我的专属邀请码</div>
          <div style={{ fontSize: 'var(--text-display-xl)', fontWeight: 700, letterSpacing: 6, color: 'var(--green)', userSelect: 'text' }}>
            {loading ? '……' : (data?.code || '—')}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="wc-save-btn" onClick={() => copyText(data?.code, 'code')} disabled={!data?.code}>
              {copied === 'code' ? '已复制' : '复制邀请码'}
            </button>
            {inviteLink && (
              <button className="wc-save-btn" onClick={() => copyText(inviteLink, 'link')}>
                {copied === 'link' ? '已复制' : '复制邀请链接'}
              </button>
            )}
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textAlign: 'center', marginTop: 4 }}>
            把邀请码或链接发给好友，Ta 注册后即成为你邀请的用户
          </div>
        </Card>
      </div>

      <div className="wc-section-pad">
        <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--sp-5) var(--sp-4)', gap: 'var(--sp-1)' }}>
          <div style={{ fontSize: 'var(--text-sm2)', color: 'var(--text-secondary)' }}>已成功邀请</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{loading ? '…' : (data?.invitedCount ?? 0)} 人</div>
        </Card>
      </div>

      <SLabel>邀请记录</SLabel>
      <div className="wc-section-pad">
        <Card>
          {loading ? (
            <CRow label="加载中…" />
          ) : (data?.invitees?.length ? data.invitees.map(u => (
            <CRow key={u.id}
              icon={<Avatar src={u.avatar} name={u.username} size={28} />} bg="transparent"
              label={u.username}
              desc={u.wechat_id ? `v信号：${u.wechat_id}` : ''}
              right={<span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{fmtTime(u.created_at)}</span>} />
          )) : <CRow label="还没有邀请记录，快去分享你的邀请码吧" />)}
        </Card>
      </div>
    </PageBg>
  );
}

/* ── 设备列表 ── */
function DeviceList({ onBack }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/auth/sessions')
      .then(({ data }) => setSessions(data))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  const removeSession = async (id) => {
    // 安全动作：仅在后端确实删除成功后才从 UI 移除，避免"已下线"的虚假安全感
    try {
      await axios.delete(`/api/auth/sessions/${id}`);
      setSessions(s => s.filter(x => x.id !== id));
    } catch (e) {
      showToast(e.response?.data?.error || '退出该设备失败，请重试', 'error');
    }
  };

  const removeAllSessions = async () => {
    if (!(await showConfirm('确定将此账号从其他所有设备退出？'))) return;
    try {
      await axios.delete('/api/auth/sessions');
      setSessions(s => s.filter(x => x.current));
    } catch (e) {
      showToast(e.response?.data?.error || '操作失败，请重试', 'error');
    }
  };

  const icon = (p = '') => {
    const pl = p.toLowerCase();
    if (pl.includes('windows') || pl.includes('mac')) return <IcoDeviceDesktop size={18} />;
    if (pl.includes('iphone') || pl.includes('ipad') || pl.includes('android')) return <IcoDeviceMobile size={18} />;
    return '🌐';
  };

  return (
    <PageBg>
      <PageHeader title="设备管理" onBack={onBack} />
      <div className="wc-device-pad">
        {loading ? (
          <div role="status" className="wc-loading">加载中…</div>
        ) : (
          <Card>
            {sessions.length === 0
              ? <div role="status" className="wc-empty">暂无设备记录</div>
              : sessions.map((s) => (
                <div key={s.id} className="wc-device-item">
                  <span className="wc-device-icon">{icon(s.platform)}</span>
                  <div className="wc-crow-body">
                    <div className="wc-device-name">{s.device || '未知设备'}</div>
                    <div className="wc-device-info">
                      {s.ip ? `${s.ip} · ` : ''}
                      {s.current ? '当前设备' : `最近活跃 ${new Date(s.last_seen * 1000).toLocaleDateString('zh-CN')}`}
                    </div>
                  </div>
                  {s.current
                    ? <span className="wc-badge-current">当前</span>
                    : <button className="wc-btn-exit" onClick={() => removeSession(s.id)}>退出</button>
                  }
                </div>
              ))
            }
          </Card>
        )}
        <div className="wc-device-hint">点击&quot;退出&quot;可远程下线该设备</div>
        {sessions.some(s => !s.current) && (
          <div className="wc-section-pad" style={{ marginTop: 8 }}>
            <button className="wc-btn-exit-all" onClick={removeAllSessions}>一键退出其他全部设备</button>
          </div>
        )}
      </div>
    </PageBg>
  );
}

/* ── 外观 ── */
function AppearanceSettings({ onBack }) {
  const { themeMode, setThemeMode, fontSize, setFontSize } = useSettings();
  const { lang, setLang } = useI18n();
  const FONT_OPTIONS = [
    { key: 'small',  label: '小',   size: 12 },
    { key: 'normal', label: '标准', size: 14 },
    { key: 'large',  label: '大',   size: 16 },
    { key: 'xlarge', label: '特大', size: 18 },
  ];
  return (
    <PageBg>
      <PageHeader title="外观" onBack={onBack} />
      <div className="wc-appearance-pad">
        <div className="wc-appearance-row">
          {[
            { label: '日间模式', mode: 'light', emoji: '☀️', bg: '#FFFFFF', border: '#E5E5EA', textColor: '#333' },
            { label: '夜间模式', mode: 'dark',  emoji: '🌙', bg: '#1C1C1E', border: '#48484A', textColor: '#EBEBF5' },
            { label: '跟随系统', mode: 'auto',  emoji: '🌗', bg: 'linear-gradient(105deg,#FFFFFF 50%,#1C1C1E 50%)', border: '#B0B4BC', textColor: '#888' },
          ].map(({ label, mode, emoji, bg, border, textColor }) => (
            <button key={mode} type="button"
              className="wc-appearance-btn"
              aria-pressed={themeMode === mode}
              style={{
                background: bg,
                border: `2.5px solid ${themeMode === mode ? 'var(--green)' : border}`,
                boxShadow: themeMode === mode ? '0 0 0 4px rgba(var(--color-primary-rgb),.15)' : '0 2px 8px rgba(0,0,0,.08)',
              }}
              onClick={() => setThemeMode(mode)}>
              <span className="wc-appearance-emoji">{emoji}</span>
              <span style={{ fontSize: 'var(--text-meta)', color: textColor, fontWeight: themeMode === mode ? 600 : 400 }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
      <SLabel>字体大小</SLabel>
      <div className="wc-section-pad">
        <Card>
          <div className="wc-font-size-row">
            {FONT_OPTIONS.map(({ key, label, size }) => (
              <button key={key} type="button"
                className={`wc-font-btn${fontSize === key ? ' active' : ''}`}
                aria-pressed={fontSize === key}
                onClick={() => setFontSize(key)}>
                <span className="wc-font-preview" style={{ fontSize: size }}>A</span>
                <span className="wc-font-label">{label}</span>
              </button>
            ))}
          </div>
          <div className="wc-font-demo">
            <span style={{ fontSize: 'var(--font-msg, 14px)' }}>消息示例：今天天气真好！</span>
          </div>
        </Card>
      </div>
      <SLabel>语言</SLabel>
      <div className="wc-section-pad">
        <Card>
          {SUPPORTED_LANGS.map(({ code, name }) => (
            <CRow key={code} label={name} onClick={() => setLang(code)}
              right={lang === code ? <svg viewBox="0 0 24 24" width="18" height="18" fill="var(--green)"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> : null}
            />
          ))}
        </Card>
      </div>
    </PageBg>
  );
}

/* ── 通知 ── */
function NotificationSettings({ onBack }) {
  const { notifySound, setNotifySound } = useSettings();
  const [messageNotify, setMessageNotify] = useState(true);
  const [preview, setPreview]             = useState(true);
  const [vibrate, setVibrate]             = useState(false);
  // 勿扰时段（夜间免打扰）：开关 + 起止时间（HH:MM）
  const [quietEnabled, setQuietEnabled]   = useState(false);
  const [quietStart, setQuietStart]       = useState('23:00');
  const [quietEnd, setQuietEnd]           = useState('07:00');
  const [saving, setSaving]               = useState(false);
  const [loaded, setLoaded]               = useState(false);

  // 初始化：从后端读取用户设置
  useEffect(() => {
    axios.get('/api/users/me/settings').then(r => {
      const s = r.data || {};
      // 后端 serializeSettings 返回 camelCase 布尔值（非 snake_case、非 0/1）
      setMessageNotify(s.messageNotify !== false);
      setPreview(s.detailPreview !== false);
      setVibrate(s.vibrate === true);
      setQuietEnabled(s.quietEnabled === true);
      if (s.quietStart) setQuietStart(s.quietStart);
      if (s.quietEnd) setQuietEnd(s.quietEnd);
      // 同步 localStorage（向后兼容老版本）
      localStorage.setItem('wc_lock_screen', s.messageNotify !== false ? '1' : '0');
      localStorage.setItem('wc_notify_preview', s.detailPreview !== false ? '1' : '0');
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const saveSettings = async (key, value) => {
    setSaving(true);
    try {
      // 键名须与后端 normalizeSettings 的 camelCase 一致，否则被 undefined 忽略、存不进
      await axios.put('/api/users/me/settings', { [key]: value });
      if (key === 'messageNotify') localStorage.setItem('wc_lock_screen', value ? '1' : '0');
      else if (key === 'detailPreview') localStorage.setItem('wc_notify_preview', value ? '1' : '0');
    } catch {
      // 回滚 UI 状态
      if (key === 'messageNotify') setMessageNotify(!value);
      else if (key === 'detailPreview') setPreview(!value);
      else if (key === 'vibrate') setVibrate(!value);
    }
    setSaving(false);
  };

  if (!loaded) return <PageBg><PageHeader title="通知设置" onBack={onBack} /></PageBg>;

  return (
    <PageBg>
      <PageHeader title="通知设置" onBack={onBack} />
      <SLabel>消息通知</SLabel>
      <div className="wc-notif-pad">
        <Card>
          <CRow label="锁屏通知" desc="关闭后不会收到消息推送"
            right={<Toggle checked={messageNotify} onChange={v => { setMessageNotify(v); saveSettings('messageNotify', v); }} disabled={saving} />} />
          <CRow label="消息详情预览" desc={'关闭后通知只显示"收到新消息"'}
            right={<Toggle checked={preview} onChange={v => { setPreview(v); saveSettings('detailPreview', v); }} disabled={saving} />} />
          <CRow label="通知声音"
            right={<Toggle checked={notifySound} onChange={setNotifySound} />} />
          <CRow label="通知震动"
            right={<Toggle checked={vibrate} onChange={v => { setVibrate(v); saveSettings('vibrate', v); }} disabled={saving} />} />
        </Card>
      </div>

      {/* 勿扰时段（夜间免打扰）：时段内消息照常送达，仅抑制推送通知 */}
      <SLabel>勿扰时段</SLabel>
      <div className="wc-notif-pad">
        <Card>
          <CRow label="夜间免打扰" desc="开启后，设定时段内不推送通知（消息照常送达）"
            right={<Toggle checked={quietEnabled} onChange={v => { setQuietEnabled(v); saveSettings('quietEnabled', v); }} disabled={saving} />} />
          {quietEnabled && (
            <>
              <CRow label="开始时间"
                right={<input type="time" value={quietStart} disabled={saving}
                  data-testid="quiet-start-input"
                  onChange={e => { setQuietStart(e.target.value); saveSettings('quietStart', e.target.value); }}
                  style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 'var(--text-base)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />} />
              <CRow label="结束时间"
                right={<input type="time" value={quietEnd} disabled={saving}
                  data-testid="quiet-end-input"
                  onChange={e => { setQuietEnd(e.target.value); saveSettings('quietEnd', e.target.value); }}
                  style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 'var(--text-base)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />} />
            </>
          )}
        </Card>
      </div>
    </PageBg>
  );
}

/* ── 隐私与安全 ── */
function PrivacySettings({ user, onBack }) {
  const [page, setPage] = useState('main');
  const [settings, setSettings] = useState({
    // 仅保留后端 serializeSettings 真实支持的开关（对齐 Android/iOS）
    addByVxinId: true, addByPhone: true, requireVerify: true,
    noDirectGroupInvite: false, profileVisible: true, blockUnknownMessages: false,
  });

  useEffect(() => {
    axios.get('/api/users/me/settings')
      .then(({ data }) => setSettings(s => ({ ...s, ...data })))
      .catch(() => {});
  }, []);

  const setFlag = async (key, value) => {
    const prev = settings[key];
    setSettings(s => ({ ...s, [key]: value }));
    try {
      const { data } = await axios.put('/api/users/me/settings', { [key]: value });
      setSettings(s => ({ ...s, ...data }));
    } catch {
      setSettings(s => ({ ...s, [key]: prev }));
    }
  };

  if (page === 'add-methods') return (
    <PageBg>
      <PageHeader title="添加我的方式" onBack={() => setPage('main')} />
      <div className="wc-privacy-outer">
        <div className="wc-privacy-desc">允许他人通过以下方式添加我</div>
        <Card>
          <CRow label="ID号" desc={user?.wechat_id ? `v信号: ${user.wechat_id}` : '未分配'}
            right={<Toggle checked={settings.addByVxinId} onChange={v => setFlag('addByVxinId', v)} />} />
          <CRow label="手机号" desc={user?.phone || ''}
            right={<Toggle checked={settings.addByPhone} onChange={v => setFlag('addByPhone', v)} />} />
        </Card>
      </div>
    </PageBg>
  );

  return (
    <PageBg>
      <PageHeader title="隐私与安全" onBack={onBack} />
      <div className="wc-privacy-outer">
        <Card className="wc-privacy-card-mt">
          <CRow label="添加我的方式" desc="ID号、手机号" onClick={() => setPage('add-methods')} />
          <CRow label="需要验证才能添加好友" desc="关闭后对方可直接添加你"
            right={<Toggle checked={settings.requireVerify} onChange={v => setFlag('requireVerify', v)} />} />
          <CRow label="不允许好友直接邀请我进群" desc="开启后好友无法把你直接拉进群，需你扫码/点链接自行加入"
            right={<Toggle checked={settings.noDirectGroupInvite} onChange={v => setFlag('noDirectGroupInvite', v)} />} />
          <CRow label="向陌生人展示个人信息" desc="关闭后非好友无法查看你的签名等资料"
            right={<Toggle checked={settings.profileVisible} onChange={v => setFlag('profileVisible', v)} />} />
          <CRow label="屏蔽陌生人消息" desc="开启后仅好友可以给你发消息"
            right={<Toggle checked={settings.blockUnknownMessages} onChange={v => setFlag('blockUnknownMessages', v)} />} />
        </Card>
      </div>
    </PageBg>
  );
}

/* ── 账号切换栏（多账号） ── */
function AccountSwitcher({ user, accounts, login, switchAccount }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ phone: '', password: '' });
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const phoneRef = useRef(null);

  // switchAccount 是 async 函数、成功时内部自己会 reload（见 AuthContext.jsx）；
  // 之前这里写成 `if (switchAccount(id)) window.location.reload()` 是把返回的
  // Promise 当同步布尔值判断（Promise 恒真），等于请求一发出、还没等结果就立刻
  // reload，可能在切换生效前就刷新页面。改成 await + 失败回退密码登录表单，
  // 与 components/AccountSwitcher.jsx 里同样场景的写法保持一致。
  const doSwitch = async (id) => {
    if (id === user?.id) return;
    const acct = accounts.find(a => a.id === id);
    try {
      await switchAccount(id);
    } catch {
      // 免密切换失败 → 回退到密码登录表单，预填手机号（不在此处抢焦点：
      // phoneRef 是渲染期在 .map() 内构造的回调间接可达，eslint-plugin-react-hooks
      // 的 refs 规则会保守报警；表单展开后用户自己点击输入框即可，不影响可用性）。
      setForm(f => ({ ...f, phone: acct?.user?.phone || '' }));
      setShowForm(true);
    }
  };

  const doAdd = async (e) => {
    e.preventDefault();
    if (!form.phone || !form.password) { setError('请填写手机号和密码'); return; }
    setError(''); setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', form);
      login(data.user, data.token); // 必须传 token:Bearer端(Electron/移动)漏传会清掉鉴权头→reload后被登出
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.error || '手机号或密码错误');
      setLoading(false);
    }
  };

  const toggleForm = () => {
    setShowForm(v => !v);
    setError('');
    setForm({ phone: '', password: '' });
    if (!showForm) setTimeout(() => phoneRef.current?.focus(), 80);
  };

  /* 只显示非当前账号 */
  const otherAccounts = accounts.filter(a => a.id !== user?.id);

  return (
    <Card>
      {otherAccounts.map((a) => (
          <div key={a.id} onClick={() => doSwitch(a.id)} className="wc-add-row" role="button" tabIndex={0} onKeyDown={activateOnKey(() => doSwitch(a.id))}>
            <div className="wc-add-avatar-wrap">
              <Avatar src={a.user?.avatar} name={a.user?.username} size={40} />
            </div>
            <div className="wc-crow-body">
              <div className="wc-add-name">{a.user?.username || '未命名'}</div>
              {a.user?.phone && <div className="wc-add-phone">{a.user.phone}</div>}
            </div>
            <span className="wc-add-switch">切换</span>
          </div>
      ))}

      <div onClick={toggleForm} className="wc-add-row" role="button" tabIndex={0} onKeyDown={e => activateOnKey(toggleForm)(e)}>
        <div className="wc-add-icon-wrap" style={{ borderColor: showForm ? 'var(--green)' : undefined }}>
          <svg className="wc-add-icon-svg" style={{ fill: showForm ? 'var(--green)' : undefined }} viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </div>
        <span className="wc-add-label" style={{ color: showForm ? 'var(--green)' : undefined }}>添加账户</span>
        <svg className="wc-add-chevron" style={{ transform: showForm ? 'rotate(90deg)' : undefined }} viewBox="0 0 24 24">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
      </div>

      {showForm && (
        <div className="wc-add-form">
          <div className="wc-add-info">
            <span className="wc-add-info-text">添加后旧账号不会退出，可随时切换</span>
          </div>
          <form onSubmit={doAdd} className="wc-add-form-inner">
            <input ref={phoneRef} type="tel" placeholder="手机号" aria-label="手机号" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="wc-add-form-input" />
            <input type="password" placeholder="密码" aria-label="密码" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="wc-add-form-input" />
            {error && <div className="wc-add-form-error" role="alert">{error}</div>}
            <button type="submit" disabled={loading} className="wc-add-form-submit">
              {loading ? '登录中…' : '登录并切换'}
            </button>
          </form>
        </div>
      )}
    </Card>
  );
}

async function doLogout(logout) {
  // Service Worker 推送退订已由 AuthContext.logout() 内部用 getRegistration() 安全处理。
  // ⚠ 此前这里先 `await navigator.serviceWorker?.ready` 再登出：Web 端有 SW 注册能 resolve，
  //   但 Electron(file://)与移动端(Capacitor 原生 webview)从不注册 SW，navigator.serviceWorker
  //   虽存在但 .ready 永不 resolve → await 永久挂起 → logout()/goLogin() 永远执行不到，
  //   表现为「桌面/移动端点退出登录没反应」。改为直接 await logout()(内部用 getRegistration，
  //   立即 resolve、不挂起) 再跳转登录页。
  await logout();
  goLogin();
}

// 清除本地 Cache Storage（settings-page 改版：从 GeneralSettings 抽成共享函数，
// 供「通用设置」和新的「账号与安全 → 其他」分组的「清除缓存」行共用同一份真实逻辑，
// 不新增行为，只是避免在两处重复写一样的 caches.keys()/delete）。
async function clearBrowserCache() {
  if (!window.caches) return;
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
}

// 加入时间：users.created_at 是秒级 unix 时间戳，纯展示格式化，不依赖 time.js 里
// 那几个"相对时间/消息分割线"专用的格式化函数（语义不一样，硬凑反而别扭）。
function formatJoinDate(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const IcoUserRow = () => <Ico d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>;
const IcoIdRow   = () => <Ico d="M21 5H3c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 12H3V7h18v10zM6 15h6v-1.5H6V15zm0-3h9v-1.5H6V12zm0-3h9V7.5H6V9z"/>;
const IcoBioRow  = () => <Ico d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>;

/* ── 个人资料详情页（渐变 Hero + 卡片信息） ──
   desktop=true：桌面 Web(≥768、排除 Electron)专属大卡片版式，对齐 Web个人资料页.jpg；
   默认 false 就是移动端/Electron 原有单栏版式，逻辑（头像上传/复制v信号）两边共用。 */
function ProfileDetail({ user, updateUser, onBack, navigateTo, desktop = false }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleAvatarClick = () => {
    fileRef.current?.click();
  };

  const copyVid = async () => {
    if (!user?.wechat_id) return;
    const ok = await copyToClipboard(user.wechat_id);
    showToast(ok ? '已复制 v信号' : '复制失败', ok ? 'success' : 'error');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED.includes(file.type)) {
      showToast('仅支持 JPG、PNG、GIF、WebP 格式', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('图片大小不能超过 5MB', 'error');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const { data } = await axios.post('/api/users/avatar', fd);
      if (data?.avatar) {
        updateUser({ ...user, avatar: data.avatar });
      }
    } catch (err) {
      showToast(err.response?.data?.error || '头像上传失败，请重试', 'error');
    } finally {
      e.target.value = ''; // 允许再次选择同一文件重试
    }
    setUploading(false);
  };

  if (desktop) {
    return (
      <PageBg>
        <PageHeader title="个人资料" />
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

        <div className="wc-section-pad">
          <Card className="wc-profile-hero">
            <div className="wc-profile-hero-avatar-wrap" role="button" tabIndex={0}
              onClick={handleAvatarClick} onKeyDown={e => activateOnKey(handleAvatarClick)(e)}
              aria-label="更换头像">
              <Avatar src={user?.avatar} name={user?.username} size={84} style={{ borderRadius: 'var(--radius-md)' }} />
              <span className="wc-profile-hero-cam" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M9 3l-1.83 2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2h-3.17L15 3H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
              </span>
              {uploading && <div className="pf-avatar-uploading">上传中…</div>}
            </div>
            <div className="wc-profile-hero-info">
              <div className="wc-profile-hero-name">{user?.username || '未设置昵称'}</div>
              {user?.wechat_id && <div className="wc-profile-hero-account">{user.wechat_id}</div>}
              <div className="wc-profile-hero-bio">{user?.bio || '这个人很酷，还没有签名'}</div>
              {!!user?.created_at && (
                <div className="wc-profile-hero-joined">加入 v信：{formatJoinDate(user.created_at)}</div>
              )}
            </div>
          </Card>
        </div>

        <div className="wc-section-pad">
          <Card>
            <CRow icon={<IcoUserRow />} bg="var(--color-primary)" label="用户名"
              value={user?.username || ''} onClick={() => navigateTo?.('edit-name')} />
            <CRow icon={<IcoIdRow />} bg="var(--icon-bg-invite)" label="微信号"
              value={user?.wechat_id || ''} onClick={user?.wechat_id ? copyVid : undefined} />
            <CRow icon={<IcoBioRow />} bg="var(--icon-bg-schedule)" label="个性签名"
              value={user?.bio || '未设置'} onClick={() => navigateTo?.('edit-bio')} />
            <CRow icon={<IcoPhoneRow />} bg="var(--icon-bg-phone)" label="手机"
              value={maskPhone(user?.phone)} onClick={() => navigateTo?.('change-phone')} />
          </Card>
        </div>
      </PageBg>
    );
  }

  return (
    <PageBg>
      <PageHeader title="个人资料" onBack={onBack} />
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* ── 渐变 Hero ── */}
      <div className="pf-hero">
        <div className="pf-hero-bg" aria-hidden="true" />
        <div className="pf-hero-inner">
          <div className="pf-avatar-wrap" role="button" tabIndex={0}
            onClick={handleAvatarClick} onKeyDown={e => activateOnKey(handleAvatarClick)(e)}
            aria-label="更换头像">
            <Avatar src={user?.avatar} name={user?.username} size={92} />
            <span className="pf-avatar-edit" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </span>
            {uploading && <div className="pf-avatar-uploading">上传中…</div>}
          </div>
          <div className="pf-hero-name">{user?.username || '未设置昵称'}</div>
          <div className="pf-hero-bio">{user?.bio || '这个人很酷，还没有签名'}</div>
          {user?.wechat_id && (
            <button className="pf-vid-chip" onClick={copyVid} title="点击复制 v信号">
              <span className="pf-vid-label">v信号</span>
              <span className="pf-vid-value">{user.wechat_id}</span>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* ── 可编辑资料 ── */}
      <div className="wc-section-pad">
        <Card>
          <CRow label="昵称" value={user?.username || ''} onClick={() => navigateTo?.('edit-name')} />
          <CRow label="个性签名" value={user?.bio || '未设置'} onClick={() => navigateTo?.('edit-bio')} />
        </Card>
      </div>
      <SLabel>账号信息</SLabel>
      <div className="wc-section-pad">
        <Card>
          <CRow label="v信号" value={user?.wechat_id || ''} onClick={user?.wechat_id ? copyVid : undefined} />
          <CRow label="手机号" value={user?.phone || ''} onClick={() => navigateTo?.('change-phone')} />
        </Card>
      </div>
    </PageBg>
  );
}

/* ── 设置总览页（二级） ── */
function ServerSettings({ onBack }) {
  const { changeServer } = useAuth();
  const currentUrl = localStorage.getItem('vxin_server_url') || axios.defaults.baseURL || '';
  const [input, setInput] = useState(currentUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const testConn = async () => {
    const url = input.trim().replace(/\/$/, '');
    if (!url.startsWith('http')) { setTestResult({ ok: false, msg: '格式错误，请以 http:// 或 https:// 开头' }); return; }
    setTesting(true); setTestResult(null);
    try {
      await fetch(`${url}/health`, { signal: timeoutSignal(6000) });
      setTestResult({ ok: true, msg: '连接成功 ✓' });
    } catch {
      setTestResult({ ok: false, msg: '无法连接到该服务器，请检查地址' });
    } finally { setTesting(false); }
  };

  const handleSave = async () => {
    const url = input.trim().replace(/\/$/, '');
    if (!url.startsWith('http')) return;
    setSaving(true);
    await changeServer(url);
    setSaving(false);
  };

  return (
    <PageBg>
      <PageHeader title="服务器地址" onBack={onBack} />
      <div className="wc-server-pad">
        <div className="wc-server-label">服务器地址（支持 IP 或域名）</div>
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setTestResult(null); }}
          placeholder="https://example.com"
          aria-label="服务器地址"
          className="wc-server-input"
        />
        {testResult && (
          <div role="status" style={{ marginTop: 8, fontSize: 'var(--text-sm2)', color: testResult.ok ? 'var(--green)' : 'var(--color-badge)' }}>
            {testResult.msg}
          </div>
        )}
      </div>
      <div className="wc-server-btn-row">
        <button onClick={testConn} disabled={testing} className="wc-btn-test">
          {testing ? '检测中…' : '测试连接'}
        </button>
        <button onClick={handleSave} disabled={saving || !input.trim().startsWith('http')} className="wc-btn-save">
          {saving ? '切换中…' : '保存并切换'}
        </button>
      </div>
      <div className="wc-server-hint">
        <div className="wc-server-hint-box">
          切换服务器后当前账号会自动退出，用新服务器的账号重新登录即可，无需重装客户端。
        </div>
      </div>
    </PageBg>
  );
}

/* ── 通用设置：开机自动启动（仅桌面端，真实 IPC）+ 清除缓存（真实 Cache Storage）+ 关于 v信 ── */
function GeneralSettings({ onBack }) {
  const isElectron = !!window.__ELECTRON_CONFIG__;
  const [autoLaunch, setAutoLaunchState] = useState(false);
  const [cacheBytes, setCacheBytes] = useState(null);
  const [clearing, setClearing] = useState(false);

  const refreshCacheSize = useCallback(async () => {
    try {
      if (navigator.storage?.estimate) {
        const { usage } = await navigator.storage.estimate();
        setCacheBytes(usage ?? 0);
      }
    } catch { /* 部分浏览器/环境不支持 estimate()，静默降级为不显示大小 */ }
  }, []);

  useEffect(() => {
    if (isElectron) window.electronAPI?.getAutoLaunch?.().then(v => setAutoLaunchState(!!v));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 首次挂载时读取 Cache Storage 用量（外部系统只读查询，非派生 state）
    refreshCacheSize();
  }, [isElectron, refreshCacheSize]);

  const toggleAutoLaunch = async (next) => {
    setAutoLaunchState(next);
    try { await window.electronAPI?.setAutoLaunch?.(next); } catch { /* ignore */ }
  };

  const clearCache = async () => {
    if (!await showConfirm('将清除本地图片等缓存，不影响服务器上的聊天记录。')) return;
    setClearing(true);
    try { await clearBrowserCache(); } catch { /* ignore */ }
    await refreshCacheSize();
    setClearing(false);
  };

  const formatBytes = (n) => {
    if (n == null) return '';
    const mb = n / 1024 / 1024;
    return mb < 0.1 ? '0 MB' : `${mb.toFixed(1)} MB`;
  };

  return (
    <PageBg>
      <PageHeader title="通用设置" onBack={onBack} />
      {isElectron && (
        <div className="wc-section-pad">
          <Card>
            <CRow icon={<IcoDesktop />} bg="var(--icon-bg-neutral)" label="开机自动启动"
              right={<Toggle checked={autoLaunch} onChange={toggleAutoLaunch} />} />
          </Card>
        </div>
      )}
      <div className="wc-section-pad">
        <Card>
          <CRow icon={<Ico d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>}
            bg="var(--icon-bg-neutral)" label="清除缓存"
            desc={clearing ? '清除中…' : undefined}
            value={!clearing ? formatBytes(cacheBytes) : undefined}
            onClick={clearing ? undefined : clearCache} />
          <CRow icon={<Ico d="M11 7h2v2h-2V7zm0 4h2v6h-2v-6zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>}
            bg="var(--icon-bg-neutral)" label="关于 v信"
            value={isElectron ? (window.__ELECTRON_CONFIG__?.appVersion || '') : __APP_VERSION__} />
        </Card>
      </div>
    </PageBg>
  );
}

/* ── 关于 v信（独立导航项，与「通用设置」里的版本号同一个真实来源） ── */
function AboutPanel({ onBack }) {
  const isElectron = !!window.__ELECTRON_CONFIG__;
  const version = isElectron ? (window.__ELECTRON_CONFIG__?.appVersion || '') : __APP_VERSION__;
  return (
    <PageBg>
      <PageHeader title="关于 v信" onBack={onBack} />
      <div className="wc-section-pad">
        <Card>
          <CRow label="版本" value={`v${version}`} />
        </Card>
      </div>
      <div style={{ textAlign: 'center', padding: '16px 0 24px', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
        © {new Date().getFullYear()} v信. 保留所有权利。
      </div>
    </PageBg>
  );
}

// 手机号展示打码：+8613800005678 / 13800005678 → +86 138****5678，纯前端格式化，
// 不改数据本身（settings-page 改版按设计稿视觉对齐，不是新业务逻辑）。
function maskPhone(phone) {
  if (!phone) return '未绑定';
  const m = String(phone).match(/^(\+?\d{0,3})?(\d{3})\d{4}(\d{4})$/);
  if (!m) return phone; // 格式不认识就原样显示，不瞎猜
  const [, cc, head, tail] = m;
  return `${cc ? cc + ' ' : ''}${head}****${tail}`;
}

/* ── 账号注销二次确认弹窗：先文字确认一次(showConfirm)，这里是第二步——
   收集密码 + 醒目的不可恢复警告，真正调用 POST /api/auth/delete-account。
   后端要求 body 里必须有 password（见 auth.controller.js deleteAccount），不是别的字段。── */
function DeleteAccountModal({ onClose, logout }) {
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const confirmDelete = async () => {
    if (deleting) return;
    if (!password) { setError('请输入登录密码确认'); return; }
    setDeleting(true);
    setError('');
    try {
      await axios.post('/api/auth/delete-account', { password });
      // 后端已清 Cookie + 拉黑当前 token；前端调 logout() 清本地状态后跳登录页，
      // 跟 doLogout 走的是同一套收尾（Service Worker 退订等），账号已经不存在了不用等确认。
      await logout();
      goLogin();
    } catch (err) {
      setError(err.response?.data?.error || '注销失败，请检查密码后重试');
      setDeleting(false);
    }
  };

  return (
    <div className="wc-modal-overlay" onClick={e => e.target === e.currentTarget && !deleting && onClose()}>
      <div className="wc-modal" role="dialog" aria-modal="true" aria-label="注销账号确认">
        <div className="wc-modal-header">
          <span className="wc-modal-title">注销账号</span>
          <button className="wc-modal-close" onClick={onClose} disabled={deleting} aria-label="关闭"><IcoClose size={18} /></button>
        </div>
        <div className="wc-modal-body">
          <div className="wc-delete-account-warning" role="alert">
            此操作将<strong>永久删除</strong>你的账号，聊天记录、联系人、群组等所有数据都会被清除，
            <strong>无法恢复，也无法找回</strong>。请谨慎操作。
          </div>
          <div style={{ marginTop: 'var(--sp-3)' }}>
            <label htmlFor="del-acc-pass" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>输入登录密码以确认</label>
            <input
              id="del-acc-pass" type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && confirmDelete()}
              placeholder="请输入登录密码"
              aria-label="登录密码"
              className="wc-edit-input"
              autoFocus
              style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-2h)' }}
            />
          </div>
          {error && <div className="wc-edit-error" role="alert" style={{ marginTop: 'var(--sp-2)' }}>{error}</div>}
        </div>
        <div className="wc-modal-footer">
          <button className="wc-modal-btn secondary" onClick={onClose} disabled={deleting}>取消</button>
          <button className="wc-modal-btn danger" onClick={confirmDelete} disabled={deleting || !password}>
            {deleting ? '注销中…' : '永久注销'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 账号与安全：账号信息 / 安全设置 / 其他 三个分组白卡片，对齐 Web设置页.jpg ──
   每一行都复用已有的真实功能入口/接口，没有新增后端。「邮箱」行(数据库无此字段)和
   「登录保护」开关(前后端都没有这功能)按已确认的方案去掉，不做假 UI。
   「已认证」徽章设计稿有画，但全仓库找不到 verified/已认证 字段——同样不摆假状态，
   头像行只显示昵称，不加徽章(我自己的判断，跟去掉邮箱/登录保护是同一个道理，供你复核)。── */
function AccountSecurityPanel({ user, navigateTo, logout }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  const handleDeleteAccountClick = async () => {
    if (!(await showConfirm('账号注销后不可恢复，所有聊天记录、联系人、群组数据都会被永久清除。确定要继续吗？'))) return;
    setShowDeleteModal(true);
  };

  const handleClearCache = async () => {
    if (!(await showConfirm('将清除本地图片等缓存，不影响服务器上的聊天记录。'))) return;
    setClearingCache(true);
    try { await clearBrowserCache(); } catch { /* ignore */ }
    setClearingCache(false);
    showToast('缓存已清除', 'success');
  };

  return (
    <PageBg>
      <PageHeader title="账号与安全" />

      <SLabel>账号信息</SLabel>
      <div className="wc-section-pad">
        <Card>
          <div className="wc-account-info-row">
            <Avatar src={user?.avatar} name={user?.username} size={44} />
            <div className="wc-account-info-name">
              <div className="wc-crow-label">{user?.username || '未设置昵称'}</div>
              {user?.wechat_id && <div className="wc-crow-desc">v信号：{user.wechat_id}</div>}
            </div>
            <button className="wc-crow-btn" onClick={() => navigateTo('profile-detail')}>编辑资料</button>
          </div>
          <CRow icon={<IcoPhoneRow />} bg="var(--icon-bg-phone)" label="手机号" value={maskPhone(user?.phone)}
            right={<button className="wc-crow-btn" onClick={() => navigateTo('change-phone')}>修改</button>} />
          <CRow icon={<IcoKeyRow />} bg="var(--icon-bg-newfriend)" label="登录密码" value="********"
            right={<button className="wc-crow-btn" onClick={() => navigateTo('change-password')}>修改</button>} />
        </Card>
      </div>

      <SLabel>安全设置</SLabel>
      <div className="wc-section-pad">
        <Card>
          <CRow icon={<IcoDeviceMobile />} bg="var(--icon-bg-device)" label="设备管理" desc="管理已登录的设备"
            right={<button className="wc-crow-btn" onClick={() => navigateTo('devices')}>管理</button>} />
          <CRow icon={<IcoLockRow />} bg="var(--color-badge)" label="账号注销" danger desc="永久注销账号，所有数据将被清除"
            right={<button className="wc-crow-btn wc-crow-btn-danger" onClick={handleDeleteAccountClick}>注销账号</button>} />
        </Card>
      </div>

      <SLabel>其他</SLabel>
      <div className="wc-section-pad">
        <Card>
          <CRow icon={<IcoGlobeRow />} bg="var(--icon-bg-neutral)" label="v信网页版" desc="在浏览器中使用 v信"
            right={<button className="wc-crow-btn" onClick={() => doLogout(logout)}>退出登录</button>} />
          <CRow icon={<IcoTrashRow />} bg="var(--icon-bg-newfriend)" label="清除缓存" desc="释放存储空间，不会删除聊天记录"
            right={<button className="wc-crow-btn" onClick={handleClearCache} disabled={clearingCache}>{clearingCache ? '清除中…' : '清除'}</button>} />
        </Card>
      </div>

      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} logout={logout} />}
    </PageBg>
  );
}

/* ── Web 桌面端设置两栏壳：左侧分类导航 + 右侧内容，复用已有子页面组件，不复制业务逻辑 ── */
function WebSettingsShell({ user, updateUser, navigateTo, logout }) {
  // 默认选中「账号与安全」，对齐 Web设置页.jpg 从左侧「设置」rail 进入时的默认态
  const [section, setSection] = useState('account');
  // 菜单栏窄视口折叠(≤767px，跟 Home.jsx 里 isMobile 判定用的同一个 768 断点对齐，
  // 不新引入阈值)：点「设置」标题展开/收起菜单列表。≥768px 时这个状态不参与渲染
  // (CSS 只在 @media (max-width:767px) 里生效)，默认展开对宽屏零影响。
  const [navExpanded, setNavExpanded] = useState(true);

  // settings-page 改版：菜单栏从 6 项扩到 7 项，顺序对齐 Web设置页.jpg / Web个人资料页.jpg——
  // 两张设计稿「个人资料」是否算独立菜单项画得不一致，以画了独立整屏内容的
  // Web个人资料页.jpg 为准，保留为独立项（排在「快捷键」后、「关于v信」前）。
  // 「聊天设置」「文件管理」设计稿里有画，但现有代码没有对应的全局页面/接口支撑，
  // 是空壳——按已确认的方案不放进菜单。
  const NAV = [
    { key: 'account',       label: '账号与安全', icon: <IcoShield /> },
    { key: 'privacy',       label: '隐私设置', icon: <IcoShield /> },
    { key: 'notifications', label: '通知设置', icon: <IcoBell /> },
    { key: 'general',       label: '通用设置', icon: <IcoDesktop /> },
    { key: 'shortcuts',     label: '快捷键', icon: <IcoKeyboard /> },
    { key: 'profile',       label: '个人资料', icon: <IcoDesktop /> },
    { key: 'about',         label: '关于 v信', icon: <IcoServer /> },
  ];

  return (
    <div className="wc-settings-shell">
      <div className={`wc-settings-nav${navExpanded ? '' : ' collapsed'}`}>
        <button type="button" className="wc-settings-nav-title" onClick={() => setNavExpanded(v => !v)}
          aria-expanded={navExpanded} aria-controls="wc-settings-nav-list">
          设置
          <ChevronRight />
        </button>
        <div id="wc-settings-nav-list">
          {NAV.map(item => (
            <button key={item.key} type="button"
              className={`wc-settings-nav-item${section === item.key ? ' active' : ''}`}
              onClick={() => { setSection(item.key); setNavExpanded(false); }}>
              <span className="wc-settings-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="wc-settings-content">
        {section === 'account'       && <AccountSecurityPanel user={user} navigateTo={navigateTo} logout={logout} />}
        {section === 'privacy'       && <PrivacySettings user={user} />}
        {section === 'notifications' && <NotificationSettings />}
        {section === 'general'       && <GeneralSettings />}
        {section === 'shortcuts'     && <ShortcutSettings />}
        {section === 'profile'       && <ProfileDetail user={user} updateUser={updateUser} navigateTo={navigateTo} desktop />}
        {section === 'about'         && <AboutPanel />}
      </div>
    </div>
  );
}

/* ── 快捷键设置（仅桌面端） ── */
function ShortcutSettings({ onBack }) {
  // 快捷键定义：key = store 里的键名，label = 显示名，desc = 功能说明
  const SHORTCUT_DEFS = [
    { key: 'screenshot', label: '截图', desc: '截取全屏并发送到当前会话' },
  ];

  const [shortcuts, setShortcuts] = useState({});
  const [recording, setRecording] = useState(null); // 正在录制的 key
  const [status, setStatus] = useState({});          // { [key]: { ok, msg } }

  useEffect(() => {
    window.electronAPI?.getShortcuts?.().then(s => setShortcuts(s || {}));
  }, []);

  const saveShortcut = useCallback(async (key, accel) => {
    const ok = await window.electronAPI?.setShortcut?.(key, accel);
    if (ok) {
      setShortcuts(prev => ({ ...prev, [key]: accel }));
      setStatus(prev => ({ ...prev, [key]: { ok: true, msg: '已保存 ✓' } }));
    } else {
      setStatus(prev => ({ ...prev, [key]: { ok: false, msg: '快捷键无效或被系统占用' } }));
    }
    setTimeout(() => setStatus(prev => ({ ...prev, [key]: null })), 2500);
  }, []);

  // 监听键盘录制
  const handleKeyDown = useCallback((e) => {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();
    // 忽略纯修饰键
    if (['Control','Shift','Alt','Meta','OS'].includes(e.key)) return;
    const parts = [];
    if (e.ctrlKey  || e.metaKey) parts.push('CommandOrControl');
    if (e.altKey)   parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    // 普通键名映射：F1-F12 / 字母 / 数字 / 符号
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    parts.push(key);
    const accel = parts.join('+');
    setRecording(null);
    saveShortcut(recording, accel);
  }, [recording, saveShortcut]);

  useEffect(() => {
    if (recording) {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [recording, handleKeyDown]);

  const resetOne = async (key) => {
    await window.electronAPI?.resetShortcuts?.(key);
    const fresh = await window.electronAPI?.getShortcuts?.();
    setShortcuts(fresh || {});
    setStatus(prev => ({ ...prev, [key]: { ok: true, msg: '已恢复默认 ✓' } }));
    setTimeout(() => setStatus(prev => ({ ...prev, [key]: null })), 2500);
  };

  // 把 Electron 加速键格式 (CommandOrControl+Alt+A) 转为可读展示 (Ctrl+Alt+A)
  const displayAccel = (accel = '') =>
    accel.replace('CommandOrControl', 'Ctrl').replace(/\+/g, ' + ');

  return (
    <PageBg>
      <PageHeader title="快捷键设置" onBack={onBack} />
      <div className="wc-server-pad">
        <div className="wc-server-label">
          点击「录制」后按下目标组合键即可绑定（需含至少一个修饰键：Ctrl / Alt / Shift）
        </div>
      </div>
      {SHORTCUT_DEFS.map(({ key, label, desc }) => {
        const current = shortcuts[key] || '';
        const isRec = recording === key;
        const st = status[key];
        return (
          <div key={key} className="wc-server-pad" style={{ paddingTop: 0 }}>
            <div className="wc-shortcut-row">
              <div>
                <div style={{ fontWeight: 'var(--font-medium)', fontSize: 'var(--text-base)' }}>{label}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>{desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexShrink: 0 }}>
                <kbd className={`wc-shortcut-kbd${isRec ? ' wc-shortcut-kbd--recording' : ''}`}
                  aria-label={isRec ? '正在录制…' : `当前快捷键：${displayAccel(current)}`}>
                  {isRec ? '请按键…' : (displayAccel(current) || '未设置')}
                </kbd>
                <button
                  className={`wc-btn-test${isRec ? ' wc-shortcut-rec-active' : ''}`}
                  style={{ padding: '6px 12px', flex: 'none' }}
                  onClick={() => setRecording(isRec ? null : key)}
                  aria-pressed={isRec}>
                  {isRec ? '取消' : '录制'}
                </button>
                <button className="wc-btn-link" onClick={() => resetOne(key)} title="恢复默认">
                  重置
                </button>
              </div>
            </div>
            {st && (
              <div role="status" style={{ marginTop: 4, fontSize: 'var(--text-sm2)', paddingLeft: 2,
                color: st.ok ? 'var(--green)' : 'var(--color-badge)' }}>
                {st.msg}
              </div>
            )}
          </div>
        );
      })}
      <div className="wc-server-hint">
        <div className="wc-server-hint-box">
          快捷键在全局生效（即使 v信 窗口不在前台）。若保存后提示「被占用」，
          请先在系统或其它应用中解除该组合键的绑定后重试。
        </div>
      </div>
    </PageBg>
  );
}

/* ── 主页面 ── */
export default function Profile({ isMobile = false }) {
  const { user, updateUser, logout, accounts, login, switchAccount } = useAuth();
  const [subPage, setSubPage] = useState(null);

  /* ── 子页 ── */
  if (subPage === 'profile-detail') return <ProfileDetail user={user} updateUser={updateUser} onBack={() => setSubPage(null)} navigateTo={setSubPage} />;
  if (subPage === 'edit-name')     return <EditName user={user} updateUser={updateUser} onBack={() => setSubPage(null)} />;
  if (subPage === 'edit-bio')      return <EditBio user={user} updateUser={updateUser} onBack={() => setSubPage(null)} />;
  if (subPage === 'change-phone')  return <ChangePhone user={user} updateUser={updateUser} onBack={() => setSubPage(null)} />;
  if (subPage === 'change-password') return <ChangePassword onBack={() => setSubPage(null)} />;
  if (subPage === 'wallet')        return <Wallet onBack={() => setSubPage(null)} />;
  if (subPage === 'invite')        return <InviteFriends onBack={() => setSubPage(null)} />;
  if (subPage === 'devices')       return <DeviceList onBack={() => setSubPage(null)} />;
  if (subPage === 'appearance')    return <AppearanceSettings onBack={() => setSubPage(null)} />;
  if (subPage === 'notifications') return <NotificationSettings onBack={() => setSubPage(null)} />;
  if (subPage === 'privacy')       return <PrivacySettings user={user} onBack={() => setSubPage(null)} />;
  if (subPage === 'server')        return <ServerSettings onBack={() => setSubPage(null)} />;
  if (subPage === 'shortcuts')     return <ShortcutSettings onBack={() => setSubPage(null)} />;
  if (subPage === 'general')       return <GeneralSettings onBack={() => setSubPage(null)} />;

  // Web 桌面浏览器：两栏设置布局（左侧分类导航 + 右侧内容），对齐 Web设置页.jpg / Web个人资料页.jpg。
  // Electron 和移动端不受影响，继续走下面原有的单栏卡片列表（对齐各自的参考图）。
  if (!window.__ELECTRON_CONFIG__ && !isMobile) {
    return <WebSettingsShell user={user} updateUser={updateUser} navigateTo={setSubPage} logout={logout} />;
  }

  return (
    <PageBg>
      {/* ── 个人信息头部 ── */}
      <div className="wc-me-header" role="button" tabIndex={0} onClick={() => setSubPage('profile-detail')} onKeyDown={activateOnKey(() => setSubPage('profile-detail'))}>
        <div className="wc-me-avatar-wrap">
          <Avatar src={user?.avatar} name={user?.username} size={64} />
        </div>
        <div className="wc-me-info">
          <div className="wc-me-name">{user?.username || '未设置昵称'}</div>
          {user?.wechat_id && <div className="wc-me-vid">v信号：{user.wechat_id}</div>}
          {user?.bio && <div className="wc-me-bio">{user.bio}</div>}
        </div>
        <div className="wc-me-actions">
          <ChevronRight />
        </div>
      </div>

      {/* ── 钱包 ── */}
      <div className="wc-section-pad">
        <Card>
          <CRow icon={<Ico d="M21 7H3a1 1 0 00-1 1v9a2 2 0 002 2h14a2 2 0 002-2v-2h-7a2 2 0 010-4h7V8a1 1 0 00-1-1zm-4 6h5v2h-5a1 1 0 010-2zM3 5h13a1 1 0 010 2H3a1 1 0 010-2z" />}
            bg="var(--icon-bg-wallet)" label="钱包" desc="金币余额与交易记录" onClick={() => setSubPage('wallet')} />
          <CRow icon={<Ico d="M16 11a4 4 0 10-4-4 4 4 0 004 4zm0 2c-3 0-8 1.5-8 4.5V20h12v-1a5.8 5.8 0 00-.3-1.8M6 8V5M4.5 6.5h3" />}
            bg="var(--icon-bg-invite)" label="邀请好友" desc="我的专属邀请码与邀请战绩" onClick={() => setSubPage('invite')} />
        </Card>
      </div>

      {/* ── 通用 ── */}
      <SLabel>通用</SLabel>
      <div className="wc-section-pad">
        <Card>
          <CRow icon={<IcoDesktop />} bg="var(--icon-bg-neutral)" label="通用设置" desc="开机启动、缓存、版本信息" onClick={() => setSubPage('general')} />
        </Card>
      </div>

      {/* ── 设备与安全 ── */}
      <SLabel>设备与安全</SLabel>
      <div className="wc-section-pad">
        <Card>
          <CRow icon={<IcoDesktop />} bg="var(--icon-bg-neutral)" label="设备管理" desc="查看同时登录的设备" onClick={() => setSubPage('devices')} />
          <CRow icon={<IcoShield />}  bg="var(--icon-bg-neutral)" label="隐私与安全" desc="添加方式和好友权限" onClick={() => setSubPage('privacy')} />
        </Card>
      </div>

      {/* ── 偏好设置 ── */}
      <SLabel>偏好设置</SLabel>
      <div className="wc-section-pad">
        <Card>
          <CRow icon={<IcoMoon />} bg="var(--icon-bg-neutral)" label="外观"  desc="日间和夜间模式"   onClick={() => setSubPage('appearance')} />
          <CRow icon={<IcoBell />} bg="var(--icon-bg-neutral)" label="通知"  desc="锁屏通知和声音"   onClick={() => setSubPage('notifications')} />
        </Card>
      </div>

      {/* ── 服务器（仅桌面端） ── */}
      {window.__ELECTRON_CONFIG__ && (
        <>
          <SLabel>连接</SLabel>
          <div className="wc-section-pad">
            <Card>
              <CRow icon={<IcoServer />} bg="var(--icon-bg-neutral)" label="服务器地址"
                desc={(localStorage.getItem('vxin_server_url') || '').replace(/^https?:\/\//, '') || '远程配置'}
                onClick={() => setSubPage('server')} />
            </Card>
          </div>
        </>
      )}

      {/* ── 快捷键（仅桌面端） ── */}
      {window.__ELECTRON_CONFIG__ && (
        <>
          <SLabel>快捷键</SLabel>
          <div className="wc-section-pad">
            <Card>
              <CRow icon={<IcoKeyboard />} bg="var(--icon-bg-neutral)" label="快捷键设置"
                desc="自定义截图等快捷键"
                onClick={() => setSubPage('shortcuts')} />
            </Card>
          </div>
        </>
      )}
      {/* 账号管理/切换账号：此前只在移动端显示，桌面端的等价功能挂在侧栏底部的
          独立头像按钮上（与主导航「设置」在同一根导航上并列，读起来像两个入口
          做同一件事）。现在统一收进设置页——桌面端不再需要侧栏那个按钮。 */}
      {(isMobile || window.__ELECTRON_CONFIG__) && (
        <>
          <SLabel>账号管理</SLabel>
          <div className="wc-section-pad">
            <AccountSwitcher user={user} accounts={accounts} login={login} switchAccount={switchAccount} />
          </div>
        </>
      )}

      {/* ── 退出 ── */}
      <div className="wc-logout-div">
        <button className="wc-logout-btn" onClick={() => doLogout(logout)}>退出登录</button>
      </div>

      {/* ── 版本号：桌面端显示应用版本，网页端显示 web 构建版本 ── */}
      <div style={{ textAlign: 'center', padding: '16px 0 24px', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
        v信 v{window.__ELECTRON_CONFIG__?.appVersion || __APP_VERSION__}
      </div>
    </PageBg>
  );
}
