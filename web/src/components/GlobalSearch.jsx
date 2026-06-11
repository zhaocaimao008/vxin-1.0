import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import { GroupAvatar } from './GroupInfo';

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
  const [messages, setMessages] = useState([]);
  const [searchingMsg, setSearchingMsg] = useState(false);
  const [convError, setConvError] = useState(null);

  useEffect(() => {
    axios.get('/api/users/contacts')
      .then(r => {
        setContacts(r.data || []);
      })
      .catch(err => {
        console.error('[GlobalSearch] Failed to load contacts:', err.response?.status, err.message);
      });

    axios.get('/api/messages/conversations')
      .then(r => {
        setConversations(r.data || []);
        setConvError(null);
      })
      .catch(err => {
        const errorMsg = err.response?.status === 401
          ? '认证失败，请重新登录'
          : err.response?.data?.error || err.message;
        console.error('[GlobalSearch] Failed to load conversations:', err.response?.status, errorMsg);
        setConvError(errorMsg);
      });
  }, []);

  const q = query.trim().toLowerCase();

  // 搜会话名(联系人、群聊、文件传输助手)
  const matchedContacts = useMemo(() => {
    if (!q) return [];
    return contacts.filter(c =>
      (c.remark || '').toLowerCase().includes(q) ||
      (c.username || '').toLowerCase().includes(q) ||
      (c.wechat_id || '').toLowerCase().includes(q)
    );
  }, [contacts, q]);

  const matchedConversations = useMemo(() => {
    if (!q) return [];
    let results = conversations.filter(c => {
      const nameMatch = (c.name || '').toLowerCase().includes(q);
      const typeMatch = c.type === 'group' || c.type === 'filehelper';
      return nameMatch && typeMatch;
    });

    console.log('[GlobalSearch] q=', q, 'convs=', conversations.length, 'matched=', results.length);

    // 如果搜索词匹配"文件传输助手"但列表中没有，添加虚拟的 filehelper
    const fileHelperName = '文件传输助手';
    const hasFileHelper = conversations.some(c => c.type === 'filehelper');
    if (!hasFileHelper && fileHelperName.toLowerCase().includes(q)) {
      console.log('[GlobalSearch] Adding virtual filehelper for q=', q);
      results = [...results, {
        id: '__file-helper__',
        type: 'filehelper',
        name: fileHelperName,
        avatar: '',
      }];
    }
    return results;
  }, [conversations, q]);

  // 搜历史消息(实时搜，支持单聊和群聊)
  useEffect(() => {
    if (!q || q.length < 1) { setMessages([]); return; }  // 允许单字符搜索
    setSearchingMsg(true);
    axios.get(`/api/messages/search?q=${encodeURIComponent(q)}&limit=20`)
      .then(r => {
        const msgs = (r.data.results || []).map(m => ({
          ...m,
          preview: m.content,
          msgType: m.type,
        }));
        setMessages(msgs);
        console.log('[GlobalSearch] Loaded messages:', msgs.length);
      })
      .catch(err => {
        console.error('[GlobalSearch] Failed to search messages:', err.response?.status, err.message);
        setMessages([]);
      })
      .finally(() => setSearchingMsg(false));
  }, [q]);

  const openContact = async (c) => {
    try {
      const { data } = await axios.post('/api/messages/conversation/private', { userId: c.id });
      onSelectConv({ id: data.conversationId, type: 'private', name: c.remark || c.username, avatar: c.avatar, otherUser: c });
    } catch {}
  };

  const openConversation = (conv) => {
    onSelectConv(conv);
  };

  const openMessageLocation = (msg) => {
    // 定位到消息：打开会话 + 滚到消息位置
    const convObj = {
      id: msg.conversation_id,
      type: msg.convType,
      name: msg.convName,
      avatar: msg.avatar || '',
      scrollToId: msg.id,
    };
    if (msg.otherUser) convObj.otherUser = msg.otherUser;
    onSelectConv(convObj);
  };

  const empty = matchedContacts.length === 0 && matchedConversations.length === 0 && messages.length === 0;

  const hover = (e, on) => { e.currentTarget.style.background = on ? 'var(--bg-hover)' : 'transparent'; };

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      {/* 数据加载状态 */}
      {q && (
        <div style={{ fontSize: 11, color: '#999', padding: '8px 12px', background: '#f5f5f5', borderBottom: '1px solid #eee' }}>
          {convError ? `❌ 群聊加载失败: ${convError}` : `✓ 联系人:${contacts.length} 群聊:${conversations.length} 消息:${messages.length + (searchingMsg ? '+' : '')}`}
        </div>
      )}

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

      {/* 会话(群聊、文件传输助手等) */}
      {matchedConversations.length > 0 && (
        <>
          <div style={catStyle}>{matchedConversations.some(c => c.type === 'filehelper') ? '特殊会话' : '群聊'}</div>
          {matchedConversations.map(g => (
            <div key={g.id} style={rowStyle} onClick={() => openConversation(g)}
              onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
              {g.type === 'filehelper' ? (
                <div style={{ width: 42, height: 42, borderRadius: 10, background: '#10AEFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                </div>
              ) : (
                <GroupAvatar members={g.members || []} avatar={g.avatar} size={42} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, color: 'var(--text-primary)' }}>{highlight(g.name, q)}</div>
                {g.group_number && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>群号 {g.group_number}</div>}
              </div>
            </div>
          ))}
        </>
      )}

      {/* 历史消息 */}
      {messages.length > 0 && (
        <>
          <div style={catStyle}>聊天记录 ({messages.length})</div>
          {messages.map(m => (
            <div key={m.id} style={rowStyle} onClick={() => openMessageLocation(m)}
              onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
              <Avatar src={m.senderAvatar} name={m.senderName} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                  {m.senderName} {m.convType === 'group' ? `在「${m.convName}」` : ''}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {highlight(m.preview || m.content, q)}
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {searchingMsg && (
        <div style={{ textAlign: 'center', padding: '20px 18px', color: 'var(--text-tertiary)', fontSize: 13 }}>搜索中…</div>
      )}

      {/* 降级兜底 */}
      {empty && !searchingMsg && (
        <div
          onClick={() => onNetworkSearch(query)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', cursor: 'pointer', fontSize: 13.5, color: 'var(--text-secondary)' }}
          onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="#07C160" style={{ flexShrink: 0 }}><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <span>未找到相关本地结果，去网络搜索添加<span style={{ color: '#07C160' }}>「{query}」</span></span>
        </div>
      )}
    </div>
  );
}
