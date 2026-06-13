import { state, on, emit as stateEmit, clearUnread, totalUnread } from '../state.js';
import { api } from '../api.js';
import { openChat } from './chat.js';

let searchTimer = null;

export async function initChatList() {
  await loadConversations();
  renderList();
  on('conversations:update', renderList);

  document.getElementById('conv-search').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderList(e.target.value.trim()), 200);
  });
}

export async function loadConversations() {
  try {
    const res = await api.conversations();
    state.conversations = (res.conversations || res || []).map(normalizeConv);
    stateEmit('conversations:update');
  } catch (err) {
    console.error('[chatlist] load failed', err);
  }
}

function normalizeConv(c) {
  return {
    id:        c.id || c.conversationId,
    name:      c.name || c.partnerNickname || c.partnerUsername || '未知',
    avatar:    c.avatar || c.partnerAvatar || null,
    lastMsg:   c.lastMessage?.content || c.lastMsg || '',
    lastTime:  c.lastMessage?.createdAt || c.lastTime || null,
    unread:    c.unreadCount || c.unread || 0,
    isMuted:   c.isMuted || false,
    isGroup:   c.type === 'group' || c.isGroup || false,
    partnerId: c.partnerId || null,
  };
}

export function renderList(filter = '') {
  const list = document.getElementById('conv-list');
  let convs = state.conversations;
  if (filter) {
    const q = filter.toLowerCase();
    convs = convs.filter(c => c.name.toLowerCase().includes(q) || c.lastMsg.toLowerCase().includes(q));
  }

  if (!convs.length) {
    list.innerHTML = `<div class="empty-tip">${filter ? '没有匹配结果' : '暂无对话'}</div>`;
    return;
  }

  list.innerHTML = convs.map(c => {
    const time = c.lastTime ? fmtTime(c.lastTime) : '';
    const preview = c.lastMsg ? escHtml(c.lastMsg.slice(0, 40)) : '';
    const avatarHtml = c.avatar
      ? `<img src="${c.avatar}" alt="${escHtml(c.name)}" onerror="this.style.display='none'" />`
      : `<div class="avatar-placeholder" style="border-radius:${c.isGroup?'8px':'50%'}">${c.name.charAt(0)}</div>`;
    const badgeHtml = c.unread > 0
      ? `<span class="unread-badge">${c.unread > 99 ? '99+' : c.unread}</span>` : '';
    const isActive = c.id === state.activeConvId;
    return `<div class="conv-item${isActive ? ' active' : ''}" data-id="${c.id}">
      <div class="conv-avatar">${avatarHtml}${badgeHtml}</div>
      <div class="conv-body">
        <div class="conv-name">${escHtml(c.name)}</div>
        <div class="conv-preview">${preview}</div>
      </div>
      <div class="conv-meta">
        <div class="conv-time">${time}</div>
        ${c.isMuted ? '<div class="conv-mute">🔕</div>' : ''}
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.conv-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      openChat(id);
    });
  });

  // Update app-level badge
  updateBadge();
}

export function updateBadge() {
  const total = totalUnread();
  const badge = document.getElementById('total-badge');
  if (total > 0) {
    badge.textContent = total > 99 ? '99+' : total;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
  window.electron?.setBadge?.(total);
}

function fmtTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  const diff = (now - d) / 86400000;
  if (diff < 7) return ['日','一','二','三','四','五','六'][d.getDay()] ? `周${'日一二三四五六'[d.getDay()]}` : '';
  return `${d.getMonth()+1}/${d.getDate()}`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
