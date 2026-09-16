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

it('desktop probes a new origin via the restricted main-process health API', async () => {
  const testServerUrl = vi.fn().mockResolvedValue({ ok: true, msg: '连接成功 ✓' });
  vi.stubGlobal('window', { __ELECTRON_CONFIG__: {}, electronAPI: { testServerUrl } });
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const { testServerConnection } = await import('./config');
  expect((await testServerConnection('http://127.0.0.1:18000/')).ok).toBe(true);
  expect(testServerUrl).toHaveBeenCalledWith('http://127.0.0.1:18000');
  expect(fetch).not.toHaveBeenCalled();
});

it.each(['httpx://bad.test', 'http:bad.test', 'https://user:secret@example.test', 'https://example.test?api=1', 'https://example.test/#page'])('rejects unsafe server addresses before making a request: %s', async url => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const { testServerConnection, normalizeServerUrl } = await import('./config');
  expect(normalizeServerUrl(url)).toBeNull();
  expect((await testServerConnection(url)).ok).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
});

it('preserves the desktop custom server without contacting remote discovery', async () => {
  vi.stubGlobal('window', { __ELECTRON_CONFIG__: { serverUrl: 'http://127.0.0.1:19000/', serverUrlManual: true } });
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const { loadRemoteConfig } = await import('./config');
  expect(await loadRemoteConfig()).toMatchObject({ api: 'http://127.0.0.1:19000', socket: 'http://127.0.0.1:19000' });
  expect(fetch).not.toHaveBeenCalled();
});
