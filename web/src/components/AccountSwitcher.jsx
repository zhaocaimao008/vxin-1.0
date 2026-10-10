import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';
import Avatar from '../components/Avatar';
import { mediaUrl } from '../utils/url';
import { showConfirm } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { removeRememberedUsername } from '../utils/rememberedCreds';
import { loginPayloadForIdentifier, recentAccountIdentity, rememberSuccessfulLogin } from '../utils/loginIdentity';
import { IcoCheck, IcoChevronRight, IcoClose, IcoPlus, IcoUser } from './Icons';

function goLogin() {
  if (window.__ELECTRON_CONFIG__) { window.location.hash = '/login'; window.location.reload(); }
  else window.location.href = (import.meta.env.BASE_URL || '/') + 'login';
}

function AccountSwitcher() {
  const { user, accounts, login, switchAccount, removeAccount, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [switchTarget, setSwitchTarget] = useState(null); // 非空=正在切换到某个已登录账号(显示其昵称)
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [avatarErr, setAvatarErr] = useState(false); // 头像加载失败时回退字母，避免显示浏览器碎图
  const phoneRef = useRef(null);
  const passwordRef = useRef(null);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownLeft, setDropdownLeft] = useState(72);
  const toggleDropdown = () => {
    const right = containerRef.current?.getBoundingClientRect().right || 64;
    setDropdownLeft(Math.max(8, Math.min(right + 8, window.innerWidth - 276)));
    setOpen(v => !v);
  };
  const letter = (user?.username || '?')[0].toUpperCase();
  // 头像地址变化即复位错误态：render 期派生（存上一次 avatar），避免 effect 内同步 setState
  const [prevAvatar, setPrevAvatar] = useState(user?.avatar);
  if (user?.avatar !== prevAvatar) { setPrevAvatar(user?.avatar); setAvatarErr(false); }

  /* 点外部关闭，不用全屏遮罩（遮罩会挡住头像按钮本身） */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 下拉关闭时复位表单：render 期派生（存上一次 open），避免 effect 内同步 setState
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) { setShowForm(false); setErr(''); setForm({ identifier: '', password: '' }); setSwitchTarget(null); }
  }

  // 切换账号：优先丝滑切换（后端凭 wallet cookie 免密重签发）。
  // 仅当本设备没切换凭证（如缓存被清/换了浏览器/旧会话）才回退到密码登录。
  const [switching, setSwitching] = useState(false);
  const doSwitch = async (id) => {
    if (id === user?.id || switching) return;
    const acct = accounts.find(a => a.id === id);
    if (!acct) return;
    setErr(''); setSwitching(true);
    try {
      await switchAccount(id);   // 成功会 reload
    } catch {
      // 免密切换不可用 → 回退：只填入手机号，密码始终由用户输入。
      setSwitching(false);
      setSwitchTarget(acct.user || null);
      const { identifier } = recentAccountIdentity(acct);
      setForm({ identifier, password: '' });
      setShowForm(true);
      setTimeout(() => passwordRef.current?.focus(), 80);
    }
  };

  // 删除账号：当前账号→退出登录；其他账号→从本设备移除(最近登录+免密切换凭证)
  const doRemove = async (e, id) => {
    e.stopPropagation();
    const acct = accounts.find(a => a.id === id);
    const name = acct?.user?.username || '该账号';
    if (id === user?.id) {
      if (!(await showConfirm(`退出当前账号「${name}」？`))) return;
      await logout();                 // 清会话+CSRF+从钱包移除当前账号
      goLogin();
    } else {
      if (!(await showConfirm(`从本设备删除账号「${name}」？删除后切换需重新输密码。`))) return;
      removeRememberedUsername(recentAccountIdentity(acct).identifier);
      removeAccount(id);              // 移除最近登录记录 + 钱包凭证
    }
  };

  const doAdd = async (e) => {
    e.preventDefault();
    if (submitting) return; // 防连点/回车重复提交
    if (!form.identifier || !form.password) { setErr('请填写账号和密码'); return; }
    const payload = loginPayloadForIdentifier(form.identifier, form.password);
    if (!payload) { setErr('请输入 6 位 v信号或 11 位手机号'); return; }
    setErr(''); setSubmitting(true);
    try {
      const { data } = await axios.post('/api/auth/login', payload);
      // 只记住用户名，密码不写入本地存储。
      rememberSuccessfulLogin(payload.loginType || 'phone', form.identifier.trim(), true);
      login(data.user, data.token); // 必须传 token:Bearer端(Electron/移动)漏传会清掉鉴权头→reload后被登出
      window.location.reload();
    } catch (ex) {
      setErr(ex.response?.data?.error || '账号或密码错误');
      setSubmitting(false);
    }
  };

  const toggleForm = (e) => {
    e.stopPropagation();
    setShowForm(v => !v);
    setErr('');
    setSwitchTarget(null);   // 走"添加账户"入口，不是切换
    setForm({ identifier: '', password: '' });
    if (!showForm) setTimeout(() => phoneRef.current?.focus(), 80);
  };

  return (
    <div ref={containerRef} className="as-container">
      {/* 头像按钮 */}
      <div className="as-avatar-btn" data-testid="account-switcher" role="button" tabIndex={0} aria-label="账号切换" aria-expanded={open} onClick={toggleDropdown} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDropdown(); } }}>
        <div className={`as-avatar-inner${open ? ' as-avatar-inner-open' : ''}`}>
          {user?.avatar && !avatarErr
            ? <img src={mediaUrl(user.avatar)} alt="" loading="lazy" className="as-avatar-img" onError={() => setAvatarErr(true)} />
            : letter
          }
        </div>
      </div>

      {/* 下拉面板（fixed 定位，不受 sidebar overflow 影响） */}
      {open && createPortal(
        <div ref={dropdownRef} className="as-dropdown" style={{ left: dropdownLeft }}>

          {/* 账号列表 */}
          {accounts.map((a) => {
            const active = a.id === user?.id;
            return (
              <div key={a.id} onClick={() => { if (!active) doSwitch(a.id); }}
                className={`wc-account-row${active ? ' active' : ''}`}
                data-testid={`account-row-${a.id}`}
                role="button" tabIndex={0}
                onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !active) { e.preventDefault(); doSwitch(a.id); } }}>
                <div className="as-avatar-wrap">
                  <Avatar src={a.user?.avatar} name={a.user?.username} size={38} />
                  {active && (
                    <div className="as-active-badge">
                      <IcoCheck size={null} strokeWidth={3} className="as-check-icon" />
                    </div>
                  )}
                </div>
                <div className="as-name-wrap">
                  <div className={`as-name${active ? ' active' : ''}`}>
                    {a.user?.username || '未命名'}
                  </div>
                  <div className="as-phone">{recentAccountIdentity(a).mode === 'vxin' ? 'v信号' : '手机号'} {recentAccountIdentity(a).identifier}</div>
                </div>
                {active
                  ? <span className="as-current-badge">当前</span>
                  : <span className="as-switch-text">切换</span>
                }
                {/* 删除/退出账号 */}
                <button
                  onClick={(e) => doRemove(e, a.id)}
                  title={active ? '退出登录' : '从本设备删除'}
                  data-testid={active ? 'account-logout-btn' : undefined}
                  className="as-remove-btn">
                  <IcoClose size={13} />
                </button>
              </div>
            );
          })}

          {/* 个人资料卡片（置于添加账户之上，桌面端优先展示本人资料） */}
          <div onClick={() => setShowProfile(v => !v)}
            className="as-profile-row"
            role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowProfile(v => !v); } }}>
            <IcoUser size={null} className="as-profile-icon" />
            <span className="as-profile-label">个人资料</span>
            <IcoChevronRight size={null} className={`as-profile-arrow${showProfile ? ' open' : ''}`} />
          </div>

          {/* 资料详情（展开时显示） */}
          {showProfile && (
            <div className="as-profile-detail">
              {/* v信号 */}
              {user?.wechat_id && (
                <div className="as-profile-item">
                  <span className="as-profile-label-text">v信号</span>
                  <span className="as-profile-value">{user.wechat_id}</span>
                </div>
              )}
              {/* 手机号 */}
              {user?.phone && (
                <div className="as-profile-item">
                  <span className="as-profile-label-text">手机号</span>
                  <span className="as-profile-value">{user.phone}</span>
                </div>
              )}
            </div>
          )}

          {/* 添加账户行 */}
          <div onClick={toggleForm}
            className={`wc-add-row${showForm ? ' open' : ''}`}
            data-testid="account-add-row"
            role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleForm(e); } }}>
            <div className={`wc-add-icon-wrap${showForm ? ' open' : ''}`}>
              <IcoPlus size={null} className={`wc-add-icon-svg${showForm ? ' open' : ''}`} />
            </div>
            <span className={`wc-add-label${showForm ? ' open' : ''}`}>添加账户</span>
            <IcoChevronRight size={null} className={`wc-add-chevron${showForm ? ' open' : ''}`} />
          </div>

          {/* 登录表单：切换已有账号 或 添加新账号 */}
          {showForm && (
            <div className="as-form-pad">
              <div className="wc-add-info">
                <span className="wc-add-info-text">
                  {switchTarget
                    ? `切换到「${switchTarget.username || '该账号'}」，请输入密码`
                    : '添加后旧账号不会退出，可随时切换'}
                </span>
              </div>
              <form onSubmit={doAdd} className="wc-add-form-inner">
                <input ref={phoneRef} type="tel" placeholder="v信号或手机号" value={form.identifier}
                  readOnly={!!switchTarget}
                  onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))}
                  className="wc-add-form-input"
                  aria-label="v信号或手机号" data-testid="account-add-phone"
                />
                <input ref={passwordRef} type="password" placeholder="密码" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="wc-add-form-input"
                  aria-label="密码" data-testid="account-add-password" />
                {err && <div className="wc-add-form-error" role="alert">{err}</div>}
                <button type="submit" disabled={submitting}
                  className="wc-add-form-submit" data-testid="account-add-submit">
                  {submitting ? '登录中…' : (switchTarget ? '登录并切换' : '登录并添加')}
                </button>
              </form>
            </div>
          )}
        </div>, document.body
      )}
    </div>
  );
}

export default AccountSwitcher;
