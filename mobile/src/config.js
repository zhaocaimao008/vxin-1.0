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

export const API_BASE   = () => _serverUrl;
export const SOCKET_URL = () => _serverUrl;
