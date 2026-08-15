import React, { useEffect, useState } from 'react';
import { useAndroidVersionCheck } from '../hooks/useAndroidVersionCheck';

/**
 * Android 更新提示组件
 * 仅在 Android 平台显示，提示用户下载新版本
 */
export default function AndroidUpdatePrompt() {
  const { status, currentVersion, latestVersion, downloadUrl, changelog, openDownload } = useAndroidVersionCheck();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (status === 'updateAvailable') {
      setIsVisible(true);
    }
  }, [status]);

  if (status !== 'updateAvailable' || !isVisible || !latestVersion) {
    return null;
  }

  const handleDownload = () => {
    openDownload(downloadUrl);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  return (
    <div
      className="android-update-prompt"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        background: '#1a1a1a',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '85vw',
        maxHeight: '80vh',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        color: '#fff',
        fontFamily: '"HarmonyOS Sans", -apple-system, BlinkMacSystemFont, sans-serif'
      }}
      role="dialog"
      aria-label="应用更新提示"
    >
      {/* 半透明遮罩 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 9998,
          cursor: 'pointer'
        }}
        onClick={handleDismiss}
      />

      {/* 对话框内容 */}
      <div style={{ position: 'relative', zIndex: 9999 }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>
          🎉 发现新版本 {latestVersion.name}
        </h2>

        <p style={{ margin: '8px 0 16px 0', fontSize: '14px', color: '#aaa' }}>
          {latestVersion.description || '已有新版本可用'}
        </p>

        {/* 更新日志 */}
        {changelog && changelog.length > 0 && (
          <div style={{ margin: '16px 0', padding: '12px', background: '#2a2a2a', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#888' }}>更新内容：</p>
            <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6' }}>
              {changelog.map((item, idx) => (
                <li key={idx} style={{ margin: '4px 0', color: '#ccc' }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 按钮 */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button
            onClick={handleDownload}
            style={{
              flex: 1,
              padding: '12px 24px',
              background: '#16C55B',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.3s'
            }}
            onMouseEnter={(e) => e.target.style.background = '#11A047'}
            onMouseLeave={(e) => e.target.style.background = '#16C55B'}
          >
            立即下载
          </button>
          <button
            onClick={handleDismiss}
            style={{
              flex: 1,
              padding: '12px 24px',
              background: '#3a3a3a',
              color: '#ccc',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background 0.3s'
            }}
            onMouseEnter={(e) => e.target.style.background = '#4a4a4a'}
            onMouseLeave={(e) => e.target.style.background = '#3a3a3a'}
          >
            稍后提醒
          </button>
        </div>

        {/* 版本信息 */}
        <p style={{ margin: '16px 0 0 0', fontSize: '11px', color: '#666', textAlign: 'center' }}>
          当前版本：{currentVersion?.name} • 最新版本：{latestVersion.name}
        </p>
      </div>
    </div>
  );
}
