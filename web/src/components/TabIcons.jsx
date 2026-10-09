/**
 * TabIcons — 底部/侧边导航 Tab 图标（模块级常量）
 * 模块级定义 = 引用稳定 = Tab 栏图标不随 Home 重渲染闪烁
 */
import React from 'react';
import {
  IcoChat as ChatGlyph, IcoUsers, IcoSearchSm, IcoPlus, IcoUser, IcoAperture, IcoPhone,
  IcoStar as StarGlyph, IcoSettings as GearGlyph, IcoMoon as MoonGlyph, IcoSun as SunGlyph, IcoCompass,
} from './Icons';

/* 与 Icons.jsx 同一套 24 网格描边图标；size={null} → 尺寸完全由导航/TabBar 的 CSS 决定。
   导出名与无参调用方式保持不变（<Icon /> 被 Home / ChatList 直接渲染）。 */
export const IcoChat = () => <ChatGlyph size={null} />;
export const IcoContacts = () => <IcoUsers size={null} />;
export const IcoSearch = () => <IcoSearchSm size={null} className="ico-sm" />;
export const IcoAdd = () => <IcoPlus size={null} className="ico-md" />;
export const IcoMe = () => <IcoUser size={null} />;
export const IcoMoments = () => <IcoAperture size={null} />;
export const IcoCall = () => <IcoPhone size={null} />;
export const IcoStar = () => <StarGlyph size={null} />;
/** 设置（桌面端"设置"tab 专用） */
export const IcoSettings = () => <GearGlyph size={null} />;
/** 月亮（浅色皮肤时显示，点击切深色） */
export const IcoMoon = () => <MoonGlyph size={null} />;
/** 太阳（深色皮肤时显示，点击切浅色） */
export const IcoSun = () => <SunGlyph size={null} />;
/** 指南针（移动端「发现」tab） */
export const IcoDiscover = () => <IcoCompass size={null} />;

/* ── 全部页面 Tab 定义（标题文案的单一来源）── */
export const TABS = [
  { key: 'chats',     Icon: IcoChat,     label: '消息' },
  { key: 'contacts',  Icon: IcoContacts, label: '通讯录' },
  { key: 'discover',  Icon: IcoDiscover, label: '发现' },
  { key: 'moments',   Icon: IcoMoments,  label: '动态',   feature: 'moments' },
  { key: 'calls',     Icon: IcoCall,     label: '通话记录' },
  { key: 'favorites', Icon: IcoStar,     label: '收藏',   feature: 'collect' },
  { key: 'me',        Icon: IcoMe,       label: '我的' },
];

/* ── 桌面端侧边栏导航（消息/通讯录/动态/收藏/设置）── */
export const DESKTOP_TABS = [
  { key: 'chats',     Icon: IcoChat,     label: '消息' },
  { key: 'contacts',  Icon: IcoContacts, label: '通讯录' },
  { key: 'moments',   Icon: IcoMoments,  label: '动态',   feature: 'moments' },
  { key: 'favorites', Icon: IcoStar,     label: '收藏',   feature: 'collect' },
  { key: 'me',        Icon: IcoSettings, label: '设置' },
];

/* ── 移动端底部 TabBar（消息/通讯录/发现/我的）──
   「发现」本身不是新功能，只是动态 / 通话记录 / 收藏这三个已有页面的入口页。 */
const MOBILE_TAB_KEYS = ['chats', 'contacts', 'discover', 'me'];
const DISCOVER_KEYS = ['moments', 'calls', 'favorites'];
const DISCOVER_TONES = { moments: 'moments', calls: 'calls', favorites: 'favorites' };

const enabled = (features) => (t) => !t.feature || features[t.feature] !== false;

export const discoverEntries = (features) =>
  TABS.filter(t => DISCOVER_KEYS.includes(t.key)).filter(enabled(features))
    .map(t => ({ ...t, tone: DISCOVER_TONES[t.key] }));

export const isDiscoverChild = (key) => DISCOVER_KEYS.includes(key);

export const visibleTabs = (features) =>
  MOBILE_TAB_KEYS.map(k => TABS.find(t => t.key === k)).filter(enabled(features));

export const desktopVisibleTabs = (features) =>
  DESKTOP_TABS.filter(t => !t.feature || features[t.feature] !== false);
