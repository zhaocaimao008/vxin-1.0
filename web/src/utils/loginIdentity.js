import { lastRememberedUsername, isUsernameRemembered, saveRememberedUsername, removeRememberedUsername } from './rememberedCreds';

const KEY = 'vxin_login_preference_v1';
const valid = (mode, value) => (mode === 'vxin' ? /^\d{6}$/ : /^\d{11}$/).test(value);

// Preferences contain only the login method and an explicitly remembered identifier.
export function initialLoginIdentity() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && ['phone', 'vxin'].includes(saved.mode)) {
      const identifier = valid(saved.mode, saved.identifier) && isUsernameRemembered(saved.identifier) ? saved.identifier : '';
      return { mode: saved.mode, identifier, remember: !!identifier };
    }
  } catch { /* Storage may be unavailable or contain an old invalid value. */ }
  const identifier = lastRememberedUsername();
  const mode = /^\d{6}$/.test(identifier) ? 'vxin' : 'phone';
  return { mode, identifier: valid(mode, identifier) ? identifier : '', remember: valid(mode, identifier) };
}

export function recentAccountIdentity(account) {
  const id = String(account?.user?.wechat_id || '');
  if (valid('vxin', id)) return { mode: 'vxin', identifier: id };
  const phone = String(account?.user?.phone || '');
  return { mode: 'phone', identifier: valid('phone', phone) ? phone : '' };
}

export function rememberSuccessfulLogin(mode, identifier, remember) {
  if (!['phone', 'vxin'].includes(mode) || !valid(mode, identifier)) return;
  if (remember) saveRememberedUsername(identifier);
  else removeRememberedUsername(identifier);
  try {
    localStorage.setItem(KEY, JSON.stringify({ mode, identifier: remember ? identifier : '' }));
  } catch { /* A storage failure must not prevent successful authentication. */ }
}
