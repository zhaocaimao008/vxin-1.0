import { timeoutSignal } from './config';

export const DOWNLOAD_FALLBACK = null;

export function windowsDownloadUrl(manifest, origin) {
  if (!/^\d+\.\d+\.\d+$/.test(manifest?.versionName || '')) return null;
  try {
    const url = new URL(manifest.url, origin);
    if (url.origin !== new URL(origin).origin || url.username || url.password ||
        url.pathname !== `/downloads/releases/vxin-${manifest.versionName}-setup.exe` || url.search || url.hash) return null;
    return url.href;
  } catch { return null; }
}

export function androidDownloadUrl(manifest, origin) {
  if (!/^\d+\.\d+\.\d+$/.test(manifest?.versionName || '')) return null;
  try {
    const url = new URL(manifest.url, origin);
    if (url.origin !== new URL(origin).origin || url.username || url.password ||
        url.pathname !== `/downloads/vxin-android-${manifest.versionName}.apk` || url.search || url.hash) return null;
    return url.href;
  } catch { return null; }
}

export async function loadDownloadLinks(origin) {
  const get = path => fetch(new URL(path, origin), { cache: 'no-store', credentials: 'omit', signal: timeoutSignal(5000) })
    .then(response => { if (!response.ok) throw Error('Download manifest unavailable'); return response.json(); });
  // Manual downloads have their own catalogue, independent of the automatic updater feed.
  const [windows, android] = await Promise.allSettled([
    get('/downloads/windows-version.json').then(json => windowsDownloadUrl(json, origin)),
    get('/downloads/vxin-android-version.json').then(json => androidDownloadUrl(json, origin)),
  ]);
  return {
    windows: windows.status === 'fulfilled' && windows.value || DOWNLOAD_FALLBACK,
    android: android.status === 'fulfilled' && android.value || DOWNLOAD_FALLBACK,
  };
}
