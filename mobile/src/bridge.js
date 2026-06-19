/**
 * v信 移动端桥接层 (Capacitor)
 * 注入 window.__CAPACITOR__ 供前端判断运行平台。
 * 提供原生能力：推送、相机、相册、文件、通知。
 */

import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { StatusBar } from '@capacitor/status-bar';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';

// ── 平台标识 ──────────────────────────────────────────────
export const isCapacitor = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'android' | 'ios'

if (isCapacitor) {
  window.__CAPACITOR__ = true;
  window.__CAPACITOR_PLATFORM__ = platform;
}

// ── 初始化 ──────────────────────────────────────────────
export async function initMobileFeatures() {
  if (!isCapacitor) return;

  // 隐藏启动屏
  await SplashScreen.hide().catch(() => {});

  // 状态栏适配
  try {
    await StatusBar.setStyle({ style: 'DARK' });
    await StatusBar.setBackgroundColor({ color: '#1A2033' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (e) {
    // iOS 可能有差异
  }

  // 应用状态监听（前台/后台）
  CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    document.dispatchEvent(new CustomEvent('capacitor:app-state', {
      detail: { isActive },
    }));
  });

  // 注册推送
  registerPushNotifications();
}

// ── 推送通知 ──────────────────────────────────────────────
async function registerPushNotifications() {
  try {
    // 请求权限
    let permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') return;

    // 注册
    await PushNotifications.register();

    // 获取注册 token
    PushNotifications.addListener('registration', (token) => {
      console.log('[push] 注册成功:', token.value);
      // 将 token 发送到后端
      fetch('/api/notifications/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          platform: platform,
          token: token.value,
        }),
      }).catch(() => {});
    });

    // 接收推送
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      const { title, body, data } = notification;
      // 显示本地通知
      LocalNotifications.schedule({
        notifications: [{
          title: title || 'v信',
          body: body || '',
          id: Date.now(),
          schedule: { at: new Date() },
          extra: data || null,
        }],
      });
    });

    // 点击推送
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const { notification } = action;
      // 跳转到对应会话
      const convId = notification.data?.conversationId;
      if (convId) {
        window.dispatchEvent(new CustomEvent('capacitor:open-conversation', {
          detail: { conversationId: convId },
        }));
      }
    });
  } catch (e) {
    console.warn('[push] 注册失败:', e);
  }
}

// ── 相机 / 相册 ──────────────────────────────────────────
export async function takePhoto() {
  if (!isCapacitor) return null;
  try {
    const image = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      quality: 80,
      width: 1920,
      height: 1920,
      correctOrientation: true,
    });
    return image.dataUrl;
  } catch (e) {
    if (e.message !== 'User cancelled photos app') {
      console.warn('[camera] 拍照失败:', e);
    }
    return null;
  }
}

export async function pickFromGallery() {
  if (!isCapacitor) return null;
  try {
    const image = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
      quality: 80,
      width: 1920,
      height: 1920,
      correctOrientation: true,
    });
    return image.dataUrl;
  } catch (e) {
    if (e.message !== 'User cancelled photos app') {
      console.warn('[gallery] 选择失败:', e);
    }
    return null;
  }
}

// ── 文件选择 ──────────────────────────────────────────────
export async function pickFile() {
  if (!isCapacitor) return null;
  // Capacitor 不支持原生文件选择器，用 HTML input 兜底
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}

// ── 本地通知 ──────────────────────────────────────────────
export async function showLocalNotification({ title, body, id }) {
  if (!isCapacitor) return;
  try {
    await LocalNotifications.schedule({
      notifications: [{
        title: title || 'v信',
        body: body || '',
        id: id || Date.now(),
        schedule: { at: new Date() },
      }],
    });
  } catch (e) {
    console.warn('[notification] 本地通知失败:', e);
  }
}

// ── 安全区域 ──────────────────────────────────────────────
export function getSafeAreaInsets() {
  if (!isCapacitor) return { top: 0, bottom: 0, left: 0, right: 0 };
  // Capacitor 在 CSS 中注入 safe-area-inset-* 变量
  const style = getComputedStyle(document.documentElement);
  return {
    top:    parseInt(style.getPropertyValue('--safe-area-inset-top')) || 0,
    bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom')) || 0,
    left:   parseInt(style.getPropertyValue('--safe-area-inset-left')) || 0,
    right:  parseInt(style.getPropertyValue('--safe-area-inset-right')) || 0,
  };
}
