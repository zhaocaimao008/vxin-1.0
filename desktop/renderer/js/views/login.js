import { api } from '../api.js';
import { state, setToken, setMe, loadPersisted } from '../state.js';

export function initLogin({ onSuccess }) {
  const screen = document.getElementById('login-screen');
  const errEl   = document.getElementById('login-err');
  const serverDisplay = document.getElementById('server-url-display');
  const tabs = document.querySelectorAll('.login-tab');
  const tabLogin = document.getElementById('tab-login');
  const tabReg   = document.getElementById('tab-register');

  async function loadServer() {
    const url = await window.electron?.getServerUrl?.() || state.serverUrl;
    state.serverUrl = url;
    serverDisplay.textContent = url.replace(/^https?:\/\//, '');
  }

  loadServer();

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const which = tab.dataset.tab;
      tabLogin.classList.toggle('hidden', which !== 'login');
      tabReg.classList.toggle('hidden', which !== 'register');
      errEl.textContent = '';
    });
  });

  // Enter key
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-login').click();
  });
  document.getElementById('reg-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-register').click();
  });

  document.getElementById('btn-login').addEventListener('click', async () => {
    const btn = document.getElementById('btn-login');
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    if (!username || !password) { errEl.textContent = '请填写账号和密码'; return; }
    btn.disabled = true; btn.textContent = '登录中…';
    try {
      const res = await api.login(username, password);
      setToken(res.token);
      setMe(res.user || res);
      screen.classList.add('hidden');
      onSuccess();
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      btn.disabled = false; btn.textContent = '登录';
    }
  });

  document.getElementById('btn-register').addEventListener('click', async () => {
    const btn = document.getElementById('btn-register');
    const username = document.getElementById('reg-username').value.trim();
    const nickname = document.getElementById('reg-nickname').value.trim();
    const password = document.getElementById('reg-password').value;
    if (!username || !nickname || !password) { errEl.textContent = '请填写所有字段'; return; }
    if (password.length < 6) { errEl.textContent = '密码至少 6 位'; return; }
    btn.disabled = true; btn.textContent = '注册中…';
    try {
      const res = await api.register(username, nickname, password);
      setToken(res.token);
      setMe(res.user || res);
      screen.classList.add('hidden');
      onSuccess();
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      btn.disabled = false; btn.textContent = '注册';
    }
  });

  document.getElementById('btn-change-server').addEventListener('click', async () => {
    const newUrl = prompt('服务器地址', state.serverUrl);
    if (newUrl && newUrl.startsWith('http')) {
      state.serverUrl = newUrl.replace(/\/$/, '');
      await window.electron?.setServerUrl?.(state.serverUrl);
      serverDisplay.textContent = state.serverUrl.replace(/^https?:\/\//, '');
    }
  });

  // Auto-login if token persisted
  async function tryAutoLogin() {
    loadPersisted();
    if (!state.token) { screen.classList.remove('hidden'); return; }
    try {
      const res = await api.me();
      setMe(res.user || res);
      screen.classList.add('hidden');
      onSuccess();
    } catch (_) {
      setToken(null);
      screen.classList.remove('hidden');
    }
  }

  tryAutoLogin();
}
