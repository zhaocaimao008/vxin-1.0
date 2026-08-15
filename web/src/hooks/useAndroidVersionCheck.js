import { useEffect, useState, useCallback } from 'react';

/**
 * Android 版本检查 Hook
 * 监听应用启动，检查远程版本，如有更新弹出提示
 * 支持 Capacitor 和 Web 环境
 */
export function useAndroidVersionCheck() {
  const [state, setState] = useState({
    status: 'idle', // idle|checking|updateAvailable|error
    currentVersion: null,
    latestVersion: null,
    downloadUrl: null,
    changelog: []
  });

  const isCapacitorApp = () => {
    return !!window.Capacitor || !!window.cordova;
  };

  const checkVersion = useCallback(async () => {
    try {
      // 仅在 Capacitor 环境运行
      if (!isCapacitorApp()) return;

      setState(prev => ({ ...prev, status: 'checking' }));

      const response = await fetch(
        'https://dipsin.com/downloads/android-version.json',
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          cache: 'no-cache'
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'success' && data.latestVersion) {
        const latest = data.latestVersion;
        const current = data.currentVersion;

        setState(prev => ({
          ...prev,
          currentVersion: current,
          latestVersion: latest
        }));

        // 检查是否有更新
        if (latest.code > (current?.code || 0)) {
          setState(prev => ({
            ...prev,
            status: 'updateAvailable',
            downloadUrl: latest.downloadUrl,
            changelog: latest.changelog || []
          }));

          // 弹出提示（如果是强制更新）
          if (latest.mandatory) {
            showUpdatePrompt(latest);
          }
        } else {
          setState(prev => ({ ...prev, status: 'idle' }));
        }
      }
    } catch (error) {
      console.error('版本检查失败:', error);
      setState(prev => ({
        ...prev,
        status: 'error'
      }));
    }
  }, []);

  const showUpdatePrompt = useCallback((latestVersion) => {
    const message = `发现新版本 ${latestVersion.name}\n是否立即下载并安装？`;
    if (confirm(message)) {
      openDownload(latestVersion.downloadUrl);
    }
  }, []);

  const openDownload = useCallback((downloadUrl) => {
    // 使用 Capacitor Browser 或浏览器原生打开
    if (window.Capacitor?.Plugins?.Browser) {
      window.Capacitor.Plugins.Browser.open({ url: downloadUrl });
    } else {
      window.open(downloadUrl, '_system');
    }
  }, []);

  useEffect(() => {
    // 仅在 Capacitor 环境运行
    if (!isCapacitorApp()) return;

    // 应用启动时检查版本
    checkVersion();

    // 每小时检查一次
    const interval = setInterval(checkVersion, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkVersion]);

  return {
    ...state,
    checkVersion,
    openDownload
  };
}
