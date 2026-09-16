import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('./config', () => ({ isConfigLoaded: () => false }));
import { mediaUrl } from './url';

beforeEach(() => {
  const data = new Map([['vxin_server_url', 'https://api.example.test'], ['vxin_electron_token', 'current-token']]);
  vi.stubGlobal('localStorage', { getItem: key => data.get(key) || null, removeItem: key => data.delete(key) });
  vi.stubGlobal('window', { __ELECTRON_CONFIG__: {}, location: { origin: 'https://www.example.test' } });
});
afterEach(() => vi.unstubAllGlobals());

it('authenticates a relative protected desktop image', () => {
  expect(mediaUrl('/uploads/avatars/a.png')).toBe('https://api.example.test/uploads/avatars/a.png?token=current-token');
});
it('authenticates absolute protected images belonging to the selected backend', () => {
  expect(mediaUrl('https://api.example.test/uploads/files/a.png')).toBe('https://api.example.test/uploads/files/a.png?token=current-token');
});
it('replaces an obsolete query token before the fragment', () => {
  expect(mediaUrl('/uploads/files/a.png?token=old#preview')).toBe('https://api.example.test/uploads/files/a.png?token=current-token#preview');
});
it.each(['https://external.example/uploads/a.png', '//external.example/uploads/a.png'])('does not disclose credentials to %s', src => {
  const url = mediaUrl(src);
  expect(url).not.toContain('current-token');
  expect(new URL(url, window.location.origin).hostname).toBe('external.example');
});
it('web media follows the configured API origin without a bearer query', () => {
  delete window.__ELECTRON_CONFIG__;
  expect(mediaUrl('/uploads/avatars/a.png')).toBe('https://api.example.test/uploads/avatars/a.png');
});
it('unconfigured same-origin web media remains relative', () => {
  delete window.__ELECTRON_CONFIG__;
  localStorage.removeItem('vxin_server_url');
  expect(mediaUrl('/uploads/avatars/a.png')).toBe('/uploads/avatars/a.png');
});
it('does not attach a token to ordinary external or public paths', () => {
  expect(mediaUrl('https://api.example.test/downloads/a.png')).toBe('https://api.example.test/downloads/a.png');
  expect(mediaUrl('blob:https://api.example.test/example')).toBe('blob:https://api.example.test/example');
});
