import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, Image, SectionList, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';

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

const TABS = [
  { key: 'contacts', label: '联系人' },
  { key: 'groups', label: '群聊' },
  { key: 'requests', label: '新朋友' },
];

function Avatar({ src, name, size = 44 }) {
  const colors = ['#1ABC9C', '#3498DB', '#9B59B6', '#E67E22', '#E74C3C', '#07C160'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash));
  const bg = colors[Math.abs(hash) % colors.length];
  const letter = (name || '?')[0].toUpperCase();
  if (src) return <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: C.radius }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: C.radius, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '600' }}>{letter}</Text>
    </View>
  );
}

function getInitial(name) {
  if (!name) return '#';
  const c = name[0].toUpperCase();
  if (/[A-Z]/.test(c)) return c;
  // Chinese characters — group under #
  return '#';
}

function buildSections(contacts) {
  const map = {};
  contacts.forEach(c => {
    const key = getInitial(c.remark || c.username || '');
    if (!map[key]) map[key] = [];
    map[key].push(c);
  });
  return Object.keys(map).sort((a, b) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b);
  }).map(title => ({ title, data: map[title] }));
}

export default function ContactsScreen() {
  const [tab, setTab] = useState('contacts');
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const navigation = useNavigation();
  const { socket } = useSocket();
  const sectionListRef = useRef(null);

  const loadAll = useCallback(async () => {
    try {
      setLoadingContacts(true);
      const [cRes, rRes, gRes] = await Promise.allSettled([
        axios.get('/api/users/contacts'),
        axios.get('/api/users/friend-requests'),
        axios.get('/api/messages/my-groups'),
      ]);
      if (cRes.status === 'fulfilled') {
        const d = cRes.value.data;
        setContacts(Array.isArray(d) ? d : (d?.data || []));
      }
      if (rRes.status === 'fulfilled') {
        const d = rRes.value.data;
        setRequests(Array.isArray(d) ? d : (d?.data || []));
      }
      if (gRes.status === 'fulfilled') {
        const d = gRes.value.data;
        setGroups(Array.isArray(d) ? d : (d?.data || []));
      }
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  // Listen for new friend requests via socket
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      axios.get('/api/users/friend-requests')
        .then(r => setRequests(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
        .catch(() => {});
    };
    socket.on('new_friend_request', handler);
    return () => socket.off('new_friend_request', handler);
  }, [socket]);

  const doSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const { data } = await axios.get(`/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchResults(Array.isArray(data) ? data : (data?.data || []));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const sendFriendRequest = async (toId) => {
    try {
      await axios.post('/api/users/friend-request', { toId, message: '你好，请求添加您为好友' });
      Alert.alert('已发送', '好友请求已发送，等待对方确认');
    } catch (err) {
      Alert.alert('发送失败', err.response?.data?.error || '请重试');
    }
  };

  const handleRequest = async (requestId, action) => {
    try {
      await axios.post(`/api/users/friend-request/${requestId}/handle`, { action });
      setRequests(prev => prev.filter(r => r.id !== requestId));
      if (action === 'accepted') {
        axios.get('/api/users/contacts')
          .then(r => setContacts(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
          .catch(() => {});
      }
    } catch (err) {
      Alert.alert('操作失败', err.response?.data?.error || '请重试');
    }
  };

  const startPrivateChat = async (contact) => {
    try {
      const { data } = await axios.post('/api/messages/conversation/private', { userId: contact.id });
      navigation.navigate('Chat', {
        conversation: {
          id: data.conversationId,
          type: 'private',
          name: contact.remark || contact.username,
          avatar: contact.avatar,
          otherUser: contact,
        },
      });
    } catch (err) {
      Alert.alert('错误', err.response?.data?.error || '无法打开会话');
    }
  };

  const openGroupChat = (group) => {
    navigation.navigate('Chat', {
      conversation: {
        id: group.id,
        type: 'group',
        name: group.name,
        avatar: group.avatar,
        memberCount: group.memberCount,
      },
    });
  };

  const sections = buildSections(contacts);
  const sectionTitles = sections.map(s => s.title);
  const requestBadge = requests.length;

  const renderContactItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.75}
      style={styles.contactItem}
      onPress={() => startPrivateChat(item)}
    >
      <Avatar src={item.avatar} name={item.remark || item.username || '?'} />
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.remark || item.username}</Text>
        {item.bio ? <Text style={styles.contactSub} numberOfLines={1}>{item.bio}</Text> : null}
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search bar at top */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="搜索用户 (手机号/v信号/昵称)"
            placeholderTextColor={C.textTip}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={doSearch}
          />
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={doSearch}
            activeOpacity={0.82}
          >
            <Text style={styles.searchBtnText}>搜索</Text>
          </TouchableOpacity>
        </View>

        {/* Search results */}
        {(searchResults.length > 0 || searching) && (
          <View style={styles.searchResults}>
            {searching ? (
              <ActivityIndicator color={C.green} style={{ padding: 12 }} />
            ) : (
              searchResults.map(item => (
                <View key={item.id} style={styles.searchResultItem}>
                  <Avatar src={item.avatar} name={item.username || '?'} size={40} />
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName}>{item.username}</Text>
                    <Text style={styles.searchResultSub} numberOfLines={1}>
                      {item.wechat_id ? `v信号: ${item.wechat_id}` : item.phone}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.addFriendBtn}
                    onPress={() => sendFriendRequest(item.id)}
                    activeOpacity={0.82}
                  >
                    <Text style={styles.addFriendBtnText}>申请添加</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
            <TouchableOpacity
              style={styles.clearSearchBtn}
              onPress={() => { setSearchResults([]); setSearchQuery(''); }}
            >
              <Text style={styles.clearSearchText}>关闭搜索结果</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.75}
          >
            <View style={styles.tabLabelWrap}>
              <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
                {t.label}
              </Text>
              {t.key === 'requests' && requestBadge > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{requestBadge > 99 ? '99+' : requestBadge}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      {tab === 'contacts' && (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {loadingContacts ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={C.green} size="large" />
            </View>
          ) : sections.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>暂无联系人</Text>
              <Text style={styles.emptySubText}>在上方搜索框添加好友</Text>
            </View>
          ) : (
            <>
              <SectionList
                ref={sectionListRef}
                style={{ flex: 1 }}
                sections={sections}
                keyExtractor={item => item.id}
                renderItem={renderContactItem}
                renderSectionHeader={renderSectionHeader}
                stickySectionHeadersEnabled
              />
              {/* Letter index */}
              <View style={styles.letterIndex}>
                {sectionTitles.map((letter, idx) => (
                  <TouchableOpacity
                    key={letter}
                    onPress={() => sectionListRef.current?.scrollToLocation({ sectionIndex: idx, itemIndex: 0, animated: true })}
                    activeOpacity={0.5}
                  >
                    <Text style={styles.letterIndexItem}>{letter}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {tab === 'groups' && (
        <FlatList
          data={groups}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.contactItem}
              onPress={() => openGroupChat(item)}
            >
              <Avatar src={item.avatar} name={item.name || '群聊'} />
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{item.name || '未命名群聊'}</Text>
                <Text style={styles.contactSub}>{item.memberCount || 0} 位成员</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>暂无群聊</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {tab === 'requests' && (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.requestItem}>
              <Avatar src={item.avatar || item.fromUser?.avatar} name={item.fromUser?.username || item.username || '?'} />
              <View style={styles.requestInfo}>
                <Text style={styles.requestName}>{item.fromUser?.username || item.username || '未知用户'}</Text>
                <Text style={styles.requestMsg} numberOfLines={2}>
                  {item.message || '请求添加您为好友'}
                </Text>
              </View>
              <View style={styles.requestActions}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => handleRequest(item.id, 'accepted')}
                  activeOpacity={0.82}
                >
                  <Text style={styles.acceptBtnText}>接受</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => handleRequest(item.id, 'rejected')}
                  activeOpacity={0.72}
                >
                  <Text style={styles.rejectBtnText}>拒绝</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>没有新的好友请求</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  // Search
  searchSection: {
    backgroundColor: C.bgCard,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: C.bgInput,
    borderRadius: C.radius,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: C.text,
    height: 38,
  },
  searchBtn: {
    backgroundColor: C.green,
    borderRadius: C.radius,
    paddingHorizontal: 14,
    paddingVertical: 9,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchResults: {
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingBottom: 4,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
  },
  searchResultSub: {
    fontSize: 12,
    color: C.textSub,
    marginTop: 2,
  },
  addFriendBtn: {
    backgroundColor: C.green,
    borderRadius: C.radius,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addFriendBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  clearSearchBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    marginTop: 4,
  },
  clearSearchText: {
    fontSize: 13,
    color: C.textSub,
  },
  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.bgCard,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: C.green,
  },
  tabLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 14,
    color: C.textSub,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: C.green,
    fontWeight: '700',
  },
  tabBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
  },
  // Contacts list
  sectionHeader: {
    backgroundColor: C.bg,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSub,
    textTransform: 'uppercase',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: C.bgCard,
    gap: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
  },
  contactSub: {
    fontSize: 12,
    color: C.textSub,
    marginTop: 2,
  },
  separator: {
    height: 0.5,
    backgroundColor: C.border,
    marginLeft: 70,
  },
  // Letter index
  letterIndex: {
    position: 'absolute',
    right: 2,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  letterIndexItem: {
    fontSize: 10,
    color: C.green,
    fontWeight: '600',
    paddingVertical: 1.5,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  // Friend requests
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.bgCard,
    gap: 12,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
    marginBottom: 3,
  },
  requestMsg: {
    fontSize: 13,
    color: C.textSub,
    lineHeight: 18,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    backgroundColor: C.green,
    borderRadius: C.radius,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  rejectBtn: {
    backgroundColor: C.bg,
    borderRadius: C.radius,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.border,
  },
  rejectBtnText: {
    color: C.textSub,
    fontSize: 13,
  },
  // Empty / loading
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyText: {
    fontSize: 15,
    color: C.textSub,
    marginBottom: 6,
  },
  emptySubText: {
    fontSize: 13,
    color: C.textTip,
  },
});
