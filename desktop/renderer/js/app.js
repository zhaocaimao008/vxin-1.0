import { state, on, loadPersisted } from './state.js';
import { connectSocket }   from './socket.js';
import { initLogin }       from './views/login.js';
import { initChatList, loadConversations }    from './views/chatlist.js';
import { initInputArea, onNewMessage, onRecalled, onEdited, onReaction, onTypingUpdate, onSocketConnected, onSocketDisconnected } from './views/chat.js';
import { showContacts }    from './views/contacts.js';
import { showMoments }     from './views/moments.js';
import { showSettings, applyTheme } from './views/settings.js';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function boot() {
  // 1. Read persisted serverUrl + theme from Electron store
  const serverUrl = await window.electron?.getServerUrl?.();
  if (serverUrl) state.serverUrl = serverUrl;

  const theme = await window.electron?.getTheme?.();
  if (theme) { state.theme = theme; applyTheme(theme); }

  const platform = await window.electron?.getPlatform?.();
  if (platform) {
    state.platform = platform;
    document.getElementById('app').setAttribute('data-platform', platform);
  }

  // 2. Init login (will auto-login if token in localStorage)
  initLogin({ onSuccess: onLoggedIn });
}

async function onLoggedIn() {
  const app = document.getElementById('app');
  app.classList.remove('hidden');

  // Update nav avatar
  const navAvatar = document.getElementById('nav-avatar');
  if (state.me?.avatar) navAvatar.src = state.me.avatar;
  navAvatar.alt = state.me?.nickname || state.me?.username || '';

  // Init views
  await initChatList();
  initInputArea();
  initNavigation();
  initLightbox();
  initWindowControls();

  // Connect socket
  connectSocket();

  // Hook socket events into views
  on('socket:message',      onNewMessage);
  on('socket:recalled',     onRecalled);
  on('socket:edited',       onEdited);
  on('socket:reaction',     onReaction);
  on('typing:update',       onTypingUpdate);
  on('socket:connected',    onSocketConnected);
  on('socket:disconnected', onSocketDisconnected);

  // Re-login event (from settings logout)
  on('app:logout', () => {
    app.classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('conv-list').innerHTML = '';
    document.getElementById('placeholder').classList.remove('hidden');
    ['chat-view','contacts-view','moments-view','settings-view'].forEach(id =>
      document.getElementById(id).classList.add('hidden'));
    // Re-init login
    initLogin({ onSuccess: onLoggedIn });
  });

  // System theme change
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'auto') applyTheme('auto');
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────

function initNavigation() {
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      switchView(view);
    });
  });
}

function switchView(view) {
  // Show/hide list panels
  ['chats','contacts','moments','settings'].forEach(n => {
    document.getElementById(`${n}-panel`).classList.toggle('hidden', n !== view);
  });

  switch (view) {
    case 'chats':
      // Nothing extra — chatlist already rendered
      break;
    case 'contacts':
      showContacts();
      break;
    case 'moments':
      showMoments();
      break;
    case 'settings':
      showSettings();
      break;
  }
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function initLightbox() {
  const lb = document.getElementById('lightbox');
  document.getElementById('lightbox-close').addEventListener('click', () => lb.classList.add('hidden'));
  lb.addEventListener('click', e => { if (e.target === lb) lb.classList.add('hidden'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.add('hidden'); });
}

// ── Window controls (Windows custom titlebar) ─────────────────────────────────

function initWindowControls() {
  document.getElementById('win-min')?.addEventListener('click', () => window.electron?.minimize?.());
  document.getElementById('win-max')?.addEventListener('click', () => window.electron?.maximize?.());
  document.getElementById('win-close')?.addEventListener('click', () => window.electron?.closeWindow?.());
}

// ── Nav avatar click → profile ────────────────────────────────────────────────

document.getElementById('nav-avatar').addEventListener('click', () => {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.nav-btn[data-view="settings"]').classList.add('active');
  showSettings();
  switchView('settings');
});

// ── Start ─────────────────────────────────────────────────────────────────────

boot().catch(console.error);
