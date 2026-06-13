import { state, setToken, setMe, emit as stateEmit } from '../state.js';
import { api } from '../api.js';
import { disconnectSocket } from '../socket.js';

export async function showSettings() {
  document.getElementById('placeholder').classList.add('hidden');
  document.getElementById('chat-view').classList.add('hidden');
  document.getElementById('contacts-view').classList.add('hidden');
  document.getElementById('moments-view').classList.add('hidden');

  const view = document.getElementById('settings-view');
  view.classList.remove('hidden');
  renderSettings();
}

function renderSettings() {
  const me = state.me || {};
  const theme = state.theme || 'auto';
  const serverUrl = state.serverUrl || '';
  const avatarHtml = me.avatar
    ? `<img src="${escAttr(me.avatar)}" alt="" onerror="this.outerHTML='<div class=\\"avatar-placeholder\\" style=\\"width:64px;height:64px;border-radius:50%;font-size:28px\\">${(me.nickname||me.username||'?').charAt(0)}</div>'" />`
    : `<div class="avatar-placeholder" style="width:64px;height:64px;border-radius:50%;font-size:28px">${(me.nickname||me.username||'?').charAt(0)}</div>`;

  document.getElementById('settings-view').innerHTML = `
    <div class="settings-profile">
      <div id="avatar-wrap" style="cursor:pointer">${avatarHtml}</div>
      <div>
        <div class="name">${escHtml(me.nickname || me.username || '')}</div>
        <div class="id">ID: ${escHtml(String(me.username || me.id || ''))}</div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-title">账号</div>
      <div class="settings-card">
        <div class="settings-row">
          <span class="settings-row-label">昵称</span>
          <span class="settings-row-value" id="disp-nickname">${escHtml(me.nickname || '')}</span>
          <span class="settings-row-action" id="btn-edit-nickname">修改</span>
        </div>
        <div class="settings-row">
          <span class="settings-row-label">个签</span>
          <span class="settings-row-value" id="disp-bio">${escHtml(me.bio || '未设置')}</span>
          <span class="settings-row-action" id="btn-edit-bio">修改</span>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-title">外观</div>
      <div class="settings-card">
        <div class="settings-row">
          <span class="settings-row-label">主题</span>
          <div style="display:flex;gap:8px">
            <button class="theme-btn${theme==='light'?' active':''}" data-theme="light" style="padding:5px 12px;border-radius:6px;border:1px solid var(--panel-border);cursor:pointer;font-size:13px;background:${theme==='light'?'var(--green)':'transparent'};color:${theme==='light'?'#fff':'inherit'}">浅色</button>
            <button class="theme-btn${theme==='dark'?' active':''}" data-theme="dark" style="padding:5px 12px;border-radius:6px;border:1px solid var(--panel-border);cursor:pointer;font-size:13px;background:${theme==='dark'?'var(--green)':'transparent'};color:${theme==='dark'?'#fff':'inherit'}">深色</button>
            <button class="theme-btn${theme==='auto'?' active':''}" data-theme="auto" style="padding:5px 12px;border-radius:6px;border:1px solid var(--panel-border);cursor:pointer;font-size:13px;background:${theme==='auto'?'var(--green)':'transparent'};color:${theme==='auto'?'#fff':'inherit'}">自动</button>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-title">通知</div>
      <div class="settings-card">
        <div class="settings-row">
          <span class="settings-row-label">新消息通知</span>
          <div class="toggle on" id="toggle-notify"></div>
        </div>
        <div class="settings-row">
          <span class="settings-row-label">声音</span>
          <div class="toggle on" id="toggle-sound"></div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-title">连接</div>
      <div class="settings-card">
        <div class="settings-row">
          <span class="settings-row-label">服务器</span>
          <span class="settings-row-value">${escHtml(serverUrl.replace(/^https?:\/\//, ''))}</span>
          <span class="settings-row-action" id="btn-change-server">修改</span>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-card">
        <div class="settings-row" id="btn-logout" style="cursor:pointer;justify-content:center">
          <span style="color:#FA5151;font-weight:600">退出登录</span>
        </div>
      </div>
    </div>
  `;

  // Bind events
  document.getElementById('btn-edit-nickname').addEventListener('click', async () => {
    const val = prompt('新昵称', me.nickname || '');
    if (!val) return;
    try {
      const res = await api.updateProfile({ nickname: val });
      setMe({ ...state.me, nickname: val });
      renderSettings();
      document.getElementById('nav-avatar').alt = val;
    } catch (err) { alert('修改失败: ' + err.message); }
  });

  document.getElementById('btn-edit-bio').addEventListener('click', async () => {
    const val = prompt('个性签名', me.bio || '');
    if (val === null) return;
    try {
      await api.updateProfile({ bio: val });
      setMe({ ...state.me, bio: val });
      renderSettings();
    } catch (err) { alert('修改失败: ' + err.message); }
  });

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const t = btn.dataset.theme;
      state.theme = t;
      await window.electron?.setTheme?.(t);
      applyTheme(t);
      renderSettings();
    });
  });

  document.querySelectorAll('.toggle').forEach(toggle => {
    toggle.addEventListener('click', () => toggle.classList.toggle('on'));
  });

  document.getElementById('btn-change-server').addEventListener('click', async () => {
    const val = prompt('服务器地址', state.serverUrl);
    if (val && val.startsWith('http')) {
      state.serverUrl = val.replace(/\/$/, '');
      await window.electron?.setServerUrl?.(state.serverUrl);
      renderSettings();
    }
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    if (!confirm('确定退出登录？')) return;
    logout();
  });

  document.getElementById('avatar-wrap').addEventListener('click', async () => {
    const filePath = await window.electron?.openFileDialog?.({ filters: [{ name: '图片', extensions: ['png','jpg','jpeg'] }] });
    if (!filePath) return;
    try {
      const res = await window.electron?.readFile?.(filePath);
      if (!res) return;
      const blob = new Blob([res.buffer], { type: 'image/jpeg' });
      const file = new File([blob], res.name, { type: blob.type });
      const { fileUrl } = await api.uploadFile(file, () => {});
      await api.updateProfile({ avatar: fileUrl });
      setMe({ ...state.me, avatar: fileUrl });
      document.getElementById('nav-avatar').src = fileUrl;
      renderSettings();
    } catch (err) { alert('上传失败: ' + err.message); }
  });
}

function applyTheme(theme) {
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else if (theme === 'light') document.documentElement.removeAttribute('data-theme');
  else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  }
}

export function logout() {
  disconnectSocket();
  setToken(null);
  setMe(null);
  state.conversations = [];
  state.messages = {};
  state.activeConvId = null;
  stateEmit('app:logout');
}

export { applyTheme };

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escAttr(s) { return String(s).replace(/"/g,'&quot;'); }
