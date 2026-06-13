import { state, on, emit as stateEmit, addMessage, clearUnread, upsertConversation } from '../state.js';
import { api } from '../api.js';
import { getSocket, emitTyping, emitMarkRead } from '../socket.js';
import { renderList, updateBadge } from './chatlist.js';

const EMOJIS = ['😀','😂','🤣','😊','😍','🥰','😘','😎','🤩','😏','😒','😢','😭','😤','😡','🤔','🤗','😴','🥳','🎉',
  '👍','👎','👏','🤝','🙏','💪','🤞','❤️','💕','💔','🔥','⭐','💯','✅','❌','🎁','🎂','🍕','🍎','🚀'];

let typingTimer = null;
let isTyping = false;
let currentConvId = null;

export async function openChat(convId) {
  currentConvId = convId;
  state.activeConvId = convId;
  clearUnread(convId);
  updateBadge();
  renderList();

  const conv = state.conversations.find(c => c.id === convId);

  document.getElementById('placeholder').classList.add('hidden');
  document.getElementById('contacts-view').classList.add('hidden');
  document.getElementById('moments-view').classList.add('hidden');
  document.getElementById('settings-view').classList.add('hidden');
  const chatView = document.getElementById('chat-view');
  chatView.classList.remove('hidden');

  document.getElementById('chat-title').textContent = conv?.name || '对话';
  document.getElementById('chat-sub').textContent = conv?.isGroup ? '群聊' : '';

  renderPinned(convId);
  await loadMessages(convId);
  emitMarkRead(convId);
}

async function loadMessages(convId) {
  const area = document.getElementById('messages-area');
  area.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px">加载中…</div>';
  try {
    const res = await api.messages(convId, { limit: 50 });
    state.messages[convId] = (res.messages || res || []);
    renderMessages(convId, true);
  } catch (err) {
    area.innerHTML = `<div class="empty-tip">加载失败: ${err.message}</div>`;
  }
}

function renderMessages(convId, scrollBottom = false) {
  if (convId !== currentConvId) return;
  const area = document.getElementById('messages-area');
  const msgs = state.messages[convId] || [];

  if (!msgs.length) { area.innerHTML = '<div class="empty-tip">暂无消息，开始聊天吧</div>'; return; }

  const wasAtBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 80;

  area.innerHTML = msgs.map(m => renderMsgRow(m, convId)).join('');

  // Bind message events
  area.querySelectorAll('.bubble, .msg-image, .file-bubble, .voice-bubble').forEach(el => {
    el.addEventListener('contextmenu', e => showContextMenu(e, el.closest('[data-msgid]'), convId));
  });
  area.querySelectorAll('.msg-image').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src));
  });
  area.querySelectorAll('.reaction-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const msgId = pill.closest('[data-msgid]').dataset.msgid;
      const emoji = pill.dataset.emoji;
      api.react(msgId, emoji).catch(console.error);
    });
  });
  area.querySelectorAll('.reply-quote').forEach(q => {
    q.addEventListener('click', () => {
      const id = q.dataset.refid;
      const el = area.querySelector(`[data-msgid="${id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  if (scrollBottom || wasAtBottom) area.scrollTop = area.scrollHeight;

  // Typing indicator
  renderTypingIndicator(convId);
}

function renderMsgRow(msg, convId) {
  const isMe = msg.senderId === state.me?.id;
  if (msg.type === 'system') {
    return `<div class="msg-row system" data-msgid="${msg.id}">
      <div class="bubble system-bubble">${escHtml(msg.content)}</div>
    </div>`;
  }

  const dir = isMe ? 'out' : 'in';
  const avatarHtml = !isMe
    ? `<div class="msg-avatar"><img src="${msg.senderAvatar || ''}" alt="" onerror="this.style.display='none'" /></div>`
    : '';
  const senderHtml = !isMe && isGroupConv(convId)
    ? `<div class="msg-sender">${escHtml(msg.senderNickname || msg.senderUsername || '')}</div>`
    : '';

  const replyHtml = msg.replyTo
    ? `<div class="reply-quote" data-refid="${msg.replyTo.id}">${escHtml(msg.replyTo.senderNickname || '')}: ${escHtml(String(msg.replyTo.content || '').slice(0, 60))}</div>`
    : '';

  const bubbleContent = msg.recalled
    ? `<div class="bubble recalled">消息已撤回${isMe ? ' <a href="#" onclick="return false" data-re-edit data-msgid="${msg.id}">重新编辑</a>' : ''}</div>`
    : renderBubble(msg, isMe);

  const reactions = renderReactions(msg);
  const status = isMe ? renderStatus(msg) : '';
  const timeStr = fmtMsgTime(msg.createdAt);

  return `<div class="msg-row ${dir}" data-msgid="${msg.id}" data-senderid="${msg.senderId}">
    ${dir === 'in' ? avatarHtml : ''}
    <div class="msg-content">
      ${senderHtml}
      ${replyHtml}
      ${bubbleContent}
      ${reactions}
      <div class="msg-status">${timeStr}${status}</div>
    </div>
    ${dir === 'out' ? avatarHtml : ''}
  </div>`;
}

function renderBubble(msg, isMe) {
  switch (msg.type) {
    case 'image':
      return `<img class="msg-image" src="${escAttr(msg.fileUrl || msg.content || '')}" alt="图片" loading="lazy" />`;
    case 'file':
      return `<div class="file-bubble">
        <div class="file-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13,2 13,9 20,9"/></svg></div>
        <div class="file-info">
          <div class="file-name">${escHtml(msg.fileName || '文件')}</div>
          <div class="file-size">${fmtSize(msg.fileSize)}</div>
        </div>
      </div>`;
    case 'voice':
      return `<div class="voice-bubble">
        <svg class="voice-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
        </svg>
        <div class="voice-wave"><span></span><span></span><span></span></div>
        <span class="voice-duration">${msg.duration || '0'}"</span>
      </div>`;
    case 'sticker':
      return `<img class="sticker-img" src="${escAttr(msg.fileUrl || msg.content || '')}" alt="贴纸" />`;
    case 'contact':
      try {
        const card = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
        return `<div class="contact-card-bubble">
          <div class="contact-card-avatar"><img src="${escAttr(card.avatar||'')}" alt="" onerror="this.style.display='none'" /></div>
          <div class="contact-card-info">
            <div class="name">${escHtml(card.nickname || card.username || '')}</div>
            <div class="hint">个人名片</div>
          </div>
        </div>`;
      } catch (_) {
        return `<div class="bubble">${escHtml(String(msg.content))}</div>`;
      }
    default:
      return `<div class="bubble">${linkify(escHtml(String(msg.content || '')))}</div>`;
  }
}

function renderReactions(msg) {
  if (!msg.reactions || !msg.reactions.length) return '';
  const grouped = {};
  msg.reactions.forEach(r => {
    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
    grouped[r.emoji].count++;
    if (r.userId === state.me?.id) grouped[r.emoji].mine = true;
  });
  const pills = Object.entries(grouped).map(([emoji, { count, mine }]) =>
    `<div class="reaction-pill${mine ? ' mine' : ''}" data-emoji="${emoji}">${emoji}<span class="reaction-count">${count}</span></div>`
  ).join('');
  return `<div class="reactions">${pills}</div>`;
}

function renderStatus(msg) {
  if (msg.readBy?.length > 0) return ' <span class="status-read">已读</span>';
  return '';
}

function renderTypingIndicator(convId) {
  const area = document.getElementById('messages-area');
  const existingTyping = area.querySelector('.typing-indicator');
  if (existingTyping) existingTyping.remove();

  const typers = state.typingUsers[convId];
  if (!typers || typers.size === 0) return;
  const div = document.createElement('div');
  div.className = 'msg-row in typing-indicator';
  div.innerHTML = `<div class="msg-avatar"><div style="width:36px"></div></div>
    <div class="typing-dots"><span></span><span></span><span></span></div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function renderPinned(convId) {
  const banner = document.getElementById('pinned-banner');
  const pinned = state.pinnedMessages[convId];
  if (!pinned) { banner.classList.add('hidden'); return; }
  banner.classList.remove('hidden');
  document.getElementById('pinned-text').textContent = String(pinned.content || '[图片]').slice(0, 60);
  banner.onclick = () => {
    const el = document.querySelector(`[data-msgid="${pinned.id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
}

function showContextMenu(e, msgEl, convId) {
  e.preventDefault();
  if (!msgEl) return;
  const msgId = msgEl.dataset.msgid;
  const senderId = msgEl.dataset.senderid;
  const isMe = String(senderId) === String(state.me?.id);
  const msg = (state.messages[convId] || []).find(m => String(m.id) === String(msgId));
  if (!msg) return;

  const menu = document.getElementById('ctx-menu');
  const items = [];

  items.push({ label: '↩ 回复', icon: replyIcon(), action: () => setReply(msg) });
  if (!msg.recalled) {
    items.push({ label: '😀 表情回应', icon: emojiIcon(), action: () => showReactionPicker(msgId, e) });
    items.push({ label: '📋 复制', icon: copyIcon(), action: () => navigator.clipboard.writeText(msg.content || '') });
    items.push({ label: '➡ 转发', icon: forwardIcon(), action: () => forwardMessage(msg) });
  }
  if (isMe && !msg.recalled) {
    const age = Date.now() - new Date(msg.createdAt).getTime();
    if (age < 120000) {
      if (msg.type === 'text') items.push({ label: '✏ 编辑', icon: editIcon(), action: () => startEdit(msg) });
      items.push({ sep: true });
      items.push({ label: '撤回', icon: recallIcon(), danger: true, action: () => recallMsg(msgId, convId) });
    }
    items.push({ label: '📌 置顶', icon: pinIcon(), action: () => pinMessage(convId, msgId) });
    items.push({ sep: true });
    items.push({ label: '删除', icon: deleteIcon(), danger: true, action: () => deleteMsg(msgId, convId) });
  }

  menu.innerHTML = items.map(item => item.sep
    ? '<div class="ctx-sep"></div>'
    : `<div class="ctx-item${item.danger ? ' danger' : ''}" data-action="${item.action?.name || ''}">${item.icon || ''}${item.label}</div>`
  ).join('');

  menu.querySelectorAll('.ctx-item').forEach((el, i) => {
    const filtered = items.filter(it => !it.sep);
    el.addEventListener('click', () => { filtered[i]?.action?.(); hideCtxMenu(); });
  });

  positionMenu(menu, e.clientX, e.clientY);
  menu.classList.remove('hidden');

  setTimeout(() => document.addEventListener('click', hideCtxMenu, { once: true }), 0);
}

function positionMenu(menu, x, y) {
  menu.classList.remove('hidden');
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = x, top = y;
  const rect = menu.getBoundingClientRect();
  if (left + rect.width > vw) left = vw - rect.width - 8;
  if (top + rect.height > vh) top = vh - rect.height - 8;
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

function hideCtxMenu() {
  document.getElementById('ctx-menu').classList.add('hidden');
}

function setReply(msg) {
  state.replyTo = msg;
  const preview = document.getElementById('reply-preview');
  const text = document.getElementById('reply-text');
  preview.classList.remove('hidden');
  const sender = msg.senderNickname || msg.senderUsername || '';
  text.textContent = `${sender}: ${String(msg.content || '[图片]').slice(0, 60)}`;
  document.getElementById('msg-input').focus();
}

function startEdit(msg) {
  const input = document.getElementById('msg-input');
  input.value = msg.content;
  input.dataset.editId = msg.id;
  input.focus();
  updateSendBtn();
}

async function recallMsg(msgId, convId) {
  try {
    await api.recall(msgId);
    // Server will broadcast via socket
  } catch (err) {
    alert('撤回失败: ' + err.message);
  }
}

async function pinMessage(convId, msgId) {
  try {
    await api.pin(convId, msgId);
    const msg = (state.messages[convId] || []).find(m => String(m.id) === String(msgId));
    if (msg) {
      state.pinnedMessages[convId] = msg;
      renderPinned(convId);
    }
  } catch (err) {
    alert('置顶失败: ' + err.message);
  }
}

async function deleteMsg(msgId, convId) {
  if (!confirm('确定删除这条消息？')) return;
  try {
    await api.recall(msgId);
  } catch (err) {
    alert('删除失败: ' + err.message);
  }
}

function forwardMessage(msg) {
  const convs = state.conversations.filter(c => c.id !== currentConvId);
  if (!convs.length) { alert('没有其他对话'); return; }
  const names = convs.map((c, i) => `${i+1}. ${c.name}`).join('\n');
  const idx = parseInt(prompt(`转发到哪个对话？\n${names}`, '1')) - 1;
  const target = convs[idx];
  if (!target) return;
  const content = msg.type === 'text' ? msg.content : `[转发: ${msg.type}]`;
  api.sendText(null, content).catch(console.error);
  alert(`已转发到 ${target.name}`);
}

function showReactionPicker(msgId, e) {
  const picker = document.createElement('div');
  picker.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY-50}px;background:var(--white);
    border:1px solid var(--panel-border);border-radius:12px;padding:8px 10px;z-index:300;
    display:flex;gap:4px;box-shadow:0 4px 20px rgba(0,0,0,.12)`;
  const quick = ['👍','❤️','😂','😮','😢','🙏'];
  quick.forEach(emoji => {
    const btn = document.createElement('span');
    btn.textContent = emoji;
    btn.style.cssText = 'font-size:22px;cursor:pointer;padding:4px;border-radius:6px';
    btn.addEventListener('mouseenter', () => btn.style.background = 'var(--green-light)');
    btn.addEventListener('mouseleave', () => btn.style.background = '');
    btn.addEventListener('click', () => {
      api.react(msgId, emoji).catch(console.error);
      document.body.removeChild(picker);
    });
    picker.appendChild(btn);
  });
  document.body.appendChild(picker);
  setTimeout(() => document.addEventListener('click', () => { if (document.body.contains(picker)) document.body.removeChild(picker); }, { once: true }), 0);
}

// ── Input area setup ──────────────────────────────────────────────────────────

export function initInputArea() {
  const input = document.getElementById('msg-input');
  const sendBtn = document.getElementById('btn-send');
  const btnEmoji = document.getElementById('btn-emoji');
  const btnImage = document.getElementById('btn-image');
  const btnFile  = document.getElementById('btn-file');
  const btnSticker = document.getElementById('btn-sticker');
  const emojiPanel = document.getElementById('emoji-panel');
  const emojiGrid  = document.getElementById('emoji-grid');

  // Populate emoji grid
  emojiGrid.innerHTML = EMOJIS.map(e => `<div class="emoji-item">${e}</div>`).join('');
  emojiGrid.querySelectorAll('.emoji-item').forEach(el => {
    el.addEventListener('click', () => {
      insertAtCursor(input, el.textContent);
      updateSendBtn();
    });
  });

  // Toggle emoji panel
  btnEmoji.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPanel.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!emojiPanel.contains(e.target) && e.target !== btnEmoji) emojiPanel.classList.add('hidden');
  });

  // Input events
  input.addEventListener('input', () => {
    autoResize(input);
    updateSendBtn();
    handleTyping();
    handleMention(input);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendMessage();
    }
    if (e.key === 'Escape') {
      cancelReply();
      delete input.dataset.editId;
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  // Reply cancel
  document.getElementById('reply-cancel').addEventListener('click', cancelReply);

  // Image upload
  const imageInput = document.getElementById('file-image-input');
  btnImage.addEventListener('click', () => imageInput.click());
  imageInput.addEventListener('change', () => {
    if (imageInput.files[0]) uploadAndSend(imageInput.files[0], 'image');
    imageInput.value = '';
  });

  // File upload
  const fileInput = document.getElementById('file-any-input');
  btnFile.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) uploadAndSend(fileInput.files[0], 'file');
    fileInput.value = '';
  });

  // Native file dialog (Electron)
  btnImage.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    const filePath = await window.electron?.openFileDialog?.({ filters: [{ name: '图片', extensions: ['png','jpg','jpeg','gif','webp'] }] });
    if (filePath) {
      const res = await window.electron?.readFile?.(filePath);
      if (res) {
        const blob = new Blob([res.buffer], { type: 'image/*' });
        const file = new File([blob], res.name, { type: blob.type });
        uploadAndSend(file, 'image');
      }
    }
  });

  // Sticker panel
  btnSticker.addEventListener('click', async () => {
    let panel = document.getElementById('sticker-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'sticker-panel';
      panel.className = 'hidden';
      document.getElementById('input-area').insertBefore(panel, document.querySelector('.upload-bar'));
    }
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) loadStickerPanel(panel);
  });
}

async function loadStickerPanel(panel) {
  panel.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:13px">加载中…</div>';
  try {
    const res = await api.stickers();
    const stickers = res.stickers || res || [];
    if (!stickers.length) {
      panel.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px">暂无贴纸</div>';
      return;
    }
    panel.innerHTML = `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:10px;max-height:220px;overflow-y:auto">
      ${stickers.map(s => `<img src="${escAttr(s.url||s.imageUrl||'')}" alt="${escAttr(s.name||'')}" style="width:60px;height:60px;object-fit:contain;cursor:pointer;border-radius:6px" data-url="${escAttr(s.url||s.imageUrl||'')}" />`).join('')}
    </div>`;
    panel.querySelectorAll('img').forEach(img => {
      img.addEventListener('click', () => {
        sendStickerMsg(img.dataset.url);
        panel.classList.add('hidden');
      });
    });
  } catch (_) {
    panel.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:13px">加载失败</div>';
  }
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const content = input.value.trim();
  if (!content || !currentConvId) return;

  const conv = state.conversations.find(c => c.id === currentConvId);
  const editId = input.dataset.editId;

  if (editId) {
    // Edit mode
    try {
      await api.editMessage(editId, content);
      delete input.dataset.editId;
      input.value = '';
      updateSendBtn();
    } catch (err) { alert('编辑失败: ' + err.message); }
    return;
  }

  const replyToId = state.replyTo?.id;
  cancelReply();
  input.value = '';
  autoResize(input);
  updateSendBtn();

  // Optimistic message
  const tempMsg = {
    id: 'tmp-' + Date.now(),
    conversationId: currentConvId,
    senderId: state.me?.id,
    senderNickname: state.me?.nickname || state.me?.username,
    senderAvatar: state.me?.avatar,
    content,
    type: 'text',
    createdAt: new Date().toISOString(),
    replyTo: state.replyTo,
    _pending: true,
  };
  addMessage(currentConvId, tempMsg);
  renderMessages(currentConvId, true);

  try {
    const toUserId = conv?.isGroup ? null : conv?.partnerId;
    await api.sendText(toUserId, content, replyToId);
  } catch (err) {
    alert('发送失败: ' + err.message);
  }

  stopTyping();
}

async function uploadAndSend(file, defaultType) {
  if (!currentConvId) return;
  const uploadBar = document.getElementById('upload-bar');
  const progress  = document.getElementById('upload-progress');
  uploadBar.classList.remove('hidden');

  try {
    const { fileUrl, name, size, type } = await api.uploadFile(file, pct => {
      progress.style.width = pct + '%';
    });
    progress.style.width = '100%';

    const msgType = file.type.startsWith('image/') ? 'image' : 'file';
    const conv = state.conversations.find(c => c.id === currentConvId);
    const toUserId = conv?.isGroup ? null : conv?.partnerId;

    await api.sendFile({
      toUserId,
      type: msgType,
      content: fileUrl,
      fileUrl,
      fileName: name,
      fileSize: size,
    });
  } catch (err) {
    alert('上传失败: ' + err.message);
  } finally {
    setTimeout(() => {
      uploadBar.classList.add('hidden');
      progress.style.width = '0%';
    }, 600);
  }
}

async function sendStickerMsg(url) {
  if (!currentConvId) return;
  const conv = state.conversations.find(c => c.id === currentConvId);
  const toUserId = conv?.isGroup ? null : conv?.partnerId;
  await api.sendFile({ toUserId, type: 'sticker', content: url, fileUrl: url }).catch(console.error);
}

function cancelReply() {
  state.replyTo = null;
  document.getElementById('reply-preview').classList.add('hidden');
}

function updateSendBtn() {
  const v = document.getElementById('msg-input').value.trim();
  document.getElementById('btn-send').disabled = !v;
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleTyping() {
  if (!currentConvId) return;
  if (!isTyping) { isTyping = true; emitTyping(currentConvId, true); }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(stopTyping, 3000);
}

function stopTyping() {
  if (isTyping && currentConvId) { isTyping = false; emitTyping(currentConvId, false); }
  clearTimeout(typingTimer);
}

function handleMention(input) {
  const val = input.value;
  const cursor = input.selectionStart;
  const atIdx = val.lastIndexOf('@', cursor - 1);
  if (atIdx < 0) { hideMentionList(); return; }
  const query = val.slice(atIdx + 1, cursor).toLowerCase();
  showMentionList(query, atIdx, input);
}

function showMentionList(query, atIdx, input) {
  const members = state.members[currentConvId] || [];
  const matched = members.filter(m => (m.nickname || m.username || '').toLowerCase().includes(query));
  const list = document.getElementById('mention-list');
  if (!matched.length) { list.classList.add('hidden'); return; }
  list.innerHTML = matched.slice(0, 8).map((m, i) =>
    `<div class="mention-item${i===0?' selected':''}" data-uid="${m.id}" data-name="${escAttr(m.nickname||m.username||'')}">
      <img src="${escAttr(m.avatar||'')}" alt="" onerror="this.style.display='none'" />
      <span>${escHtml(m.nickname||m.username||'')}</span>
    </div>`
  ).join('');
  list.classList.remove('hidden');
  list.querySelectorAll('.mention-item').forEach(el => {
    el.addEventListener('click', () => {
      const name = el.dataset.name;
      const val = input.value;
      const cursor = input.selectionStart;
      const before = val.slice(0, val.lastIndexOf('@', cursor - 1));
      const after = val.slice(cursor);
      input.value = before + '@' + name + ' ' + after;
      hideMentionList();
      input.focus();
      updateSendBtn();
    });
  });
}

function hideMentionList() {
  document.getElementById('mention-list').classList.add('hidden');
}

function insertAtCursor(el, text) {
  const start = el.selectionStart, end = el.selectionEnd;
  el.value = el.value.slice(0, start) + text + el.value.slice(end);
  el.selectionStart = el.selectionEnd = start + text.length;
}

// ── Socket event handlers (called from app.js) ───────────────────────────────

export function onNewMessage(msg) {
  if (msg.conversationId === currentConvId) {
    renderMessages(msg.conversationId, true);
    emitMarkRead(msg.conversationId);
    clearUnread(msg.conversationId);
    updateBadge();
  }
}

export function onRecalled({ conversationId }) {
  if (conversationId === currentConvId) renderMessages(conversationId);
}

export function onEdited(msg) {
  if (msg.conversationId === currentConvId) renderMessages(msg.conversationId);
}

export function onReaction(data) {
  if (data.conversationId === currentConvId) {
    const msg = (state.messages[currentConvId] || []).find(m => String(m.id) === String(data.messageId));
    if (msg) {
      if (!msg.reactions) msg.reactions = [];
      msg.reactions = msg.reactions.filter(r => !(r.userId === data.userId && r.emoji === data.emoji));
      if (data.action !== 'remove') msg.reactions.push({ userId: data.userId, emoji: data.emoji });
      renderMessages(currentConvId);
    }
  }
}

export function onTypingUpdate({ convId }) {
  if (convId === currentConvId) renderTypingIndicator(convId);
}

export function onSocketConnected() {
  document.getElementById('chat-sub').textContent = '';
}

export function onSocketDisconnected() {
  document.getElementById('chat-sub').textContent = '连接中断，重连中…';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isGroupConv(convId) {
  return state.conversations.find(c => c.id === convId)?.isGroup || false;
}

function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.remove('hidden');
}

function fmtMsgTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escAttr(s) { return String(s).replace(/"/g,'&quot;'); }

function linkify(text) {
  return text.replace(/(https?:\/\/[^\s<>"]+)/g, '<a href="#" data-url="$1" style="color:var(--green)">$1</a>');
}

// Icon strings
const replyIcon   = () => '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,17 4,12 9,7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>';
const copyIcon    = () => '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const forwardIcon = () => '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15,17 20,12 15,7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>';
const editIcon    = () => '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const recallIcon  = () => '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>';
const pinIcon     = () => '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 4-8 8 2 2 8-8zM9 15l-4 4"/><path d="M14 3l7 7"/></svg>';
const deleteIcon  = () => '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
const emojiIcon   = () => '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>';
