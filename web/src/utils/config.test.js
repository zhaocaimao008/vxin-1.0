import { beforeEach, afterEach, expect, it, vi } from 'vitest';

beforeEach(() => { vi.stubGlobal('window', {}); vi.resetModules(); });
afterEach(() => vi.unstubAllGlobals());

it('uses the self-hosted same-origin config before public discovery', async () => {
  vi.stubGlobal('window', { location: { protocol: 'http:', origin: 'http://localhost:8080' } });
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ api: '', socket: '', cdn: '' }) });
  vi.stubGlobal('fetch', fetch);
  const { loadRemoteConfig } = await import('./config');
  expect(await loadRemoteConfig()).toMatchObject({ api: '', socket: '' });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe('http://localhost:8080/config.json');
});

it.each([404, 401, 500])('rejects HTTP %i from a proposed server', async status => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
  const { testServerConnection } = await import('./config');
  expect((await testServerConnection('https://example.test')).ok).toBe(false);
});
it('rejects a generic HTML page or unrelated JSON responding 200', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => { throw Error('HTML'); } })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal('fetch', fetch);
  const { testServerConnection } = await import('./config');
  expect((await testServerConnection('https://example.test')).ok).toBe(false);
  expect((await testServerConnection('https://example.test')).ok).toBe(false);
});
it('accepts a healthy v信 backend', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, db: 'ok', version: 2 }) }));
  const { testServerConnection } = await import('./config');
  expect((await testServerConnection('https://example.test')).ok).toBe(true);
});

it('preserves the desktop custom server without contacting remote discovery', async () => {
  vi.stubGlobal('window', { __ELECTRON_CONFIG__: { serverUrl: 'http://127.0.0.1:19000/', serverUrlManual: true } });
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const { loadRemoteConfig } = await import('./config');
  expect(await loadRemoteConfig()).toMatchObject({ api: 'http://127.0.0.1:19000', socket: 'http://127.0.0.1:19000' });
  expect(fetch).not.toHaveBeenCalled();
});
