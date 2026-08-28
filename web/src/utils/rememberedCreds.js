// rememberedCreds.js — 仅保存用户主动选择记住的用户名（手机号）。
// 密码及其他认证凭证绝不写入 localStorage。

const KEY = 'vxin_remembered_usernames_v1';
const LEGACY_CREDS_KEY = 'vxin_remembered_creds_v1';
const LEGACY_SEED_KEY = 'vxin_remembered_key_v1';

function removeLegacyPasswordData() {
  try {
    localStorage.removeItem(LEGACY_CREDS_KEY);
    localStorage.removeItem(LEGACY_SEED_KEY);
  } catch {
    /* localStorage 不可用时静默忽略 */
  }
}

function readAll() {
  removeLegacyPasswordData();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(value => typeof value === 'string' && value) : [];
  } catch {
    return [];
  }
}

function writeAll(usernames) {
  removeLegacyPasswordData();
  try {
    localStorage.setItem(KEY, JSON.stringify(usernames));
  } catch {
    /* localStorage 满/隐私模式：静默忽略，记住用户名仅为便利功能 */
  }
}

/** 保存用户名；重复保存时将其移到末尾，作为最近一次记住的用户名。 */
export function saveRememberedUsername(username) {
  if (!username) return;
  const value = String(username);
  writeAll([...readAll().filter(item => item !== value), value]);
}

/** 是否已记住指定用户名。 */
export function isUsernameRemembered(username) {
  return !!username && readAll().includes(String(username));
}

/** 移除指定用户名。 */
export function removeRememberedUsername(username) {
  if (!username) return;
  const value = String(username);
  writeAll(readAll().filter(item => item !== value));
}

/** 返回最近一次记住的用户名；无则返回空字符串。 */
export function lastRememberedUsername() {
  const usernames = readAll();
  return usernames.length ? usernames[usernames.length - 1] : '';
}
