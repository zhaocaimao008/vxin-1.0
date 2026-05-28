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
          : (
            <div className="wc-empty">
              <div style={{ fontSize: 60, marginBottom: 8 }}>💬</div>
              <p>选择一个聊天开始对话</p>
            </div>
          )
        }
      </div>
    </div>
  );
}
