// Central reactive state
export const state = {
  serverUrl: 'https://chat.91aigu.com',
  token: null,
  me: null,
  conversations: [],      // [{id, name, avatar, lastMsg, unread, isPinned, isMuted}]
  activeConvId: null,
  messages: {},            // { convId: [msg, ...] }
  contacts: [],
  members: {},             // { convId: [user, ...] }
  typingUsers: {},         // { convId: Set<userId> }
  pinnedMessages: {},      // { convId: msg | null }
  replyTo: null,           // msg being replied to
  theme: 'auto',
  platform: 'linux',
  listeners: {},
};

export function on(event, fn) {
  if (!state.listeners[event]) state.listeners[event] = [];
  state.listeners[event].push(fn);
}

export function off(event, fn) {
  if (!state.listeners[event]) return;
  state.listeners[event] = state.listeners[event].filter(f => f !== fn);
}

export function emit(event, data) {
  (state.listeners[event] || []).forEach(fn => fn(data));
}

export function setToken(t) {
  state.token = t;
  if (t) localStorage.setItem('vxin_token', t);
  else localStorage.removeItem('vxin_token');
}

export function setMe(user) {
  state.me = user;
  if (user) localStorage.setItem('vxin_me', JSON.stringify(user));
  else localStorage.removeItem('vxin_me');
}

export function upsertConversation(conv) {
  const idx = state.conversations.findIndex(c => c.id === conv.id);
  if (idx >= 0) Object.assign(state.conversations[idx], conv);
  else state.conversations.unshift(conv);
  emit('conversations:update');
}

export function addMessage(convId, msg) {
  if (!state.messages[convId]) state.messages[convId] = [];
  const existing = state.messages[convId].findIndex(m => m.id === msg.id);
  if (existing >= 0) {
    state.messages[convId][existing] = { ...state.messages[convId][existing], ...msg };
  } else {
    state.messages[convId].push(msg);
  }
  emit('messages:update', { convId, msg });
}

export function recallMessage(convId, msgId) {
  const msgs = state.messages[convId] || [];
  const m = msgs.find(m => m.id === msgId);
  if (m) { m.recalled = true; m.content = '[消息已撤回]'; }
  emit('messages:recall', { convId, msgId });
}

export function setTyping(convId, userId, isTyping) {
  if (!state.typingUsers[convId]) state.typingUsers[convId] = new Set();
  if (isTyping) state.typingUsers[convId].add(userId);
  else state.typingUsers[convId].delete(userId);
  emit('typing:update', { convId });
}

export function incrementUnread(convId) {
  const c = state.conversations.find(c => c.id === convId);
  if (c && convId !== state.activeConvId) {
    c.unread = (c.unread || 0) + 1;
    emit('conversations:update');
  }
}

export function clearUnread(convId) {
  const c = state.conversations.find(c => c.id === convId);
  if (c) { c.unread = 0; emit('conversations:update'); }
}

export function totalUnread() {
  return state.conversations.reduce((s, c) => s + (c.unread || 0), 0);
}

export function loadPersisted() {
  state.token = localStorage.getItem('vxin_token') || null;
  try { state.me = JSON.parse(localStorage.getItem('vxin_me')); } catch (_) {}
}
