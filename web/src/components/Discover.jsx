import React from 'react';

const SECTIONS = [
  [
    { icon: '🌐', color: '#2B9E56', label: '朋友圈', key: 'moments' },
  ],
  [
    { icon: '▶️', color: '#000', label: '视频号', key: 'video' },
  ],
  [
    { icon: '📷', color: '#333', label: '扫一扫', key: 'scan' },
    { icon: '📳', color: '#333', label: '摇一摇', key: 'shake' },
  ],
  [
    { icon: '👁', color: '#FA8C16', label: '看一看', key: 'look' },
    { icon: '🔍', color: '#1890FF', label: '搜一搜', key: 'search' },
  ],
  [
    { icon: '📍', color: '#FA5151', label: '附近的人', key: 'nearby' },
  ],
  [
    { icon: '🛒', color: '#FA8C16', label: '购物', key: 'shop' },
    { icon: '🎮', color: '#7B61FF', label: '游戏', key: 'game' },
  ],
  [
    { icon: '⬛', color: '#333', label: '小程序', key: 'miniapp' },
  ],
];

export default function Discover({ onNavigate }) {
  const handleItem = (key) => {
    if (key === 'moments') { onNavigate?.('moments'); }
  };

  return (
    <div className="wc-discover" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="wc-panel-header">
        <span className="wc-panel-title">发现</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', background: '#F5F5F5', paddingTop: 12 }}>
        {SECTIONS.map((section, si) => (
          <div key={si} className="wc-discover-section">
            {section.map((item, ii) => (
              <div key={item.key} className="wc-discover-item" onClick={() => handleItem(item.key)}>
                <div className="wc-discover-icon" style={{ background: item.color + '22', color: item.color }}>
                  {item.icon}
                </div>
                <span className="wc-discover-label">{item.label}</span>
                <span className="wc-discover-arrow">›</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
