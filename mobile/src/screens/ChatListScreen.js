import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Image, RefreshControl, ActivityIndicator,
  Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { mediaUrl } from '../config';

const C = {
  nav: '#1A2033',
  green: '#07C160',
  greenLight: '#E8F8EE',
  bg: '#F7F8FA',
  bgCard: '#FFFFFF',
  bgInput: '#ECEEF2',
  text: '#1F2D3D',
  textSub: '#7A8694',
  textTip: '#B0BAC5',
  border: '#E8ECF0',
  red: '#FA5151',
  radius: 8,
  radiusLg: 12,
};

function Avatar({ src, name, size = 46 }) {
  const colors = ['#1ABC9C', '#3498DB', '#9B59B6', '#E67E22', '#E74C3C', '#07C160'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash));
  const bg = colors[Math.abs(hash) % colors.length];
  const letter = (name || '?')[0].toUpperCase();
  if (src) return <Image source={{ uri: mediaUrl(src) }} style={{ width: size, height: size, borderRadius: C.radius }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: C.radius, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '600' }}>{letter}</Text>
    </View>
  );
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);

  if (d >= todayStart) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (d >= yesterdayStart) return '昨天';
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

function previewText(conv) {
  const t = conv.lastMessageType;
  if (t === 'image') return '[图片]';
  if (t === 'file') return '[文件]';
  if (t === 'voice') return '[语音]';
  if (t === 'video') return '[视频]';
  if (t === 'red_packet') return '[红包]';
  if (t === 'contact_card' || t === 'contact') return '[名片]';
  if (t === 'sticker') return '[表情]';
  return conv.lastMessage || '';
}

// Compose icon (pencil + square)
function ComposeIcon() {
  return (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 16, height: 16,
        borderWidth: 1.6, borderColor: C.text,
        borderRadius: 3,
      }} />
      <View style={{
        position: 'absolute', bottom: 1, right: 1,
        width: 10, height: 10,
        backgroundColor: C.bg,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 12, color: C.text, fontWeight: '700', lineHeight: 14 }}>+</Text>
      </View>
    </View>
  );
}

export default function ChatListScreen() {
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [msgResults, setMsgResults] = useState([]);
  const [searchingMsg, setSearchingMsg] = useState(false);
  const navigation = useNavigation();
  const { socket } = useSocket();
  const { user } = useAuth();
  const convMapRef = useRef({});
  const insets = useSafeAreaInsets();

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await axios.get('/api/messages/conversations');
      const list = Array.isArray(data) ? data : (data?.data || []);
      setConversations(list);
      // Build a quick-lookup map
      const map = {};
      list.forEach(c => { map[c.id] = c; });
      convMapRef.current = map;
    } catch (_) {
      // ignore network errors silently on focus refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh list when this tab gets focus
  useFocusEffect(useCallback(() => {
    loadConversations(true);
  }, [loadConversations]));

  // Initial load
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Listen for new messages via shared socket — update last message + unread
  useEffect(() => {
    if (!socket) return;

    const previewOf = (m) => ({
      image: '[图片]', file: '[文件]', voice: '[语音]', video: '[视频]',
      red_packet: '[红包]', contact_card: '[名片]', contact: '[名片]', sticker: '[表情]',
    }[m.type] || m.content);

    const handleNewMessage = (msg) => {
      const isMine = String(msg.senderId || msg.sender_id) === String(user?.id);
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === msg.conversation_id);
        if (idx === -1) {
          // Unknown conversation — trigger a silent refresh
          loadConversations(true);
          return prev;
        }
        const updated = {
          ...prev[idx],
          lastMessage: previewOf(msg),
          lastMessageType: msg.type,
          lastTime: msg.created_at || Math.floor(Date.now() / 1000),
          // 自己发的消息不计未读
          unreadCount: isMine ? (prev[idx].unreadCount || 0) : (prev[idx].unreadCount || 0) + 1,
        };
        const next = [updated, ...prev.filter((_, i) => i !== idx)];
        return next;
      });
    };

    socket.on('new_message', handleNewMessage);
    return () => socket.off('new_message', handleNewMessage);
  }, [socket, loadConversations, user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const filtered = search.trim()
    ? conversations.filter(c => (c.name || '').toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const openChat = (conv) => {
    // Clear unread badge immediately in UI
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c));
    navigation.navigate('Chat', { conversation: conv });
  };

  // 全局搜索：联系人本地过滤 + 历史消息走接口（去抖 250ms）
  useEffect(() => {
    if (!search.trim() && contacts.length === 0) {
      axios.get('/api/users/contacts').then(r => setContacts(r.data || [])).catch(() => {});
    }
  }, [search]);

  useEffect(() => {
    const q = search.trim();
    if (!q) { setMsgResults([]); setSearchingMsg(false); return; }
    setSearchingMsg(true);
    const t = setTimeout(() => {
      axios.get(`/api/messages/search?q=${encodeURIComponent(q)}&limit=20`)
        .then(r => setMsgResults(r.data.results || []))
        .catch(() => setMsgResults([]))
        .finally(() => setSearchingMsg(false));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const openContact = async (c) => {
    try {
      const { data } = await axios.post('/api/messages/conversation/private', { userId: c.id });
      navigation.navigate('Chat', { conversation: { id: data.conversationId, type: 'private', name: c.remark || c.username, avatar: c.avatar, otherUser: c } });
    } catch (_) {}
  };

  const openMsgLocation = (m) => {
    navigation.navigate('Chat', { conversation: { id: m.conversation_id, type: m.convType, name: m.convName, avatar: m.avatar || '', scrollToId: m.id } });
  };

  const q = search.trim().toLowerCase();
  const matchedContacts = q ? contacts.filter(c =>
    (c.remark || '').toLowerCase().includes(q) ||
    (c.username || '').toLowerCase().includes(q) ||
    (c.wechat_id || '').toLowerCase().includes(q)
  ) : [];
  const matchedGroups = q ? conversations.filter(c => c.type === 'group' && (c.name || '').toLowerCase().includes(q)) : [];

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.75}
      style={styles.item}
      onPress={() => openChat(item)}
    >
      <View style={styles.avatarWrap}>
        <Avatar src={item.avatar} name={item.name || '?'} />
        {item.unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {item.unreadCount > 99 ? '99+' : item.unreadCount}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>{item.name || '未命名'}</Text>
          <Text style={styles.time}>{formatTime(item.lastTime)}</Text>
        </View>
        <View style={styles.bottomRow}>
          <Text
            style={[styles.preview, item.unreadCount > 0 && styles.previewUnread]}
            numberOfLines={1}
          >
            {previewText(item)}
          </Text>
          {/* muted indicator could go here */}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>消息</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          activeOpacity={0.72}
          onPress={() => Alert.alert('发起会话', '', [
            { text: '发起群聊', onPress: () => navigation.navigate('NewGroup') },
            { text: '添加朋友', onPress: () => navigation.navigate('Contacts') },
            { text: '取消', style: 'cancel' },
          ])}
        >
          <ComposeIcon />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <View style={styles.searchIconWrap}>
            <View style={styles.searchCircle} />
            <View style={styles.searchHandle} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="搜索"
            placeholderTextColor={C.textTip}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
        </View>
      </View>

      {loading && conversations.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={C.green} size="large" />
        </View>
      ) : q ? (
        /* ── 全局搜索结果 ── */
        <FlatList
          keyExtractor={(item) => item._key}
          data={[
            ...matchedContacts.map(c => ({ _key: 'c' + c.id, _kind: 'contact', data: c })),
            ...matchedGroups.map(g => ({ _key: 'g' + g.id, _kind: 'group', data: g })),
            ...msgResults.map(m => ({ _key: 'm' + m.id, _kind: 'msg', data: m })),
          ]}
          renderItem={({ item }) => (
            <SearchRow item={item} q={q} onContact={openContact} onGroup={openChat} onMsg={openMsgLocation} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{searchingMsg ? '搜索中…' : '没有找到相关结果'}</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.green}
              colors={[C.green]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>v</Text>
              </View>
              <Text style={styles.emptyText}>暂无会话{'\n'}开始和同事聊天吧</Text>
            </View>
          }
          contentContainerStyle={filtered.length === 0 ? { flex: 1 } : null}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

// 搜索结果行（联系人/群聊/历史消息）
function SearchRow({ item, q, onContact, onGroup, onMsg }) {
  const { _kind, data } = item;
  if (_kind === 'contact') {
    return (
      <TouchableOpacity style={styles.item} activeOpacity={0.72} onPress={() => onContact(data)}>
        <Avatar src={data.avatar} name={data.remark || data.username} />
        <View style={styles.info}><Text style={styles.name} numberOfLines={1}>{data.remark || data.username}</Text>
          <Text style={styles.preview} numberOfLines={1}>联系人</Text></View>
      </TouchableOpacity>
    );
  }
  if (_kind === 'group') {
    return (
      <TouchableOpacity style={styles.item} activeOpacity={0.72} onPress={() => onGroup(data)}>
        <Avatar src={data.avatar} name={data.name} />
        <View style={styles.info}><Text style={styles.name} numberOfLines={1}>{data.name}</Text>
          <Text style={styles.preview} numberOfLines={1}>群聊</Text></View>
      </TouchableOpacity>
    );
  }
  // msg
  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.72} onPress={() => onMsg(data)}>
      <Avatar src={data.senderAvatar} name={data.senderName} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{data.senderName}{data.convType === 'group' ? ` · ${data.convName}` : ''}</Text>
        <Text style={styles.preview} numberOfLines={1}>{data.content}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.bgCard,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  headerBtn: {
    padding: 4,
  },
  searchWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.bgCard,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgInput,
    borderRadius: C.radius,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  searchIconWrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchCircle: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 1.5,
    borderColor: C.textTip,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  searchHandle: {
    width: 5,
    height: 1.5,
    backgroundColor: C.textTip,
    position: 'absolute',
    bottom: 0,
    right: 0,
    transform: [{ rotate: '45deg' }],
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.text,
    paddingVertical: 0,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.bgCard,
    gap: 12,
  },
  avatarWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: C.bgCard,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 11,
    color: C.textTip,
    flexShrink: 0,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preview: {
    fontSize: 13,
    color: C.textSub,
    flex: 1,
  },
  previewUnread: {
    color: C.text,
  },
  separator: {
    height: 0.5,
    backgroundColor: C.border,
    marginLeft: 74,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    opacity: 0.2,
  },
  emptyIconText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    color: C.textSub,
    textAlign: 'center',
    lineHeight: 22,
  },
});
