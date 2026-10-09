/**
 * DiscoverHub — 移动端「发现」入口页
 * 只汇总已有页面（动态 / 通话记录 / 收藏）的入口，点击后切到对应的原有 tab，
 * 不新增任何功能或数据；入口是否显示跟随服务端 features 开关（与侧栏同源）。
 */
import React from 'react';
import { discoverEntries } from './TabIcons';
import { IcoChevronRight } from './Icons';

export default function DiscoverHub({ features = {}, onOpen }) {
  const entries = discoverEntries(features);
  return (
    <div className="wc-discover" data-testid="discover-hub">
      <div className="wc-discover-section" role="list">
        {entries.map(({ key, Icon, label }) => (
          <button
            key={key}
            type="button"
            role="listitem"
            data-testid={`discover-entry-${key}`}
            className="wc-discover-item"
            onClick={() => onOpen(key)}
          >
            {/* 入口图标统一用同一套浅墨绿底块（--nt-icon-tile-*），不再按入口区分颜色 */}
            <span className="wc-discover-icon" aria-hidden="true"><Icon /></span>
            <span className="wc-discover-label">{label}</span>
            <span className="wc-discover-arrow" aria-hidden="true">
              <IcoChevronRight size={16} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
