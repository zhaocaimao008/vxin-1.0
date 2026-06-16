import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { goLogin } from '../utils/url';

/* ─── 小工具 ─── */
const ChevronRight = () => (
  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'var(--text-tertiary)', flexShrink: 0 }}>
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
  </svg>
);

function Toggle({ checked, onChange, disabled }) {
  return (
    <button type="button" className={`wc-switch${checked ? ' on' : ''}`}
      onClick={e => { e.stopPropagation(); if (!disabled) onChange?.(!checked); }}
      disabled={disabled}
      aria-pressed={checked}
      style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <span />
    </button>
  );
}

/* ─── SVG icons ─── */
const Ico = ({ d }) => <svg viewBox="0 0 24 24" style={{ width: 17, height: 17, fill: '#fff' }}><path d={d}/></svg>;
const IcoUser    = () => <Ico d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>;
const IcoID      = () => <Ico d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h12v2H6zm0-4h6v2H6zm0 8h9v2H6z"/>;
const IcoPhone   = () => <Ico d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>;
const IcoDesktop = () => <Ico d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zm-8-1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm8-3H4V6h16v8z"/>;
const IcoMoon    = () => <Ico d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>;
const IcoBell    = () => <Ico d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>;
const IcoShield  = () => <Ico d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>;
const IcoGear    = () => <Ico d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>;
const IcoServer  = () => <Ico d="M4 1h16a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1zm0 8h16a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4a1 1 0 011-1zm0 8h16a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4a1 1 0 011-1zM6 4a1 1 0 100 2 1 1 0 000-2zm0 8a1 1 0 100 2 1 1 0 000-2zm0 8a1 1 0 100 2 1 1 0 000-2z"/>;
const IcoEdit    = () => <Ico d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>;

/* ─── 通用 UI 零件 ─── */
function PageBg({ children }) {
  return <div style={{ overflowY: 'auto', height: '100%', background: 'var(--bg-panel)' }}>{children}</div>;
}

function PageHeader({ title, onBack, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 50,
      padding: '0 14px', flexShrink: 0,
      background: 'var(--bg-panel-header)',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <button onClick={onBack} style={{
        color: '#07C160', fontSize: 15, padding: '4px 0', minWidth: 44, textAlign: 'left',
      }}>‹ 返回</button>
      <span style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
      <div style={{ minWidth: 44, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  );
}

function SLabel({ children }) {
  return (
    <div style={{ padding: '16px 16px 6px', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: .5, textTransform: 'uppercase' }}>
      {children}
    </div>
  );
}

const CARD = {
  background: 'var(--bg-msg-other, #fff)',
  borderRadius: 14,
  border: '1px solid var(--border-color)',
  overflow: 'hidden',
  boxShadow: '0 1px 8px rgba(0,0,0,.06)',
};

function Card({ children, style }) {
  return <div style={{ ...CARD, ...style }}>{children}</div>;
}

function CRow({ icon, bg, label, value, desc, onClick, right, danger, last }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 14px',
      borderBottom: last ? 'none' : '1px solid var(--border-color)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'background .12s',
    }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'var(--bg-hover)'; }}
    onMouseLeave={e => { if (onClick) e.currentTarget.style.background = 'transparent'; }}>
      {icon && (
        <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 500, color: danger ? '#FA5151' : 'var(--text-primary)' }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}
      </div>
      {value != null && <span style={{ fontSize: 13.5, color: 'var(--text-tertiary)', flexShrink: 0, marginRight: onClick ? 6 : 0 }}>{value}</span>}
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
          <button onClick={save} disabled={saving} style={{ color: '#07C160', fontSize: 15, fontWeight: 600, opacity: saving ? .5 : 1 }}>
            {saving ? '保存中' : '保存'}
          </button>
        }
      />
      <div style={{ padding: '20px 14px' }}>
        <Card>
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && save()}
              maxLength={MAX}
              autoFocus
              placeholder="请输入昵称"
              style={{
                flex: 1, fontSize: 16, color: 'var(--text-primary)',
                border: 'none', background: 'transparent', outline: 'none',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>{username.length}/{MAX}</span>
          </div>
        </Card>
        {error && (
          <div style={{
            marginTop: 10, padding: '10px 14px',
            background: 'rgba(250,81,81,.08)', borderRadius: 10,
            border: '1px solid rgba(250,81,81,.2)', color: '#FA5151', fontSize: 13,
          }}>
            {error}
          </div>
        )}
        <div style={{ marginTop: 8, padding: '0 4px', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          昵称会对所有联系人显示
        </div>
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
    <PageBg>
      <PageHeader title="设备管理" onBack={onBack} />
      <div style={{ padding: '16px 14px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 14 }}>加载中...</div>
        ) : (
          <Card>
            {sessions.length === 0
              ? <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>暂无设备记录</div>
              : sessions.map((s, i) => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 14px',
                  borderBottom: i < sessions.length - 1 ? '1px solid var(--border-color)' : 'none',
                }}>
                  <span style={{ fontSize: 28, flexShrink: 0, lineHeight: 1 }}>{icon(s.platform)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--text-primary)' }}>{s.device || '未知设备'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 3 }}>
                      {s.ip ? `${s.ip} · ` : ''}
                      {s.current ? '当前设备' : `最近活跃 ${new Date(s.last_seen * 1000).toLocaleDateString('zh-CN')}`}
                    </div>
                  </div>
                  {s.current
                    ? <span style={{ fontSize: 12, color: '#07C160', background: 'rgba(7,193,96,.1)', padding: '3px 8px', borderRadius: 99, flexShrink: 0 }}>当前</span>
                    : <button style={{ fontSize: 12, color: '#FA5151', background: 'rgba(250,81,81,.08)', padding: '5px 11px', borderRadius: 8, border: '1px solid rgba(250,81,81,.2)', flexShrink: 0 }}
                        onClick={() => removeSession(s.id)}>退出</button>
                  }
                </div>
              ))
            }
          </Card>
        )}
        <div style={{ marginTop: 10, padding: '0 4px', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          点击"退出"可远程下线该设备
        </div>
      </div>
    </PageBg>
  );
}

/* ── 外观 ── */
function AppearanceSettings({ onBack }) {
  const { darkMode, setDarkMode } = useSettings();
  return (
    <PageBg>
      <PageHeader title="外观" onBack={onBack} />
      <div style={{ padding: '16px 14px' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: '日间模式', dark: false, emoji: '☀️', bg: '#FFFFFF', border: '#E5E5EA', textColor: '#333' },
            { label: '夜间模式', dark: true,  emoji: '🌙', bg: '#1C1C1E', border: '#48484A', textColor: '#EBEBF5' },
          ].map(({ label, dark, emoji, bg, border, textColor }) => (
            <button key={label} type="button"
              style={{
                flex: 1, height: 110, borderRadius: 16,
                background: bg, border: `2.5px solid ${darkMode === dark ? '#07C160' : border}`,
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'border-color .2s, box-shadow .2s',
                boxShadow: darkMode === dark ? '0 0 0 4px rgba(7,193,96,.15)' : '0 2px 8px rgba(0,0,0,.08)',
              }}
              onClick={() => setDarkMode(dark)}>
              <span style={{ fontSize: 34 }}>{emoji}</span>
              <span style={{ fontSize: 13.5, color: textColor, fontWeight: darkMode === dark ? 600 : 400 }}>{label}</span>
            </button>
          ))}
        </div>
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
  const [saving, setSaving]               = useState(false);
  const [loaded, setLoaded]               = useState(false);

  // 初始化：从后端读取用户设置
  useEffect(() => {
    axios.get('/api/users/me/settings').then(r => {
      const s = r.data || {};
      setMessageNotify(s.message_notify !== 0);
      setPreview(s.detail_preview !== 0);
      setVibrate(s.vibrate === 1);
      // 同步 localStorage（向后兼容老版本）
      localStorage.setItem('wc_lock_screen', s.message_notify !== 0 ? '1' : '0');
      localStorage.setItem('wc_notify_preview', s.detail_preview !== 0 ? '1' : '0');
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const saveSettings = async (key, value) => {
    setSaving(true);
    try {
      const payload = {
        [key]: value ? 1 : 0,
      };
      await axios.put('/api/users/me/settings', payload);
      localStorage.setItem(key === 'message_notify' ? 'wc_lock_screen' : 'wc_notify_preview', value ? '1' : '0');
    } catch {}
    setSaving(false);
  };

  if (!loaded) return <PageBg><PageHeader title="通知设置" onBack={onBack} /></PageBg>;

  return (
    <PageBg>
      <PageHeader title="通知设置" onBack={onBack} />
      <SLabel>消息通知</SLabel>
      <div style={{ padding: '0 14px' }}>
        <Card>
          <CRow label="锁屏通知" desc="关闭后不会收到消息推送"
            right={<Toggle checked={messageNotify} onChange={v => { setMessageNotify(v); saveSettings('message_notify', v); }} disabled={saving} />} />
          <CRow label="消息详情预览" desc={'关闭后通知只显示"收到新消息"'}
            right={<Toggle checked={preview} onChange={v => { setPreview(v); saveSettings('detail_preview', v); }} disabled={saving} />} />
          <CRow label="通知声音"
            right={<Toggle checked={notifySound} onChange={setNotifySound} />} />
          <CRow label="通知震动" last
            right={<Toggle checked={vibrate} onChange={v => { setVibrate(v); saveSettings('vibrate', v); }} disabled={saving} />} />
        </Card>
      </div>
    </PageBg>
  );
}

/* ── 隐私与安全 ── */
function PrivacySettings({ user, onBack }) {
  const [page, setPage] = useState('main');
  const [settings, setSettings] = useState({
    addByVxinId: true, addByPhone: true, addByQRCode: true, addByUsername: true, requireVerify: true,
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
      <div style={{ padding: '6px 14px 0' }}>
        <div style={{ padding: '10px 4px 6px', fontSize: 12, color: 'var(--text-tertiary)' }}>允许他人通过以下方式添加我</div>
        <Card>
          <CRow label="ID号" desc={user?.wechat_id ? `v信号: ${user.wechat_id}` : '未分配'}
            right={<Toggle checked={settings.addByVxinId} onChange={v => setFlag('addByVxinId', v)} />} />
          <CRow label="手机号" desc={user?.phone || ''}
            right={<Toggle checked={settings.addByPhone} onChange={v => setFlag('addByPhone', v)} />} />
          <CRow label="二维码"
            right={<Toggle checked={settings.addByQRCode} onChange={v => setSettings(s => ({ ...s, addByQRCode: v }))} />} />
          <CRow label="用户名" last
            right={<Toggle checked={settings.addByUsername} onChange={v => setSettings(s => ({ ...s, addByUsername: v }))} />} />
        </Card>
      </div>
    </PageBg>
  );

  return (
    <PageBg>
      <PageHeader title="隐私与安全" onBack={onBack} />
      <div style={{ padding: '6px 14px 0' }}>
        <Card style={{ marginTop: 10 }}>
          <CRow label="添加我的方式" desc="ID号、手机号、二维码、用户名" onClick={() => setPage('add-methods')} />
          <CRow label="需要验证才能添加好友" desc="关闭后对方可直接添加你" last
            right={<Toggle checked={settings.requireVerify} onChange={v => setFlag('requireVerify', v)} />} />
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
      login(data.user);
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
          <div key={a.id} onClick={() => doSwitch(a.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              cursor: 'pointer',
              borderBottom: '1px solid var(--border-color)',
              transition: 'background .12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Avatar src={a.user?.avatar} name={a.user?.username} size={40} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.user?.username || '未命名'}
              </div>
              {a.user?.phone && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{a.user.phone}</div>}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>切换</span>
          </div>
      ))}

      <div onClick={toggleForm}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', transition: 'background .12s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
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
              style={{ padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border-color)', fontSize: 14, background: 'var(--bg-search)', color: 'var(--text-primary)', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#07C160'}
              onBlur={e => e.target.style.borderColor = 'var(--border-color)'} />
            <input type="password" placeholder="密码" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              style={{ padding: '11px 14px', borderRadius: 10, border: '1px solid var(--border-color)', fontSize: 14, background: 'var(--bg-search)', color: 'var(--text-primary)', outline: 'none' }}
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
    </Card>
  );
}

async function doLogout(logout) {
  try {
    const reg = await navigator.serviceWorker?.ready;
    const sub = await reg?.pushManager?.getSubscription();
    if (sub) {
      await axios.delete('/api/notifications/web-subscribe', { data: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch {}
  logout();
  goLogin();
}

/* ── 设置总览页（二级） ── */
function ServerSettings({ onBack }) {
  const { changeServer } = useAuth();
  const currentUrl = localStorage.getItem('vxin_server_url') || window.__ELECTRON_CONFIG__?.serverUrl || 'https://dipsin.com';
  const [input, setInput] = useState(currentUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const testConn = async () => {
    const url = input.trim().replace(/\/$/, '');
    if (!url.startsWith('http')) { setTestResult({ ok: false, msg: '格式错误，请以 http:// 或 https:// 开头' }); return; }
    setTesting(true); setTestResult(null);
    try {
      await fetch(`${url}/health`, { signal: AbortSignal.timeout(6000) });
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
      <div style={{ padding: '20px 14px 0' }}>
        <div style={{ marginBottom: 6, fontSize: 12, color: 'var(--text-secondary)' }}>服务器地址（支持 IP 或域名）</div>
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setTestResult(null); }}
          placeholder="https://example.com"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '12px 14px',
            fontSize: 14, background: 'var(--bg-search)',
            border: '1.5px solid var(--border-color)', borderRadius: 10,
            color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
          }}
        />
        {testResult && (
          <div style={{ marginTop: 8, fontSize: 13, color: testResult.ok ? '#07C160' : '#FA5151' }}>
            {testResult.msg}
          </div>
        )}
      </div>
      <div style={{ padding: '12px 14px 0', display: 'flex', gap: 10 }}>
        <button onClick={testConn} disabled={testing} style={{
          flex: 1, padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 500,
          cursor: 'pointer', background: 'var(--bg-search)',
          border: '1px solid var(--border-color)', color: 'var(--text-primary)',
        }}>
          {testing ? '检测中...' : '测试连接'}
        </button>
        <button onClick={handleSave} disabled={saving || !input.trim().startsWith('http')} style={{
          flex: 1, padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 600,
          cursor: 'pointer', background: saving ? '#ccc' : '#07C160', border: 'none', color: '#fff',
        }}>
          {saving ? '切换中...' : '保存并切换'}
        </button>
      </div>
      <div style={{ padding: '10px 14px' }}>
        <button onClick={() => setInput('https://dipsin.com')} style={{
          background: 'none', border: 'none', color: '#07C160', fontSize: 13, cursor: 'pointer', padding: 0,
        }}>恢复默认 (dipsin.com)</button>
      </div>
      <div style={{ padding: '0 14px 20px' }}>
        <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,.04)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          切换服务器后当前账号会自动退出，用新服务器的账号重新登录即可，无需重装客户端。
        </div>
      </div>
    </PageBg>
  );
}

function SettingsPage({ user, setSubPage, logout }) {
  return (
    <PageBg>
      <PageHeader title="设置" onBack={() => setSubPage(null)} />

      {/* 设备与安全 */}
      <SLabel>设备与安全</SLabel>
      <div style={{ padding: '0 14px' }}>
        <Card>
          <CRow icon={<IcoDesktop />} bg="#AF52DE" label="设备管理" desc="查看同时登录的设备" onClick={() => setSubPage('devices')} />
          <CRow icon={<IcoShield />} bg="#636366" label="隐私与安全" desc="添加方式和好友权限" onClick={() => setSubPage('privacy')} last />
        </Card>
      </div>

      {/* 偏好设置 */}
      <SLabel>偏好设置</SLabel>
      <div style={{ padding: '0 14px' }}>
        <Card>
          <CRow icon={<IcoMoon />} bg="#5856D6" label="外观" desc="日间和夜间模式" onClick={() => setSubPage('appearance')} />
          <CRow icon={<IcoBell />} bg="#FF3B30" label="通知" desc="锁屏通知和声音" onClick={() => setSubPage('notifications')} last />
        </Card>
      </div>

      {/* 服务器 — 仅桌面端 */}
      {window.__ELECTRON_CONFIG__ && (
        <>
          <SLabel>连接</SLabel>
          <div style={{ padding: '0 14px' }}>
            <Card>
              <CRow icon={<IcoServer />} bg="#34C759" label="服务器地址"
                desc={(localStorage.getItem('vxin_server_url') || window.__ELECTRON_CONFIG__?.serverUrl || '').replace(/^https?:\/\//, '')}
                onClick={() => setSubPage('server')} last />
            </Card>
          </div>
        </>
      )}

      {/* 退出 */}
      <div style={{ padding: '20px 14px 32px' }}>
        <button
          style={{
            width: '100%', padding: '15px 0', borderRadius: 14,
            background: 'var(--bg-msg-other, #fff)', color: '#FA5151', fontSize: 15, fontWeight: 500,
            border: '1px solid rgba(250,81,81,.2)',
            boxShadow: '0 1px 8px rgba(0,0,0,.06)',
            cursor: 'pointer', transition: 'opacity .15s',
          }}
          onClick={() => doLogout(logout)}
          onMouseEnter={e => e.currentTarget.style.opacity = '.7'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          退出登录
        </button>
      </div>
    </PageBg>
  );
}

/* ── 主页面 ── */
export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const [subPage, setSubPage] = useState(null);

  /* ── 子页 ── */
  if (subPage === 'edit-name')     return <EditName user={user} updateUser={updateUser} onBack={() => setSubPage(null)} />;
  if (subPage === 'devices')       return <DeviceList onBack={() => setSubPage(null)} />;
  if (subPage === 'appearance')    return <AppearanceSettings onBack={() => setSubPage(null)} />;
  if (subPage === 'notifications') return <NotificationSettings onBack={() => setSubPage(null)} />;
  if (subPage === 'privacy')       return <PrivacySettings user={user} onBack={() => setSubPage(null)} />;
  if (subPage === 'server')        return <ServerSettings onBack={() => setSubPage(null)} />;

  /* ── 默认：直接显示设置内容 ── */
  return (
    <PageBg>
      <SLabel>设备与安全</SLabel>
      <div style={{ padding: '0 14px' }}>
        <Card>
          <CRow icon={<IcoDesktop />} bg="#AF52DE" label="设备管理" desc="查看同时登录的设备" onClick={() => setSubPage('devices')} />
          <CRow icon={<IcoShield />}  bg="#636366" label="隐私与安全" desc="添加方式和好友权限" onClick={() => setSubPage('privacy')} last />
        </Card>
      </div>

      <SLabel>偏好设置</SLabel>
      <div style={{ padding: '0 14px' }}>
        <Card>
          <CRow icon={<IcoMoon />} bg="#5856D6" label="外观"  desc="日间和夜间模式"   onClick={() => setSubPage('appearance')} />
          <CRow icon={<IcoBell />} bg="#FF3B30" label="通知"  desc="锁屏通知和声音"   onClick={() => setSubPage('notifications')} last />
        </Card>
      </div>

      {window.__ELECTRON_CONFIG__ && (
        <>
          <SLabel>连接</SLabel>
          <div style={{ padding: '0 14px' }}>
            <Card>
              <CRow icon={<IcoServer />} bg="#34C759" label="服务器地址"
                desc={(localStorage.getItem('vxin_server_url') || window.__ELECTRON_CONFIG__?.serverUrl || '').replace(/^https?:\/\//, '')}
                onClick={() => setSubPage('server')} last />
            </Card>
          </div>
        </>
      )}

      <div style={{ padding: '20px 14px 32px' }}>
        <button
          style={{
            width: '100%', padding: '15px 0', borderRadius: 14,
            background: 'var(--bg-msg-other, #fff)', color: '#FA5151', fontSize: 15, fontWeight: 500,
            border: '1px solid rgba(250,81,81,.2)',
            boxShadow: '0 1px 8px rgba(0,0,0,.06)',
            cursor: 'pointer', transition: 'opacity .15s',
          }}
          onClick={() => doLogout(logout)}
          onMouseEnter={e => e.currentTarget.style.opacity = '.7'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          退出登录
        </button>
      </div>
    </PageBg>
  );
}
