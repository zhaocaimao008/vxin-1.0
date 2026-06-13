import { state } from '../state.js';
import { api } from '../api.js';

export async function showMoments() {
  document.getElementById('placeholder').classList.add('hidden');
  document.getElementById('chat-view').classList.add('hidden');
  document.getElementById('contacts-view').classList.add('hidden');
  document.getElementById('settings-view').classList.add('hidden');

  const view = document.getElementById('moments-view');
  view.classList.remove('hidden');
  view.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">加载中…</div>';

  try {
    const res = await api.moments();
    const moments = res.moments || res || [];
    renderMoments(moments);
  } catch (err) {
    view.innerHTML = `
      <div class="moments-header">
        <div class="moments-user-avatar">
          <img src="${state.me?.avatar || ''}" alt="" onerror="this.style.display='none'" />
        </div>
        <div class="moments-username">${escHtml(state.me?.nickname || state.me?.username || '')}</div>
      </div>
      <div style="padding:40px;text-align:center;color:var(--text-muted)">朋友圈暂未开放 / 加载失败</div>
    `;
  }
}

function renderMoments(moments) {
  const view = document.getElementById('moments-view');
  const me = state.me || {};
  const avatarHtml = me.avatar ? `<img src="${escAttr(me.avatar)}" alt="" onerror="this.style.display='none'" />` : `<div style="width:56px;height:56px;border-radius:12px;background:var(--green);display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:700;border:3px solid #fff">${(me.nickname||me.username||'').charAt(0)}</div>`;

  const header = `<div class="moments-header">
    <div class="moments-user-avatar">${avatarHtml}</div>
    <div class="moments-username">${escHtml(me.nickname || me.username || '')}</div>
  </div>
  <div style="display:flex;justify-content:flex-end;padding:12px 20px;border-bottom:1px solid var(--panel-border)">
    <button id="btn-post-moment" style="padding:8px 16px;background:var(--green);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px">发朋友圈</button>
  </div>`;

  if (!moments.length) {
    view.innerHTML = header + '<div style="padding:60px;text-align:center;color:var(--text-muted)">还没有朋友圈，来发一条吧</div>';
    bindPostBtn();
    return;
  }

  const cards = moments.map(m => renderMomentCard(m)).join('');
  view.innerHTML = header + cards;
  bindPostBtn();

  view.querySelectorAll('.moment-action-btn[data-like]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const mid = btn.dataset.like;
      await api.likeMoment(mid).catch(console.error);
      showMoments();
    });
  });

  view.querySelectorAll('.moment-action-btn[data-comment]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mid = btn.dataset.comment;
      const text = prompt('发表评论：');
      if (text) api.commentMoment(mid, text).then(() => showMoments()).catch(e => alert(e.message));
    });
  });

  view.querySelectorAll('.moment-img').forEach(img => {
    img.addEventListener('click', () => {
      document.getElementById('lightbox-img').src = img.src;
      document.getElementById('lightbox').classList.remove('hidden');
    });
  });
}

function renderMomentCard(m) {
  const author = m.user || m.author || {};
  const avatarHtml = author.avatar
    ? `<img src="${escAttr(author.avatar)}" alt="" onerror="this.style.display='none'" />`
    : `<div style="width:40px;height:40px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">${(author.nickname||author.username||'?').charAt(0)}</div>`;

  const images = m.images || m.imageUrls || [];
  const imgHtml = images.length
    ? `<div class="moment-images${images.length === 1 ? ' single' : ''}">${images.slice(0,9).map(url => `<img class="moment-img" src="${escAttr(url)}" alt="" onerror="this.style.display='none'" loading="lazy" />`).join('')}</div>`
    : '';

  const likes = m.likes || m.likedBy || [];
  const comments = m.comments || [];
  const likedByMe = likes.some(l => (l.userId || l) === state.me?.id);

  const commentsHtml = comments.length
    ? `<div class="moment-comments">${comments.map(c => {
        const cu = c.user || {};
        return `<div class="moment-comment"><span class="commenter">${escHtml(cu.nickname||cu.username||'')}</span>: ${escHtml(c.content||'')}</div>`;
      }).join('')}</div>` : '';

  return `<div class="moment-card">
    <div class="moment-user">
      <div>${avatarHtml}</div>
      <div class="moment-user-info">
        <div class="name">${escHtml(author.nickname || author.username || '未知')}</div>
        <div class="time">${fmtTime(m.createdAt)}</div>
      </div>
    </div>
    ${m.content ? `<div class="moment-text">${escHtml(m.content)}</div>` : ''}
    ${imgHtml}
    <div class="moment-actions">
      <div class="moment-action-btn" data-like="${m.id}" style="${likedByMe ? 'color:var(--green)' : ''}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="${likedByMe ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        ${likes.length > 0 ? likes.length : ''} 赞
      </div>
      <div class="moment-action-btn" data-comment="${m.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        评论
      </div>
    </div>
    ${commentsHtml}
  </div>`;
}

function bindPostBtn() {
  document.getElementById('btn-post-moment')?.addEventListener('click', async () => {
    const text = prompt('说点什么…');
    if (!text) return;
    try {
      await api.postMoment(text, []);
      showMoments();
    } catch (err) { alert('发布失败: ' + err.message); }
  });
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escAttr(s) { return String(s).replace(/"/g,'&quot;'); }
