import { state } from '../state.js';
import { api } from '../api.js';
import { openChat } from './chat.js';

export async function showContacts() {
  document.getElementById('placeholder').classList.add('hidden');
  document.getElementById('chat-view').classList.add('hidden');
  document.getElementById('moments-view').classList.add('hidden');
  document.getElementById('settings-view').classList.add('hidden');

  const view = document.getElementById('contacts-view');
  view.classList.remove('hidden');

  view.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">加载中…</div>';

  try {
    const res = await api.contacts();
    const contacts = (res.contacts || res || []).map(normalizeContact);
    state.contacts = contacts;
    renderContacts(contacts);
  } catch (err) {
    view.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted)">加载失败: ${err.message}</div>`;
  }

  // Search in panel
  document.getElementById('contact-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = state.contacts.filter(c => c.name.toLowerCase().includes(q));
    renderContacts(filtered);
  });
}

function normalizeContact(c) {
  return {
    id:     c.id || c.userId,
    name:   c.nickname || c.username || '未知',
    avatar: c.avatar || null,
    status: c.status || '',
  };
}

function renderContacts(contacts) {
  const view = document.getElementById('contacts-view');
  if (!contacts.length) {
    view.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">暂无好友</div>';
    return;
  }

  // Group by first letter
  const groups = {};
  contacts.forEach(c => {
    const letter = (c.name.charAt(0).toUpperCase().match(/[A-Z]/) ? c.name.charAt(0).toUpperCase() : '#');
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(c);
  });

  const sections = Object.keys(groups).sort().map(letter => {
    const rows = groups[letter].map(c => `
      <div class="contact-row" data-uid="${c.id}">
        ${c.avatar
          ? `<img src="${escAttr(c.avatar)}" alt="" onerror="this.style.display='none'" />`
          : `<div class="avatar-placeholder" style="border-radius:50%">${c.name.charAt(0)}</div>`}
        <div>
          <div class="contact-name">${escHtml(c.name)}</div>
          ${c.status ? `<div class="contact-status">${escHtml(c.status)}</div>` : ''}
        </div>
      </div>`).join('');
    return `<div class="contact-section">
      <div class="contact-section-title">${escHtml(letter)}</div>
      ${rows}
    </div>`;
  }).join('');

  view.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <h2 style="font-size:18px;font-weight:700">通讯录</h2>
      <button onclick="window._addContact?.()" style="padding:8px 16px;background:var(--green);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px">添加好友</button>
    </div>
    ${sections}
  `;

  view.querySelectorAll('.contact-row').forEach(el => {
    el.addEventListener('click', async () => {
      const uid = el.dataset.uid;
      // Find or create conversation with this user
      const existingConv = state.conversations.find(c => String(c.partnerId) === String(uid));
      if (existingConv) {
        // Switch to chats view and open
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.nav-btn[data-view="chats"]').classList.add('active');
        showPanel('chats');
        openChat(existingConv.id);
      } else {
        // Send a first message to create conversation
        try {
          await api.sendText(uid, '你好！');
          const convRes = await api.conversations();
          const convs = convRes.conversations || convRes || [];
          const newConv = convs.find(c => String(c.partnerId) === String(uid));
          if (newConv) {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.nav-btn[data-view="chats"]').classList.add('active');
            showPanel('chats');
            openChat(newConv.id);
          }
        } catch (err) {
          alert('打开对话失败: ' + err.message);
        }
      }
    });
  });

  window._addContact = async () => {
    const username = prompt('输入用户名或 ID 添加好友:');
    if (!username) return;
    try {
      const usersRes = await api.users({ search: username });
      const users = usersRes.users || usersRes || [];
      if (!users.length) { alert('未找到该用户'); return; }
      const user = users[0];
      await api.addContact(user.id);
      alert(`已添加 ${user.nickname || user.username}`);
      showContacts();
    } catch (err) {
      alert('添加失败: ' + err.message);
    }
  };
}

function showPanel(name) {
  ['chats','contacts','moments','settings'].forEach(n => {
    document.getElementById(`${n}-panel`).classList.toggle('hidden', n !== name);
  });
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escAttr(s) { return String(s).replace(/"/g,'&quot;'); }
