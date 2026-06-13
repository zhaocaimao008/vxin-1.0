import { api } from '../api.js';
import { state, setToken, setMe, loadPersisted } from '../state.js';

export function initLogin({ onSuccess }) {
  const screen = document.getElementById('login-screen');
  const errEl   = document.getElementById('login-err');
  const tabs    = document.querySelectorAll('.login-tab');
  const tabLogin = document.getElementById('tab-login');
  const tabReg   = document.getElementById('tab-register');

  async function loadServer() {
    const url = await window.electron?.getServerUrl?.() || state.serverUrl;
    state.serverUrl = url;
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
  document.getElementById('reg-invite').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-register').click();
  });

  document.getElementById('btn-login').addEventListener('click', async () => {
    const btn = document.getElementById('btn-login');
    const phone = document.getElementById('login-phone').value.trim();
    const password = document.getElementById('login-password').value;
    if (!phone || !password) { errEl.textContent = '请填写手机号和密码'; return; }
    btn.disabled = true; btn.textContent = '登录中…';
    try {
      const res = await api.login(phone, password);
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
    const phone    = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;
    const inviteCode = document.getElementById('reg-invite').value.trim();
    if (!username || !phone || !password || !inviteCode) { errEl.textContent = '请填写所有字段'; return; }
    btn.disabled = true; btn.textContent = '注册中…';
    try {
      const res = await api.register(username, phone, password, inviteCode);
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
