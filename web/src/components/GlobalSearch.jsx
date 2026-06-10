import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import { GroupAvatar } from './GroupInfo';

/**
 * 主搜索框的本地实时检索结果。
 *   - 多维度模糊匹配已有好友（昵称 username / 备注 remark / 微信号 wechat_id）
 *     与已有群聊（群名 name）
 *   - 分类展示：联系人 / 群聊
 *   - 全部无匹配时才降级为「去网络搜索添加好友」
 * 注：好友手机号后端出于隐私不下发，故以微信号 wechat_id 作为号码维度。
 */
function highlight(text, q) {
  const s = String(text || '');
  const i = s.toLowerCase().indexOf(q);
  if (i < 0 || !q) return s;
  return (
    <>
      {s.slice(0, i)}
      <span style={{ color: '#07C160' }}>{s.slice(i, i + q.length)}</span>
      {s.slice(i + q.length)}
    </>
  );
}

const catStyle = {
  fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500,
  padding: '10px 18px 6px', background: 'var(--bg-panel)',
};
const rowStyle = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '10px 18px', cursor: 'pointer',
};

export default function GlobalSearch({ query, onSelectConv, onNetworkSearch }) {
  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    axios.get('/api/users/contacts').then(r => setContacts(r.data || [])).catch(() => {});
    axios.get('/api/messages/conversations').then(r => setConversations(r.data || [])).catch(() => {});
  }, []);

  const q = query.trim().toLowerCase();

  const matchedContacts = useMemo(() => {
    if (!q) return [];
    return contacts.filter(c =>
      (c.remark || '').toLowerCase().includes(q) ||
      (c.username || '').toLowerCase().includes(q) ||
      (c.wechat_id || '').toLowerCase().includes(q)
    );
  }, [contacts, q]);

  const matchedGroups = useMemo(() => {
    if (!q) return [];
    return conversations.filter(c => c.type === 'group' && (c.name || '').toLowerCase().includes(q));
  }, [conversations, q]);

  const openContact = async (c) => {
    try {
      const { data } = await axios.post('/api/messages/conversation/private', { userId: c.id });
      onSelectConv({ id: data.conversationId, type: 'private', name: c.remark || c.username, avatar: c.avatar, otherUser: c });
    } catch {}
  };

  const empty = matchedContacts.length === 0 && matchedGroups.length === 0;

  const hover = (e, on) => { e.currentTarget.style.background = on ? 'var(--bg-hover)' : 'transparent'; };

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      {/* 联系人 */}
      {matchedContacts.length > 0 && (
        <>
          <div style={catStyle}>联系人</div>
          {matchedContacts.map(c => (
            <div key={c.id} style={rowStyle} onClick={() => openContact(c)}
              onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
              <Avatar src={c.avatar} name={c.remark || c.username} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, color: 'var(--text-primary)' }}>{highlight(c.remark || c.username, q)}</div>
                {/* 命中的次要字段提示 */}
                {c.remark && c.username && c.username.toLowerCase().includes(q) && (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>昵称：{highlight(c.username, q)}</div>
                )}
                {c.wechat_id && c.wechat_id.toLowerCase().includes(q) && (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>微信号：{highlight(c.wechat_id, q)}</div>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* 群聊 */}
      {matchedGroups.length > 0 && (
        <>
          <div style={catStyle}>群聊</div>
          {matchedGroups.map(g => (
            <div key={g.id} style={rowStyle} onClick={() => onSelectConv(g)}
              onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
              <GroupAvatar members={g.members || []} avatar={g.avatar} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, color: 'var(--text-primary)' }}>{highlight(g.name, q)}</div>
                {g.group_number && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>群号 {g.group_number}</div>}
              </div>
            </div>
          ))}
        </>
      )}

      {/* 降级兜底：本地全无匹配才出现 */}
      {empty && (
        <div style={{ padding: '8px 0' }}>
          <div
            onClick={() => onNetworkSearch(query)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer' }}
            onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#07C160', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>未找到「{query}」</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 2 }}>去网络搜索添加好友</div>
            </div>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="var(--text-tertiary)" style={{ flexShrink: 0 }}><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </div>
        </div>
      )}
    </div>
  );
}
