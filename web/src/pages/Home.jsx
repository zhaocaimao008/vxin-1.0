import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import ContactList from '../components/ContactList';
import Discover from '../components/Discover';
import Moments from '../components/Moments';
import Profile from '../components/Profile';
import Avatar from '../components/Avatar';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

/* 微信 PC 空状态 — 双气泡 Logo + 灰底 */
function WcEmpty() {
  return (
    <div className="wc-empty">
      {/* WeChat two-bubble logo */}
      <svg viewBox="0 0 62 52" style={{ width: 62, height: 52, marginBottom: 14 }}>
        {/* 后气泡（浅绿，左上） */}
        <path
          fill="rgba(7,193,96,0.55)"
          d="M20 1C9.5 1 1 7.8 1 16.2c0 4.7 2.5 8.9 6.5 11.7l-1.2 5.8
             6.8-3.9c2.2.5 4.5.8 6.9.8 10.5 0 19-6.8 19-15.2S30.5 1 20 1z"
        />
        {/* 前气泡（实绿，右下） */}
        <path
          fill="#07C160"
          d="M40 13C28.4 13 19 20.5 19 29.7c0 5.3 2.9 10 7.6 13.1l-1.3 6.2
             7.8-4.6c2.5.6 5.1.9 7.9.9 11.6 0 21-7.5 21-16.7S51.6 13 40 13z"
        />
      </svg>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', letterSpacing: '.3px' }}>微信</p>
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState('chats');
  const [subView, setSubView] = useState(null); // 'moments'
  const [activeConv, setActiveConv] = useState(null);
  const [unread, setUnread] = useState({});
  const [friendReqCount, setFriendReqCount] = useState(0);
  const { socket } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    axios.get('/api/users/friend-requests').then(r => setFriendReqCount(r.data.length));
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onMsg = (msg) => {
      setUnread(prev => {
        if (msg.conversation_id === activeConv?.id) return prev;
        return { ...prev, [msg.conversation_id]: (prev[msg.conversation_id] || 0) + 1 };
      });
    };
    const onFriendReq = () => setFriendReqCount(prev => prev + 1);
    socket.on('new_message', onMsg);
    socket.on('new_friend_request', onFriendReq);
    return () => { socket.off('new_message', onMsg); socket.off('new_friend_request', onFriendReq); };
  }, [socket, activeConv?.id]);

  const handleSelectConv = useCallback((conv) => {
    setActiveConv(conv);
    setUnread(prev => ({ ...prev, [conv.id]: 0 }));
    setTab('chats');
    setSubView(null);
  }, []);

  const handleTabChange = (t) => {
    setTab(t);
    setSubView(null);
    if (t === 'contacts') setFriendReqCount(0);
  };

  const handleNavigate = (view) => {
    setSubView(view);
  };

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  const badges = { chats: totalUnread, contacts: friendReqCount };

  const renderMain = () => {
    if (subView === 'moments') {
      return <Moments onBack={() => setSubView(null)} />;
    }
    switch (tab) {
      case 'chats':
        return <ChatList onSelectConv={handleSelectConv} activeConvId={activeConv?.id} unread={unread} />;
      case 'contacts':
        return <ContactList onStartChat={(conv) => { handleSelectConv(conv); }} />;
      case 'discover':
        return <Discover onNavigate={handleNavigate} />;
      case 'profile':
        return <Profile onNavigate={handleNavigate} />;
      default:
        return null;
    }
  };

  return (
    <div className="wc-app">
      <Sidebar tab={tab} onTabChange={handleTabChange} badges={badges} />
      <div className="wc-panel">{renderMain()}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeConv
          ? <ChatWindow conversation={activeConv} onClose={() => setActiveConv(null)} />
          : <WcEmpty />
        }
      </div>
    </div>
  );
}
