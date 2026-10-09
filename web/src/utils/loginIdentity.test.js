import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { initialLoginIdentity, recentAccountIdentity, rememberSuccessfulLogin } from './loginIdentity';
import { removeRememberedUsername } from './rememberedCreds';

beforeEach(() => {
  const values = new Map();
  vi.stubGlobal('localStorage', { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());

it('restores a remembered v信 identifier with the correct method', () => {
  rememberSuccessfulLogin('vxin', '012345', true);
  expect(initialLoginIdentity()).toEqual({ mode: 'vxin', identifier: '012345', remember: true });
});
it('retains the successful method but clears an unchecked identifier', () => {
  rememberSuccessfulLogin('vxin', '123456', true);
  rememberSuccessfulLogin('vxin', '123456', false);
  expect(initialLoginIdentity()).toEqual({ mode: 'vxin', identifier: '', remember: false });
  expect(localStorage.getItem('vxin_remembered_usernames_v1')).toBe('[]');
});
it('migrates an existing remembered phone and removes legacy password storage', () => {
  localStorage.setItem('vxin_remembered_usernames_v1', '["13800138000"]');
  localStorage.setItem('vxin_remembered_creds_v1', 'legacy');
  expect(initialLoginIdentity()).toEqual({ mode: 'phone', identifier: '13800138000', remember: true });
  expect(localStorage.getItem('vxin_remembered_creds_v1')).toBeNull();
});
it('uses the visible v信 ID instead of a synthetic seven-digit phone', () => {
  expect(recentAccountIdentity({ user: { wechat_id: '123456', phone: '0123456' } })).toEqual({ mode: 'vxin', identifier: '123456' });
  expect(recentAccountIdentity({ user: { phone: '13800138000' } })).toEqual({ mode: 'phone', identifier: '13800138000' });
  expect(recentAccountIdentity({ user: { phone: '0123456' } }).identifier).toBe('');
});
it('does not refill removed accounts', () => {
  rememberSuccessfulLogin('phone', '13800138000', true);
  removeRememberedUsername('13800138000');
  expect(initialLoginIdentity().identifier).toBe('');
});
it('survives corrupt or unavailable local storage', () => {
  localStorage.setItem('vxin_login_preference_v1', '{broken');
  expect(initialLoginIdentity().identifier).toBe('');
  vi.stubGlobal('localStorage', { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } });
  expect(() => rememberSuccessfulLogin('vxin', '123456', true)).not.toThrow();
  expect(initialLoginIdentity()).toEqual({ mode: 'phone', identifier: '', remember: false });
});
