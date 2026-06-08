import { useEffect, useRef } from 'react';
import axios from 'axios';

// URL-safe Base64 → Uint8Array（VAPID 公钥转换）
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotification(user) {
  const subscriptionRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    let cancelled = false;

    async function setup() {
      try {
        // 1. 拉取 VAPID 公钥
        const { data } = await axios.get('/api/notifications/vapid-public-key');
        if (cancelled || !data.publicKey) return;

        // 2. 注册 Service Worker
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
        if (cancelled) return;

        // 3. 请求通知权限
        const permission = await Notification.requestPermission();
        if (permission !== 'granted' || cancelled) return;

        // 4. 订阅 Push（幂等：已订阅直接返回现有订阅）
        const existing = await reg.pushManager.getSubscription();
        const sub = existing || await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey),
        });

        subscriptionRef.current = sub;

        // 5. 保存订阅到后端
        await axios.post('/api/notifications/web-subscribe', { subscription: sub.toJSON() });

        // 6. 监听 Service Worker 消息（通知点击跳转到会话）
        navigator.serviceWorker.addEventListener('message', handleSWMessage);
      } catch (e) {
        // 用户拒绝权限或浏览器不支持，静默失败
      }
    }

    function handleSWMessage(event) {
      if (event.data?.type === 'OPEN_CONVERSATION') {
        window.dispatchEvent(new CustomEvent('vxin:open-conversation', {
          detail: { conversationId: event.data.conversationId },
        }));
      }
    }

    setup();

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    };
  }, [user?.id]);

  // 登出时取消订阅
  async function unsubscribe() {
    try {
      const sub = subscriptionRef.current;
      if (sub) {
        await axios.delete('/api/notifications/web-subscribe', {
          data: { endpoint: sub.endpoint },
        });
        await sub.unsubscribe();
        subscriptionRef.current = null;
      }
    } catch {}
  }

  return { unsubscribe };
}
