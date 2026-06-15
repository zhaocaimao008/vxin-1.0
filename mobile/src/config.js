import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_SERVER = 'https://dipsin.com';
const STORAGE_KEY = 'vxin_server_url';

let _serverUrl = DEFAULT_SERVER;

export async function loadServerUrl() {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) _serverUrl = saved;
  } catch (_) {}
  return _serverUrl;
}

export async function saveServerUrl(url) {
  _serverUrl = url.replace(/\/$/, '');
  try { await AsyncStorage.setItem(STORAGE_KEY, _serverUrl); } catch (_) {}
}

export function getServerUrl() { return _serverUrl; }

// 把后端返回的相对资源路径（/uploads/avatars/...）补成绝对地址。
// RN 的 <Image source={{uri}}> 不支持相对路径，必须拼上服务器地址。
export function mediaUrl(u) {
  if (!u) return u;
  if (/^(https?:|data:|file:|content:)/i.test(u)) return u;
  const base = _serverUrl.replace(/\/$/, '');
  return u.startsWith('/') ? base + u : `${base}/${u}`;
}

export const API_BASE   = () => _serverUrl;
export const SOCKET_URL = () => _serverUrl;
