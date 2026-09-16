import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('./config', () => ({ timeoutSignal: () => undefined }));
import { androidDownloadUrl, windowsDownloadUrl, loadDownloadLinks, DOWNLOAD_FALLBACK } from './downloadLinks';
const origin = 'https://vxinchat.com';
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

it('uses the versioned Windows path from the current update feed', () => {
  expect(windowsDownloadUrl('version: 8.0.13\r\npath: vxin-8.0.13-setup.exe\r\n', origin)).toBe(origin + '/downloads/vxin-8.0.13-setup.exe');
});
it.each(['<html>error</html>', 'version: 8.0.13\npath: https://evil.test/app.exe', 'version: 8.0.13\npath: vxin-8.0.12-setup.exe'])('rejects an invalid Windows feed', feed => {
  expect(windowsDownloadUrl(feed, origin)).toBeNull();
});
it('accepts only an Android package matching the manifest on the download origin', () => {
  const manifest = { versionName: '8.0.7', url: origin + '/downloads/vxin-android-8.0.7.apk' };
  expect(androidDownloadUrl(manifest, origin)).toBe(manifest.url);
  expect(androidDownloadUrl({ ...manifest, url: 'https://evil.test/downloads/vxin-android-8.0.7.apk' }, origin)).toBeNull();
  expect(androidDownloadUrl({ ...manifest, versionName: '8.0.8' }, origin)).toBeNull();
});
it('keeps working Android downloads when the Windows manifest is unavailable', async () => {
  fetch.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ versionName: '8.0.7', url: origin + '/downloads/vxin-android-8.0.7.apk' }) });
  expect(await loadDownloadLinks(origin)).toEqual({ windows: DOWNLOAD_FALLBACK, android: origin + '/downloads/vxin-android-8.0.7.apk' });
  expect(fetch.mock.calls[0][1].cache).toBe('no-store');
});
