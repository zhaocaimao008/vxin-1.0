/**
 * Icons — 通用功能图标库
 * 与 TabIcons.jsx 同源风格：24 viewBox、fill 继承 currentColor（由外层 color 驱动，深浅色零成本适配）。
 * 用于替换散落各处的 emoji / ✕ × 字符关闭按钮，统一图标语言。
 * 尺寸约定（调用方按场景传 size，不在此写死）：导航 22 / 工具栏 20 / 弹窗 18 / 小按钮 16-18。
 */
import React from 'react';

const Svg = ({ size = 20, children, ...rest }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" {...rest}>{children}</svg>
);

export const IcoClose = ({ size = 18, ...rest }) => (
  <Svg size={size} {...rest}><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></Svg>
);

export const IcoCamera = ({ off = false, size = 20, ...rest }) => off
  ? <Svg size={size} {...rest}><path d="M21 6.5l-4-4-1.5 1.5 4 4L21 6.5zm1.99 10.5L18 12.5l-4-4L2 2 .99 3.01 3 5H1v14h16v-2.01l2.99 3 .99-.99-2-2.01L22.99 17zM4 17V7h1l13 13H4zm11.5-5.5L14 10 9 5H21v11l-5.5-4.5z"/></Svg>
  : <Svg size={size} {...rest}><path d="M15 8v8H5V8h10m1-2H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4V7c0-.55-.45-1-1-1z"/></Svg>;

export const IcoMic = ({ off = false, size = 20, ...rest }) => off
  ? <Svg size={size} {...rest}><path d="M16.5 12A4.5 4.5 0 0012 7.5v2.19l4.45 4.45c.03-.2.05-.41.05-.64zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.78 8.78 0 0021 12c0-4.28-3-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27l4.73 4.73V12a4.5 4.5 0 004.5 4.5c.55 0 1.08-.1 1.57-.27L15.34 18A8.9 8.9 0 0112 18.77c-4.28 0-7.86-3-8.77-7H1.18c.96 4.98 5.35 8.77 10.82 8.77 2.11 0 4.06-.62 5.71-1.68L21 22.73 22.27 21.46 4.27 3zM12 7.5c.28 0 .54.04.8.08L7.73 2.5A4.5 4.5 0 0012 7.5z"/></Svg>
  : <Svg size={size} {...rest}><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15a.998.998 0 00-.98-.85c-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08a6.994 6.994 0 005.91-5.78c.1-.6-.39-1.14-1-1.14z"/></Svg>;

export const IcoPhoneOff = ({ size = 20, ...rest }) => (
  <Svg size={size} {...rest}><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.12-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></Svg>
);

export const IcoFile = ({ size = 20, ...rest }) => (
  <Svg size={size} {...rest}><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></Svg>
);

export const IcoVideoFile = ({ size = 20, ...rest }) => (
  <Svg size={size} {...rest}><path d="M18 4v1.5l-2-1.2V4H4v16h12v-.3l2-1.2V20h2V4h-2zm-4.5 8L9 14.5v-5L13.5 12zM20 8.83L22 7.5v9l-2-1.33V8.83z"/></Svg>
);

export const IcoRedPacket = ({ size = 20, ...rest }) => (
  <Svg size={size} {...rest}>
    <path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm7 4a3 3 0 100 6 3 3 0 000-6zm0 1.6a1.4 1.4 0 110 2.8 1.4 1.4 0 010-2.8zM3 9h18v1.4H3V9z"/>
  </Svg>
);

export const IcoTransfer = ({ size = 20, ...rest }) => (
  <Svg size={size} {...rest}><path d="M21 7H3a1 1 0 00-1 1v9a2 2 0 002 2h14a2 2 0 002-2v-2h-7a2 2 0 010-4h7V8a1 1 0 00-1-1zm-4 6h5v2h-5a1 1 0 010-2zM3 5h13a1 1 0 010 2H3a1 1 0 010-2z"/></Svg>
);

export const IcoPin = ({ size = 16, ...rest }) => (
  <Svg size={size} {...rest}><path d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z"/></Svg>
);

export const IcoCelebrate = ({ size = 20, ...rest }) => (
  <Svg size={size} {...rest}><path d="M2 22l4.4-14.5 8.1 8.1L2 22zm14.6-15.4c1.2-1.2 1.2-3.1 0-4.2-1.2-1.2-3.1-1.2-4.2 0l-1 1 4.2 4.2 1-1zm-6.4.2l7.6 7.6 1.9-1.9-7.6-7.6-1.9 1.9zM19 9l2-2-1-1-2 2 1 1zM13 3l2-2-1-1-2 2 1 1zM22 12l-2 2 1 1 2-2-1-1z"/></Svg>
);

export const IcoCheckCircle = ({ size = 20, ...rest }) => (
  <Svg size={size} {...rest}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.99 15l-4.6-4.6 1.41-1.41 3.19 3.18 7.19-7.19 1.41 1.41L10.01 17z"/></Svg>
);

export const IcoWarn = ({ size = 20, ...rest }) => (
  <Svg size={size} {...rest}><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></Svg>
);

export const IcoErrorX = ({ size = 20, ...rest }) => (
  <Svg size={size} {...rest}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></Svg>
);

export const IcoDesktop = ({ size = 20, ...rest }) => (
  <Svg size={size} {...rest}><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></Svg>
);

export const IcoMobile = ({ size = 20, ...rest }) => (
  <Svg size={size} {...rest}><path d="M15.5 1h-8A2.5 2.5 0 005 3.5v17A2.5 2.5 0 007.5 23h8a2.5 2.5 0 002.5-2.5v-17A2.5 2.5 0 0015.5 1zM14 21h-4v-1h4v1zm3.25-3H6.75V4h10.5v14z"/></Svg>
);

export const IcoAttachment = ({ size = 20, ...rest }) => (
  <Svg size={size} {...rest}><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></Svg>
);
