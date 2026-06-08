import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Avatar from './Avatar';
import { GroupAvatar } from './GroupInfo';

/*
  转发消息弹窗
  ─────────────
  支持：
  - 选择好友（全选/单选）
  - 选择群聊（全选/单选）
  - 搜索过滤
  - 确认转发，显示结果
*/
export default function ForwardModal({ message, onClose }) {
  const [tab, setTab] = useState('friends');    // 'friends' | 'groups'
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(new Set()); // conversationId set
  const [friendConvMap, setFriendConvMap] = useState({}); // userId -> convId
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  useEffect(() => {
    // 加载好友列表
    axios.get('/api/users/contacts').then(r => setFriends(r.data));
    // 加载群聊列表
    axios.get('/api/messages/my-groups').then(r => setGroups(r.data));
  }, []);

  // 过滤逻辑
  const filteredFriends = useMemo(() =>
    friends.filter(f => (f.remark || f.username).toLowerCase().includes(search.toLowerCase())),
    [friends, search]
  );
  const filteredGroups = useMemo(() =>
    groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase())),
    [groups, search]
  );

  // 切换单个好友（需要先获取/创建私聊会话）
  const toggleFriend = async (friend) => {
    if (friendConvMap[friend.id]) {
      const convId = friendConvMap[friend.id];
      setSelected(prev => { const s = new Set(prev); s.has(convId) ? s.delete(convId) : s.add(convId); return s; });
      return;
    }
    // 获取私聊会话ID
    const { data } = await axios.post('/api/messages/conversation/private', { userId: friend.id });
    const convId = data.conversationId;
    setFriendConvMap(prev => ({ ...prev, [friend.id]: convId }));
    setSelected(prev => { const s = new Set(prev); s.add(convId); return s; });
  };

  const isFriendSelected = (friend) => {
    const convId = friendConvMap[friend.id];
    return convId ? selected.has(convId) : false;
  };

  // 全选好友
  const selectAllFriends = async () => {
    const allSelected = filteredFriends.every(f => isFriendSelected(f));
    if (allSelected) {
      // 取消全选
      const toRemove = filteredFriends.map(f => friendConvMap[f.id]).filter(Boolean);
      setSelected(prev => { const s = new Set(prev); toRemove.forEach(id => s.delete(id)); return s; });
    } else {
      // 全选（需要获取所有会话）
      const promises = filteredFriends.filter(f => !friendConvMap[f.id]).map(f =>
        axios.post('/api/messages/conversation/private', { userId: f.id }).then(r => ({ uid: f.id, convId: r.data.conversationId }))
      );
      const results = await Promise.all(promises);
      const newMap = { ...friendConvMap };
      results.forEach(({ uid, convId }) => { newMap[uid] = convId; });
      setFriendConvMap(newMap);
      setSelected(prev => {
        const s = new Set(prev);
        filteredFriends.forEach(f => { const id = newMap[f.id]; if (id) s.add(id); });
        return s;
      });
    }
  };

  // 切换群聊
  const toggleGroup = (group) => {
    setSelected(prev => { const s = new Set(prev); s.has(group.id) ? s.delete(group.id) : s.add(group.id); return s; });
  };

  // 全选群聊
  const selectAllGroups = () => {
    const allSelected = filteredGroups.every(g => selected.has(g.id));
    setSelected(prev => {
      const s = new Set(prev);
      if (allSelected) { filteredGroups.forEach(g => s.delete(g.id)); }
      else { filteredGroups.forEach(g => s.add(g.id)); }
      return s;
    });
  };

  // 执行转发
  const forward = async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      const { data } = await axios.post('/api/messages/forward', {
        msgId: message.id,
        conversationIds: [...selected]
      });
      setSentCount(data.sent);
      setDone(true);
    } catch (e) {
      alert(e.response?.data?.error || '转发失败');
    }
    setSending(false);
  };

  // 消息预览
  const msgPreview = () => {
    if (!message) return '';
    if (message.type === 'image') return '[图片]';
    if (message.type === 'file') return `[文件] ${message.content}`;
    if (message.type === 'voice') return '[语音]';
    return message.content?.slice(0, 40) + (message.content?.length > 40 ? '...' : '');
  };

  const allFriendsSelected = filteredFriends.length > 0 && filteredFriends.every(f => isFriendSelected(f));
  const allGroupsSelected = filteredGroups.length > 0 && filteredGroups.every(g => selected.has(g.id));

  return (
    <div className="wc-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="wc-modal wide" style={{ width: 480, height: 560 }}>

        {/* 标题栏 */}
        <div className="wc-modal-header">
          <span className="wc-modal-title">转发消息</span>
          <button className="wc-modal-close" onClick={onClose}>✕</button>
        </div>

        {done ? (
          /* 成功状态 */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '32px 24px 28px' }}>
            {/* 动态对勾圆圈 */}
            <div style={{
              width: 64, height: 64, borderRadius: 32,
              background: 'linear-gradient(135deg, #07C160, #06AE56)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(7,193,96,.35)',
              marginBottom: 20,
            }}>
              <svg viewBox="0 0 24 24" style={{ width: 32, height: 32, fill: 'none', stroke: '#fff', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#191919', marginBottom: 6 }}>
              转发成功
            </div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 28 }}>
              已发送给 <span style={{ color: '#07C160', fontWeight: 600 }}>{sentCount}</span> 个会话
            </div>
            <button
              onClick={onClose}
              style={{
                width: '100%', padding: '11px 0',
                background: '#07C160', color: '#fff',
                borderRadius: 8, fontSize: 15, fontWeight: 500,
                cursor: 'pointer', border: 'none',
                transition: 'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#06AE56'}
              onMouseLeave={e => e.currentTarget.style.background = '#07C160'}
            >
              完成
            </button>
          </div>
        ) : (
          <>
            {/* 消息预览 */}
            <div style={{ padding: '10px 16px', background: '#F7F7F7', borderBottom: '1px solid #EBEBEB', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#888' }}>转发内容：</span>
              <span style={{ fontSize: 13, color: '#555', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msgPreview()}</span>
            </div>

            {/* 搜索栏 */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #EBEBEB' }}>
              <div className="wc-search" style={{ height: 30 }}>
                <span className="wc-search-icon">
                  <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, fill: 'var(--text-tertiary)' }}>
                    <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                  </svg>
                </span>
                <input placeholder="搜索" value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 13 }} />
              </div>
            </div>

            {/* Tab 切换 */}
            <div style={{ display: 'flex', borderBottom: '1px solid #EBEBEB', flexShrink: 0 }}>
              {[['friends','好友'], ['groups','群聊']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: tab === key ? 600 : 400, color: tab === key ? '#07C160' : '#888', borderBottom: tab === key ? '2px solid #07C160' : '2px solid transparent', background: 'transparent', transition: 'all .1s' }}
                >
                  {label} ({key === 'friends' ? filteredFriends.length : filteredGroups.length})
                </button>
              ))}
            </div>

            {/* 列表 */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* 全选行 */}
              {tab === 'friends' && filteredFriends.length > 0 && (
                <div
                  style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', gap: 10, cursor: 'pointer', borderBottom: '1px solid #F5F5F5', background: '#FAFAFA' }}
                  onClick={selectAllFriends}
                >
                  <div className={`wc-group-check${allFriendsSelected ? ' checked' : ''}`}>{allFriendsSelected ? '✓' : ''}</div>
                  <span style={{ fontSize: 14, color: '#555', fontWeight: 500 }}>全选好友 ({filteredFriends.length}人)</span>
                </div>
              )}
              {tab === 'groups' && filteredGroups.length > 0 && (
                <div
                  style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', gap: 10, cursor: 'pointer', borderBottom: '1px solid #F5F5F5', background: '#FAFAFA' }}
                  onClick={selectAllGroups}
                >
                  <div className={`wc-group-check${allGroupsSelected ? ' checked' : ''}`}>{allGroupsSelected ? '✓' : ''}</div>
                  <span style={{ fontSize: 14, color: '#555', fontWeight: 500 }}>全选群聊 ({filteredGroups.length}个)</span>
                </div>
              )}

              {/* 好友列表 */}
              {tab === 'friends' && filteredFriends.map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', gap: 10, cursor: 'pointer', borderBottom: '1px solid #F5F5F5', transition: 'background .08s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8F8F8'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                  onClick={() => toggleFriend(f)}>
                  <div className={`wc-group-check${isFriendSelected(f) ? ' checked' : ''}`}>{isFriendSelected(f) ? '✓' : ''}</div>
                  <Avatar src={f.avatar} name={f.remark || f.username} size={38} />
                  <span style={{ fontSize: 14, flex: 1 }}>{f.remark || f.username}</span>
                </div>
              ))}
              {tab === 'friends' && filteredFriends.length === 0 && (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#B2B2B2', fontSize: 13 }}>暂无好友</div>
              )}

              {/* 群聊列表 */}
              {tab === 'groups' && filteredGroups.map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', gap: 10, cursor: 'pointer', borderBottom: '1px solid #F5F5F5', transition: 'background .08s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8F8F8'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                  onClick={() => toggleGroup(g)}>
                  <div className={`wc-group-check${selected.has(g.id) ? ' checked' : ''}`}>{selected.has(g.id) ? '✓' : ''}</div>
                  <GroupAvatar members={g.members || []} avatar={g.avatar || g.groupAvatar} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                    <div style={{ fontSize: 11, color: '#B2B2B2' }}>{g.memberCount}人</div>
                  </div>
                </div>
              ))}
              {tab === 'groups' && filteredGroups.length === 0 && (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#B2B2B2', fontSize: 13 }}>暂无群聊</div>
              )}
            </div>

            {/* 底部确认栏 */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid #EBEBEB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: '#888' }}>
                已选 {selected.size} 个
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="wc-modal-btn secondary" style={{ padding: '7px 20px' }} onClick={onClose}>取消</button>
                <button
                  className="wc-modal-btn primary"
                  style={{ padding: '7px 24px', opacity: selected.size === 0 ? 0.5 : 1 }}
                  onClick={forward}
                  disabled={selected.size === 0 || sending}
                >
                  {sending ? '发送中...' : `发送 ${selected.size > 0 ? `(${selected.size})` : ''}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
