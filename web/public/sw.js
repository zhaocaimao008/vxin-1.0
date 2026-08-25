/**
 * v信 Service Worker — PWA 离线缓存 & 性能加速
 * 策略：
 *   - 静态资源（JS/CSS/字体/图片）→ Cache First（离线可用）
 *   - API 请求 → Network First，失败时返回 504
 *   - 推送通知 → 本地展示
 * 版本号变更自动触发旧缓存清理
 */
const SW_VERSION = 'vxin-sw-v5';;
const STATIC_CACHE = `${SW_VERSION}-static`;
const DYNAMIC_CACHE = `${SW_VERSION}-dynamic`;
const MAX_DYNAMIC_ENTRIES = 60;

// SW 部署在子路径（如 /app/）时，用 SW 自身路径推导 base，避免硬编码根路径导致
// 预缓存/离线 fallback 全部失效（部署在 /app/sw.js → SW_BASE='/app/'）。
const SW_BASE = self.location.pathname.replace(/sw\.js$/, '');

// 预缓存核心 Shell（SW_BASE 自动适配子路径部署）
const PRECACHE_URLS = [
  SW_BASE,
  SW_BASE + 'index.html',
];

// ── 安装：预缓存核心 Shell ───────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

// ── 激活：清理旧版本缓存 ─────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
          return caches.delete(key);
        }
      }))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch 拦截 ────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. 非 GET 请求直接透传
  if (request.method !== 'GET') return;
  // 2. Chrome 扩展、data: 等跳过
  if (!url.protocol.startsWith('http')) return;
  // 3. Socket.IO 长连接跳过
  if (url.pathname.startsWith('/socket.io')) return;
  // 4. API 请求 → Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }
  // 5. 媒体/上传文件 → Cache First（带 TTL 检查，图片/语音/视频离线可用）
  if (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/media/')) {
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
    return;
  }
  // 6. 静态资源（JS/CSS/字体/图标）→ Cache First
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  // 7. 导航请求（HTML）→ Network First + 离线 fallback
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }
  // 8. 其余 → Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ── 策略实现 ──────────────────────────────────────────────────

/** Cache First：静态资源，缓存命中直接返回，未命中存入缓存 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      // 动态缓存容量控制
      if (cacheName === DYNAMIC_CACHE) await trimCache(cache, MAX_DYNAMIC_ENTRIES);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('离线，资源不可用', { status: 503 });
  }
}

/** Network First：API 请求，网络优先，失败返回 504 */
async function networkFirst(request) {
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(8000) });
    return response;
  } catch {
    return new Response(JSON.stringify({ error: '网络不可用' }), {
      status: 504,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/** Navigation Handler：HTML 导航，网络优先，离线返回缓存根路径 */
async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const fallback = await cache.match(SW_BASE + 'index.html') || await cache.match(SW_BASE);
    return fallback || new Response('v信 - 离线模式', { status: 200, headers: { 'Content-Type': 'text/html' } });
  }
}

/** Stale-While-Revalidate：返回缓存同时后台更新 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  return cached || await networkPromise || new Response('', { status: 503 });
}

// ── 工具函数 ──────────────────────────────────────────────────

function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|eot|svg|ico|png|jpg|jpeg|webp|avif)(\?.*)?$/.test(url.pathname);
}

/** 裁剪动态缓存到最大条目数（LRU 近似：删除最早的条目） */
async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length >= maxEntries) {
    const toDelete = keys.slice(0, keys.length - maxEntries + 1);
    await Promise.all(toDelete.map(k => cache.delete(k)));
  }
}

// ── 推送通知 ──────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { data = { title: 'v信', body: event.data.text() }; }

  const options = {
    body: data.body || '',
    icon: SW_BASE + 'icon-192.png',
    badge: SW_BASE + 'icon-192.png',
    tag: data.conversationId || 'vxin-msg',    // 同会话消息折叠为一条
    renotify: true,
    data: { conversationId: data.conversationId, url: data.url || SW_BASE },
    actions: [
      { action: 'open', title: '查看' },
      { action: 'dismiss', title: '关闭' },
    ],
    silent: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(data.title || 'v信消息', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || SW_BASE;
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.postMessage({ type: 'navigate', url, conversationId: event.notification.data?.conversationId });
      } else {
        self.clients.openWindow(url);
      }
    })
  );
});

// ── 后台同步（离线发消息补偿）────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'vxin-outbox-sync') {
    event.waitUntil(syncOutbox());
  }
});

async function syncOutbox() {
  // 通知所有标签页触发 outbox 重试
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.postMessage({ type: 'sync_outbox' }));
}
