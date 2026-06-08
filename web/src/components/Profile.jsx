import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

/* ─── tiny helpers ─── */
const ChevronRight = () => (
  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'var(--text-tertiary)', flexShrink: 0 }}>
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
  </svg>
);

function Toggle({ checked, onChange }) {
  return (
    <button type="button" className={`wc-switch${checked ? ' on' : ''}`}
      onClick={(e) => { e.stopPropagation(); onChange?.(!checked); }} aria-pressed={checked}>
      <span />
    </button>
  );
}

/* 普通行（无图标） */
function Row({ label, value, onClick, right, danger, desc }) {
  return (
    <div className="wc-settings-row wc-settings-entry" onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ flex: 1 }}>
        <span className="wc-settings-label" style={danger ? { color: '#FA5151' } : null}>{label}</span>
        {desc && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3, lineHeight: 1.4 }}>{desc}</div>}
      </div>
      {value != null && <span style={{ color: 'var(--text-tertiary)', fontSize: 13, marginRight: onClick ? 6 : 0 }}>{value}</span>}
      {right || (onClick ? <ChevronRight /> : null)}
    </div>
  );
}

/* 带彩色图标的行 */
function IconRow({ bg, icon, label, value, desc, onClick, right }) {
  return (
    <div className="wc-settings-row wc-settings-entry" onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,.15)' }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span className="wc-settings-label">{label}</span>
        {desc && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.35 }}>{desc}</div>}
      </div>
      {value != null && <span style={{ color: 'var(--text-tertiary)', fontSize: 13, marginRight: onClick ? 6 : 0, flexShrink: 0 }}>{value}</span>}
      {right || (onClick ? <ChevronRight /> : null)}
    </div>
  );
}

const Section = ({ children, style }) => (
  <div className="wc-settings-block wc-settings-glass-block" style={style}>{children}</div>
);

const SectionTitle = ({ children }) => (
  <div style={{ padding: '16px 16px 4px', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: .4 }}>
    {children}
  </div>
);

function SubHeader({ title, onBack }) {
  return (
    <div className="wc-sub-header">
      <button style={{ color: '#07C160', fontSize: 15, padding: '4px 0' }} onClick={onBack}>‹ 返回</button>
      <span className="wc-sub-header-title">{title}</span>
      <div style={{ width: 44 }} />
    </div>
  );
}

/* ─── SVG icons ─── */
const Ico = ({ d }) => <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, fill: '#fff' }}><path d={d}/></svg>;
const IcoUser   = () => <Ico d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>;
const IcoID     = () => <Ico d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h12v2H6zm0-4h6v2H6zm0 8h9v2H6z"/>;
const IcoPhone  = () => <Ico d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>;
const IcoDesktop= () => <Ico d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zm-8-1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm8-3H4V6h16v8z"/>;
const IcoMoon   = () => <Ico d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>;
const IcoBell   = () => <Ico d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>;
const IcoShield = () => <Ico d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>;
const IcoGear   = () => <Ico d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>;

/* ── 账号切换栏 ── */
function AccountBar() {
  const { user, accounts, login, switchAccount } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const phoneRef = useRef(null);

  const doSwitch = (id) => {
    if (id === user?.id) return;
    if (switchAccount(id)) window.location.reload();
  };

  const doAdd = async (e) => {
    e.preventDefault();
    if (!form.phone || !form.password) { setError('请填写手机号和密码'); return; }
    setError(''); setLoading(true);
    try {
      const { data } = await axios.post('/api/auth/login', form);
      login(data.token, data.user);
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

  return (
    <div style={{ margin: '0 12px', borderRadius: 14, overflow: 'hidden' }} className="wc-settings-glass-block">
      {accounts.map((a, i) => {
        const active = a.id === user?.id;
        return (
          <div key={a.id} onClick={() => doSwitch(a.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', cursor: active ? 'default' : 'pointer', borderTop: i === 0 ? 'none' : '1px solid var(--border-color)', transition: 'background .12s' }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-search)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Avatar src={a.user?.avatar} name={a.user?.username} size={40} />
              {active && (
                <div style={{ position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderRadius: '50%', background: '#07C160', border: '2px solid var(--glass-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" style={{ width: 8, height: 8, fill: '#fff' }}><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: active ? 500 : 400, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.user?.username || '未命名'}
              </div>
              {a.user?.phone && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{a.user.phone}</div>}
            </div>
            {active
              ? <span style={{ fontSize: 12, color: '#07C160', background: 'rgba(7,193,96,.1)', padding: '3px 8px', borderRadius: 99, flexShrink: 0 }}>当前</span>
              : <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>切换</span>
            }
          </div>
        );
      })}

      {/* 添加账户行 */}
      <div onClick={toggleForm}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', cursor: 'pointer', borderTop: accounts.length ? '1px solid var(--border-color)' : 'none', transition: 'background .12s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-search)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: `1.5px dashed ${showForm ? '#07C160' : 'var(--text-tertiary)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'border-color .15s' }}>
          <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: showForm ? '#07C160' : 'var(--text-tertiary)', transition: 'fill .15s' }}>
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </div>
        <span style={{ flex: 1, fontSize: 14, color: showForm ? '#07C160' : 'var(--text-primary)', transition: 'color .15s' }}>添加账户</span>
        <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'var(--text-tertiary)', transform: showForm ? 'rotate(90deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}>
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
      </div>

      {showForm && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ margin: '10px 0', padding: '8px 10px', background: 'rgba(7,193,96,.08)', borderRadius: 8, border: '1px solid rgba(7,193,96,.18)' }}>
            <span style={{ fontSize: 12, color: '#07C160', lineHeight: 1.5 }}>添加后旧账号不会退出，可随时切换</span>
          </div>
          <form onSubmit={doAdd} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input ref={phoneRef} type="tel" placeholder="手机号" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              style={{ padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border-color)', fontSize: 14, background: 'var(--bg-search)', color: 'var(--text-primary)', outline: 'none', transition: 'border-color .15s' }}
              onFocus={e => e.target.style.borderColor = '#07C160'}
              onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
            <input type="password" placeholder="密码" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              style={{ padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border-color)', fontSize: 14, background: 'var(--bg-search)', color: 'var(--text-primary)', outline: 'none', transition: 'border-color .15s' }}
              onFocus={e => e.target.style.borderColor = '#07C160'}
              onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
            {error && (
              <div style={{ padding: '6px 10px', background: 'rgba(250,81,81,.08)', borderRadius: 7, border: '1px solid rgba(250,81,81,.2)', color: '#FA5151', fontSize: 12 }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              style={{ padding: '12px 0', background: loading ? 'rgba(7,193,96,.6)' : '#07C160', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 600, letterSpacing: .3 }}>
              {loading ? '登录中...' : '登录并切换'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/* ── 修改昵称 ── */
function EditName({ user, updateUser, onBack }) {
  const [username, setUsername] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!username.trim()) return;
    setSaving(true);
    try {
      const { data } = await axios.put('/api/users/profile', { username });
      updateUser(data); onBack();
    } finally { setSaving(false); }
  };
  return (
    <div className="wc-settings">
      <SubHeader title="修改昵称" onBack={onBack} />
      <div style={{ padding: '12px 16px' }}>
        <Section>
          <div className="wc-settings-row" style={{ gap: 12 }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)', width: 60, flexShrink: 0 }}>昵称</span>
            <input value={username} onChange={e => setUsername(e.target.value)}
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: 'var(--text-primary)', textAlign: 'right', outline: 'none' }} autoFocus />
          </div>
        </Section>
        <button style={{ width: '100%', marginTop: 14, padding: '13px 0', background: '#07C160', color: '#fff', borderRadius: 12, fontSize: 15, fontWeight: 600, letterSpacing: .3 }}
          onClick={save} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
      </div>
    </div>
  );
}

/* ── 设备列表 ── */
function DeviceList({ onBack }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/auth/sessions').then(({ data }) => setSessions(data)).catch(() => setSessions([])).finally(() => setLoading(false));
  }, []);

  const removeSession = async (id) => {
    await axios.delete(`/api/auth/sessions/${id}`).catch(() => {});
    setSessions(s => s.filter(x => x.id !== id));
  };

  const icon = (p = '') => {
    const pl = p.toLowerCase();
    if (pl.includes('windows')) return '🖥️';
    if (pl.includes('mac')) return '💻';
    if (pl.includes('iphone') || pl.includes('ipad') || pl.includes('android')) return '📱';
    return '🌐';
  };

  return (
    <div className="wc-settings">
      <SubHeader title="设备" onBack={onBack} />
      <div style={{ paddingTop: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 14 }}>加载中...</div>
        ) : (
          <Section>
            {sessions.length === 0
              ? <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>暂无设备记录</div>
              : sessions.map(s => (
                <div key={s.id} className="wc-settings-row" style={{ gap: 12, alignItems: 'center', padding: '12px 14px' }}>
                  <span style={{ fontSize: 26, flexShrink: 0, lineHeight: 1 }}>{icon(s.platform)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{s.device || '未知设备'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
                      {s.ip ? `${s.ip} · ` : ''}{s.current ? '当前设备' : `最近活跃 ${new Date(s.last_seen * 1000).toLocaleDateString('zh-CN')}`}
                    </div>
                  </div>
                  {s.current
                    ? <span style={{ fontSize: 12, color: '#07C160', flexShrink: 0, background: 'rgba(7,193,96,.1)', padding: '3px 8px', borderRadius: 99 }}>当前</span>
                    : <button style={{ fontSize: 12, color: '#FA5151', flexShrink: 0, background: 'rgba(250,81,81,.08)', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(250,81,81,.2)' }} onClick={() => removeSession(s.id)}>退出</button>
                  }
                </div>
              ))
            }
          </Section>
        )}
        <div style={{ padding: '4px 16px 8px', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          在此管理同时登录的设备，点击"退出"可远程下线该设备。
        </div>
      </div>
    </div>
  );
}

/* ── 外观 ── */
function AppearanceSettings({ onBack }) {
  const { darkMode, setDarkMode } = useSettings();
  return (
    <div className="wc-settings">
      <SubHeader title="外观" onBack={onBack} />
      <div style={{ paddingTop: 12 }}>
        <div style={{ padding: '4px 12px 12px', display: 'flex', gap: 12 }}>
          {[
            { label: '日间模式', dark: false, emoji: '☀️', bg: '#FFFFFF', border: '#E5E5EA', textColor: '#333' },
            { label: '夜间模式', dark: true, emoji: '🌙', bg: '#1C1C1E', border: '#48484A', textColor: '#EBEBF5' },
          ].map(({ label, dark, emoji, bg, border, textColor }) => (
            <button key={label} type="button"
              style={{ flex: 1, height: 100, borderRadius: 16, background: bg, border: `2.5px solid ${darkMode === dark ? '#07C160' : border}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'border-color .2s, box-shadow .2s', boxShadow: darkMode === dark ? '0 0 0 3px rgba(7,193,96,.15)' : 'none' }}
              onClick={() => setDarkMode(dark)}>
              <span style={{ fontSize: 30 }}>{emoji}</span>
              <span style={{ fontSize: 13, color: textColor, fontWeight: darkMode === dark ? 600 : 400 }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 通知 ── */
function NotificationSettings({ onBack }) {
  const { notifySound, setNotifySound } = useSettings();
  const [lockScreen, setLockScreen] = useState(localStorage.getItem('wc_lock_screen') !== '0');
  const [preview, setPreview] = useState(localStorage.getItem('wc_notify_preview') !== '0');
  const setLS = (key, val) => { localStorage.setItem(key, val ? '1' : '0'); };
  return (
    <div className="wc-settings">
      <SubHeader title="通知" onBack={onBack} />
      <div style={{ paddingTop: 12 }}>
        <Section>
          <Row label="锁屏通知" desc="手机锁屏时显示消息通知"
            right={<Toggle checked={lockScreen} onChange={v => { setLockScreen(v); setLS('wc_lock_screen', v); }} />} />
          <Row label="消息详情预览" desc={'关闭后通知只显示"收到新消息"'}
            right={<Toggle checked={preview} onChange={v => { setPreview(v); setLS('wc_notify_preview', v); }} />} />
          <Row label="通知声音"
            right={<Toggle checked={notifySound} onChange={setNotifySound} />} />
        </Section>
      </div>
    </div>
  );
}

/* ── 隐私与安全 ── */
function PrivacySettings({ user, onBack }) {
  const [page, setPage] = useState('main');
  const [settings, setSettings] = useState({
    addByVxinId: true, addByPhone: true, addByQRCode: true, addByUsername: true, requireVerify: true,
  });

  useEffect(() => {
    axios.get('/api/users/me/settings').then(({ data }) => setSettings(s => ({ ...s, ...data }))).catch(() => {});
  }, []);

  const setFlag = async (key, value) => {
    const prev = settings[key];
    setSettings(s => ({ ...s, [key]: value }));
    try { const { data } = await axios.put('/api/users/me/settings', { [key]: value }); setSettings(s => ({ ...s, ...data })); }
    catch { setSettings(s => ({ ...s, [key]: prev })); }
  };

  if (page === 'add-methods') return (
    <div className="wc-settings">
      <div className="wc-sub-header">
        <button style={{ color: '#07C160', fontSize: 15, padding: '4px 0' }} onClick={() => setPage('main')}>‹ 返回</button>
        <span className="wc-sub-header-title">添加我的方式</span>
        <div style={{ width: 44 }} />
      </div>
      <div style={{ paddingTop: 8 }}>
        <div style={{ padding: '8px 16px 4px', fontSize: 12, color: 'var(--text-tertiary)' }}>
          允许他人通过以下方式添加我
        </div>
        <Section>
          <Row label="ID号" desc={user?.wechat_id ? `v信ID: ${user.wechat_id}` : '未分配'}
            right={<Toggle checked={settings.addByVxinId} onChange={v => setFlag('addByVxinId', v)} />} />
          <Row label="手机号" desc={user?.phone || ''}
            right={<Toggle checked={settings.addByPhone} onChange={v => setFlag('addByPhone', v)} />} />
          <Row label="二维码"
            right={<Toggle checked={settings.addByQRCode} onChange={v => setSettings(s => ({ ...s, addByQRCode: v }))} />} />
          <Row label="用户名"
            right={<Toggle checked={settings.addByUsername} onChange={v => setSettings(s => ({ ...s, addByUsername: v }))} />} />
        </Section>
      </div>
    </div>
  );

  return (
    <div className="wc-settings">
      <SubHeader title="隐私与安全" onBack={onBack} />
      <div style={{ paddingTop: 12 }}>
        <Section>
          <Row label="添加我的方式" desc="ID号、手机号、二维码、用户名" onClick={() => setPage('add-methods')} />
          <Row label="需要验证才能添加好友" desc="关闭后对方可直接添加你"
            right={<Toggle checked={settings.requireVerify} onChange={v => setFlag('requireVerify', v)} />} />
        </Section>
      </div>
    </div>
  );
}

/* ── 设置页（二级） ── */
function SettingsPage({ user, setSubPage, logout }) {
  return (
    <div className="wc-settings" style={{ overflowY: 'auto', height: '100%' }}>
      <SubHeader title="设置" onBack={() => setSubPage(null)} />
      <div style={{ paddingBottom: 32 }}>

        <SectionTitle>账号信息</SectionTitle>
        <Section>
          <IconRow bg="#07C160" icon={<IcoUser />}  label="昵称"   value={user?.username}           onClick={() => setSubPage('edit-name')} />
          <IconRow bg="#3A84D8" icon={<IcoID />}    label="ID号"   value={user?.wechat_id || '未分配'} />
          <IconRow bg="#FF9500" icon={<IcoPhone />} label="手机号" value={user?.phone || '-'} />
        </Section>

        <SectionTitle>设备与安全</SectionTitle>
        <Section>
          <IconRow bg="#AF52DE" icon={<IcoDesktop />} label="设备"     desc="查看同时登录的设备"   onClick={() => setSubPage('devices')} />
          <IconRow bg="#636366" icon={<IcoShield />}  label="隐私与安全" desc="添加方式和好友权限" onClick={() => setSubPage('privacy')} />
        </Section>

        <SectionTitle>偏好设置</SectionTitle>
        <Section>
          <IconRow bg="#5856D6" icon={<IcoMoon />} label="外观" desc="日间和夜间模式" onClick={() => setSubPage('appearance')} />
          <IconRow bg="#FF3B30" icon={<IcoBell />} label="通知" desc="锁屏通知和声音" onClick={() => setSubPage('notifications')} />
        </Section>

        <div style={{ margin: '4px 12px 0' }}>
          <button
            style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: 'var(--glass-bg)', color: '#FA5151', fontSize: 15, fontWeight: 500, border: '1px solid var(--glass-border)', backdropFilter: 'blur(26px)', WebkitBackdropFilter: 'blur(26px)', letterSpacing: .2, transition: 'opacity .15s' }}
            onClick={() => { logout(); window.location.href = '/login'; }}
            onMouseEnter={e => e.currentTarget.style.opacity = '.75'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 主页面 ── */
export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const [subPage, setSubPage] = useState(null);
  const fileRef = useRef(null);

  const uploadAvatar = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('avatar', file);
    const { data } = await axios.post('/api/users/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    updateUser({ avatar: data.avatar });
    e.target.value = '';
  };

  /* 三级页面：从设置里进入的子页，返回回到设置 */
  if (subPage === 'edit-name')     return <EditName user={user} updateUser={updateUser} onBack={() => setSubPage('settings')} />;
  if (subPage === 'devices')       return <DeviceList onBack={() => setSubPage('settings')} />;
  if (subPage === 'appearance')    return <AppearanceSettings onBack={() => setSubPage('settings')} />;
  if (subPage === 'notifications') return <NotificationSettings onBack={() => setSubPage('settings')} />;
  if (subPage === 'privacy')       return <PrivacySettings user={user} onBack={() => setSubPage('settings')} />;

  /* 二级：设置总览页 */
  if (subPage === 'settings') return <SettingsPage user={user} setSubPage={setSubPage} logout={logout} />;

  /* 一级：我的主页 */
  return (
    <div className="wc-settings" style={{ overflowY: 'auto', height: '100%' }}>

      {/* 当前账号头像 */}
      <div style={{ padding: '24px 16px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
          <Avatar src={user?.avatar} name={user?.username} size={72} />
          <div style={{ position: 'absolute', bottom: 0, right: -2, width: 22, height: 22, borderRadius: '50%', background: '#07C160', border: '2.5px solid var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: '#fff' }}>
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
        </div>
        <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: -.2 }}>{user?.username}</div>
        {user?.wechat_id && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', letterSpacing: .3 }}>ID: {user.wechat_id}</div>
        )}
      </div>

      <div style={{ paddingBottom: 32 }}>
        <Section>
          <IconRow bg="#8E8E93" icon={<IcoGear />} label="设置" desc="账号信息、外观、隐私安全等" onClick={() => setSubPage('settings')} />
        </Section>
      </div>
    </div>
  );
}
