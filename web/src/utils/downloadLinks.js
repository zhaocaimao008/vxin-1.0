import { timeoutSignal } from './config';

export const DOWNLOAD_FALLBACK = 'https://vxinchat.com/#download';

export function windowsDownloadUrl(feed, origin) {
  const version = /^version:\s*(\d+\.\d+\.\d+)\s*$/m.exec(feed)?.[1];
  const file = /^path:\s*(\S+)\s*$/m.exec(feed)?.[1];
  if (!version || file !== `vxin-${version}-setup.exe`) return null;
  return new URL(`/downloads/${file}`, origin).href;
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
    .then(response => { if (!response.ok) throw Error('Download manifest unavailable'); return response; });
  const [windows, android] = await Promise.allSettled([
    get('/downloads/updates/latest.yml').then(r => r.text()).then(text => windowsDownloadUrl(text, origin)),
    get('/downloads/vxin-android-version.json').then(r => r.json()).then(json => androidDownloadUrl(json, origin)),
  ]);
  return {
    windows: windows.status === 'fulfilled' && windows.value || DOWNLOAD_FALLBACK,
    android: android.status === 'fulfilled' && android.value || DOWNLOAD_FALLBACK,
  };
}
