// 推送通知已移除（expo-notifications 在不含 Google Play Services 的设备上会崩溃）
export function usePushNotification() {
  return { unregister: () => {} };
}
