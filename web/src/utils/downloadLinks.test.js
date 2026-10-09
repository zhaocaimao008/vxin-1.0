import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('./config', () => ({ timeoutSignal: () => undefined }));
import { androidDownloadUrl, windowsDownloadUrl, loadDownloadLinks, DOWNLOAD_FALLBACK } from './downloadLinks';
const origin = 'https://liaotian99.com';
const windows = { versionName: '8.0.20', url: origin + '/downloads/releases/vxin-8.0.20-setup.exe' };
const android = { versionName: '8.0.9', url: origin + '/downloads/vxin-android-8.0.9.apk' };
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

it('offers the verified Windows installer from the manual download catalogue', () => {
  expect(windowsDownloadUrl(windows, origin)).toBe(windows.url);
});
it.each([null, {}, { ...windows, versionName: '8.0.21' },
  { ...windows, url: 'https://evil.test/downloads/releases/vxin-8.0.20-setup.exe' },
  { ...windows, url: windows.url + '?redirect=bad' },
  { ...windows, url: 'https://user@liaotian99.com/downloads/releases/vxin-8.0.20-setup.exe' },
])('rejects mismatched or untrusted Windows downloads', manifest => {
  expect(windowsDownloadUrl(manifest, origin)).toBeNull();
});
it('accepts only the matching Android package on this deployment', () => {
  expect(androidDownloadUrl(android, origin)).toBe(android.url);
  expect(androidDownloadUrl({ ...android, url: 'https://evil.test/downloads/vxin-android-8.0.9.apk' }, origin)).toBeNull();
  expect(androidDownloadUrl({ ...android, versionName: '8.0.10' }, origin)).toBeNull();
});
it('loads manual downloads independently of the automatic updater', async () => {
  fetch.mockResolvedValueOnce({ ok: true, json: async () => windows }).mockResolvedValueOnce({ ok: true, json: async () => android });
  expect(await loadDownloadLinks(origin)).toEqual({ windows: windows.url, android: android.url });
  expect(fetch.mock.calls[0][0].pathname).toBe('/downloads/windows-version.json');
  expect(fetch.mock.calls[0][1].cache).toBe('no-store');
});
it('keeps Android downloads available when the Windows catalogue is missing', async () => {
  fetch.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => android });
  expect(await loadDownloadLinks(origin)).toEqual({ windows: DOWNLOAD_FALLBACK, android: android.url });
});
