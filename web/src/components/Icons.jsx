/**
 * Icons — v信 统一功能图标库（2026-10-09 重画）
 *
 * 规范（所有功能图标必须遵守，新增图标照此画）：
 *   - 24×24 网格，内容落在 2–22 的活动区内；
 *   - 1.8px 圆头圆角描边（stroke-linecap/linejoin = round），不填充；
 *   - 颜色只用 currentColor，由外层 color 驱动（深浅色、hover、active、危险态都改 color，不改 fill）；
 *   - 极少数实心小元素（圆点）加 className="vx-f"，由 brand-icons.css 统一填充 currentColor。
 * 根节点带 class="vx-ico"：brand-icons.css 用它屏蔽历史 CSS 里 `xxx svg { fill: ... }` 的填充污染。
 * 品牌标志不在这里，见 BrandMark.jsx；用户头像 / 用户内容不使用本库。
 *
 * 尺寸约定（调用方按场景传 size；传 size={null} 则完全交给 CSS 控制）：
 *   导航 22–24 / 工具栏 20 / 弹窗 18 / 小按钮 16。
 */
import React from 'react';

export const IconBase = ({ size = 20, strokeWidth = 1.8, className, children, ...rest }) => (
  <svg
    viewBox="0 0 24 24"
    width={size ?? undefined}
    height={size ?? undefined}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    focusable="false"
    aria-hidden={rest['aria-label'] ? undefined : true}
    className={className ? `vx-ico ${className}` : 'vx-ico'}
    {...rest}
  >
    {children}
  </svg>
);

const make = (defaultSize, body) => {
  const Icon = ({ size = defaultSize, ...rest }) => <IconBase size={size} {...rest}>{body}</IconBase>;
  return Icon;
};

const Dot = ({ cx, cy, r = 1.15 }) => <circle className="vx-f" cx={cx} cy={cy} r={r} />;

/* ── 基础操作 ─────────────────────────────────────────────────────────── */
export const IcoClose = make(18, <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />);
export const IcoPlus = make(20, <path d="M12 5v14M5 12h14" />);
export const IcoMinus = make(20, <path d="M5 12h14" />);
export const IcoCheck = make(16, <path d="M5 12.5l4.5 4.5L19 7.5" />);
export const IcoChevronLeft = make(20, <path d="M14.5 5.5L8 12l6.5 6.5" />);
export const IcoChevronRight = make(20, <path d="M9.5 5.5L16 12l-6.5 6.5" />);
export const IcoExpandMore = make(16, <path d="M6 9.5l6 6 6-6" />);
export const IcoExpandLess = make(16, <path d="M6 14.5l6-6 6 6" />);
export const IcoArrowLeft = make(20, <path d="M19 12H5.5M11 6l-6 6 6 6" />);
export const IcoMore = make(20, <><Dot cx={5.5} cy={12} r={1.5} /><Dot cx={12} cy={12} r={1.5} /><Dot cx={18.5} cy={12} r={1.5} /></>);
export const IcoMoreVert = make(20, <><Dot cx={12} cy={5.5} r={1.5} /><Dot cx={12} cy={12} r={1.5} /><Dot cx={12} cy={18.5} r={1.5} /></>);
export const IcoMenu = make(20, <path d="M4 7h16M4 12h16M4 17h16" />);
export const IcoSearchSm = make(18, <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.3-4.3" /></>);
export const IcoSearch = IcoSearchSm;
export const IcoRefresh = make(18, <path d="M19.5 11A7.6 7.6 0 0 0 6.2 6.6L4.5 8.3M4.5 4.5v3.8h3.8M4.5 13a7.6 7.6 0 0 0 13.3 4.4l1.7-1.7M19.5 19.5v-3.8h-3.8" />);
export const IcoExternal = make(16, <path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />);
export const IcoCopy = make(18, <><rect x="8.5" y="8.5" width="12" height="12" rx="2.5" /><path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" /></>);
export const IcoTrash = make(18, <path d="M4.5 6.5h15M9.5 6.5v-2h5v2M6.5 6.5l.8 12.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8l.8-12.2M10 10.5v6M14 10.5v6" />);
export const IcoEdit = make(16, <path d="M14.8 5.6l3.6 3.6M4 20l1-4.3L15.6 5.1a2 2 0 0 1 2.8 0l.5.5a2 2 0 0 1 0 2.8L8.3 19z" />);
export const IcoUpload = make(18, <path d="M12 15.5V4M7.5 8.5L12 4l4.5 4.5M4.5 15v2.5A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5V15" />);
export const IcoDownload = make(18, <path d="M12 4v11.5M7.5 11L12 15.5l4.5-4.5M4.5 15v2.5A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5V15" />);
export const IcoForward = make(18, <path d="M14 5l6 6-6 6M20 11h-8.5A6.5 6.5 0 0 0 5 17.5V19" />);
export const IcoReply = make(18, <path d="M10 5l-6 6 6 6M4 11h8.5a6.5 6.5 0 0 1 6.5 6.5V19" />);
export const IcoLink = make(18, <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />);
export const IcoPin = make(16, <path d="M9 3.5h6M10 3.5v5.2l-3 3.3v1.7h10V12l-3-3.3V3.5M12 13.7v6.8" />);
export const IcoFilter = make(18, <path d="M4 6.5h16M7 12h10M10 17.5h4" />);
export const IcoMaximize = make(18, <path d="M8 3.5H5.5a2 2 0 0 0-2 2V8M16 3.5h2.5a2 2 0 0 1 2 2V8M20.5 16v2.5a2 2 0 0 1-2 2H16M8 20.5H5.5a2 2 0 0 1-2-2V16" />);
export const IcoMinimize = make(18, <path d="M8.5 3.5V7a1.5 1.5 0 0 1-1.5 1.5H3.5M20.5 8.5H17A1.5 1.5 0 0 1 15.5 7V3.5M15.5 20.5V17a1.5 1.5 0 0 1 1.5-1.5h3.5M3.5 15.5H7A1.5 1.5 0 0 1 8.5 17v3.5" />);

/* ── 通讯 / 导航 ──────────────────────────────────────────────────────── */
// 对话气泡与品牌标志同一造型语言（圆角矩形 + 左下尾巴）
export const IcoChat = make(22, <path d="M8 4.5h8A4.5 4.5 0 0 1 20.5 9v4.5A4.5 4.5 0 0 1 16 18h-5.2l-4.1 2.9a.6.6 0 0 1-.95-.5V17.6A4.5 4.5 0 0 1 3.5 13.5V9A4.5 4.5 0 0 1 8 4.5z" />);
export const IcoUsers = make(22, <><circle cx="9" cy="8.5" r="3.5" /><path d="M2.8 19.5c.5-3.2 3.1-5.3 6.2-5.3s5.7 2.1 6.2 5.3M15.8 5.2a3.4 3.4 0 0 1 0 6.6M17.4 14.4c2 .6 3.4 2.5 3.8 5.1" /></>);
export const IcoUser = make(22, <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c.8-3.8 3.9-6.2 7.5-6.2s6.7 2.4 7.5 6.2" /></>);
export const IcoUserPlus = make(20, <><circle cx="10" cy="8" r="3.8" /><path d="M3 20c.7-3.6 3.6-5.8 7-5.8 1.3 0 2.5.3 3.6.9M18 13.5v6M15 16.5h6" /></>);
export const IcoCompass = make(22, <><circle cx="12" cy="12" r="9" /><path d="M15.6 8.4l-2 5.2-5.2 2 2-5.2z" /></>);
export const IcoAperture = make(22, <><circle cx="12" cy="12" r="9" /><path d="M14.3 3.3L9.6 11.4M20.6 9.5h-9.3M17.4 18.7l-4.7-8M9.7 20.7l4.7-8.1M3.4 14.5h9.3M6.6 5.3l4.7 8" /></>);
export const IcoStar = make(20, <path d="M12 3.6l2.6 5.2 5.8.85-4.2 4.1 1 5.75L12 16.8l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z" />);
export const IcoPhone = make(20, <path d="M5 3.5h2.8a1.5 1.5 0 0 1 1.4 1l.9 2.8a1.5 1.5 0 0 1-.4 1.6L8.3 10.2a12 12 0 0 0 5.5 5.5l1.3-1.4a1.5 1.5 0 0 1 1.6-.4l2.8.9a1.5 1.5 0 0 1 1 1.4V19a1.5 1.5 0 0 1-1.6 1.5C10.7 20 4 13.3 3.5 5.1A1.5 1.5 0 0 1 5 3.5z" />);
export const IcoPhoneOff = make(20, (
  <g transform="rotate(135 12 12)">
    <path d="M5 3.5h2.8a1.5 1.5 0 0 1 1.4 1l.9 2.8a1.5 1.5 0 0 1-.4 1.6L8.3 10.2a12 12 0 0 0 5.5 5.5l1.3-1.4a1.5 1.5 0 0 1 1.6-.4l2.8.9a1.5 1.5 0 0 1 1 1.4V19a1.5 1.5 0 0 1-1.6 1.5C10.7 20 4 13.3 3.5 5.1A1.5 1.5 0 0 1 5 3.5z" />
  </g>
));
export const IcoVideo = make(20, <><rect x="3" y="6.5" width="12.5" height="11" rx="2.5" /><path d="M15.5 10.4l4.3-2.6a.8.8 0 0 1 1.2.7v7a.8.8 0 0 1-1.2.7l-4.3-2.6" /></>);
const VIDEO_OFF = <><path d="M10 6.5h3a2.5 2.5 0 0 1 2.5 2.5v3.5M15.5 15.5A2.5 2.5 0 0 1 13 17.5H5.5A2.5 2.5 0 0 1 3 15V9a2.5 2.5 0 0 1 2-2.45M15.5 10.4l4.3-2.6a.8.8 0 0 1 1.2.7v7.2M3.5 3.5l17 17" /></>;
export const IcoVideoOff = make(20, VIDEO_OFF);
export const IcoCamera = ({ off = false, size = 20, ...rest }) => (
  <IconBase size={size} {...rest}>{off ? VIDEO_OFF : <><rect x="3" y="6.5" width="12.5" height="11" rx="2.5" /><path d="M15.5 10.4l4.3-2.6a.8.8 0 0 1 1.2.7v7a.8.8 0 0 1-1.2.7l-4.3-2.6" /></>}</IconBase>
);
export const IcoPhotoCamera = make(18, <><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" /><circle cx="12" cy="12.8" r="3.4" /></>);
export const IcoMic = ({ off = false, size = 20, ...rest }) => (
  <IconBase size={size} {...rest}>
    {off
      ? <path d="M15 10.5V6a3 3 0 0 0-5.6-1.5M9 9v2a3 3 0 0 0 4.6 2.5M18.5 11a6.5 6.5 0 0 1-.9 3.3M5.5 11a6.5 6.5 0 0 0 10.4 5.2M12 17.5V21M8.5 21h7M3.5 3.5l17 17" />
      : <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" /></>}
  </IconBase>
);
export const IcoVolume = make(18, <path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11" />);
export const IcoVolumeOff = make(16, <path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4zM16 9.5l5 5M21 9.5l-5 5" />);
export const IcoVoice = make(20, <path d="M4 10v4M8 7v10M12 4.5v15M16 7v10M20 10v4" />);
export const IcoKeyboard = make(20, <><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14.5h8" /></>);
export const IcoSmile = make(20, <><circle cx="12" cy="12" r="9" /><path d="M8.5 14.3a4.2 4.2 0 0 0 7 0" /><Dot cx={9} cy={9.8} /><Dot cx={15} cy={9.8} /></>);
export const IcoSend = make(18, <path d="M20.5 3.5L10.3 13.7M20.5 3.5l-6.3 17-3.9-6.8-6.8-3.9z" />);
export const IcoAt = make(18, <><circle cx="12" cy="12" r="3.5" /><path d="M15.5 12v1.3a2.6 2.6 0 0 0 5.2 0V12a8.7 8.7 0 1 0-3.4 6.9" /></>);
export const IcoScan = make(20, <path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5M4 12h16" />);
export const IcoQrCode = make(20, <><rect x="4" y="4" width="6" height="6" rx="1.2" /><rect x="14" y="4" width="6" height="6" rx="1.2" /><rect x="4" y="14" width="6" height="6" rx="1.2" /><path d="M14 14h2.5v2.5M20 14v.01M14 20h.01M17.5 20H20v-2.5" /></>);
export const IcoBell = make(16, <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />);
export const IcoBellOff = make(16, <path d="M8.6 5.6A6 6 0 0 1 18 11v4M6 11v5.5l-1.5 2h12.5M10 20.5a2 2 0 0 0 4 0M3.5 3.5l17 17" />);

/* ── 媒体 / 文件 / 内容 ──────────────────────────────────────────────── */
export const IcoImage = make(20, <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="9.5" r="1.7" /><path d="M20.5 15.5L16 11l-8.5 8.5" /></>);
export const IcoFolder = make(20, <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />);
export const IcoFile = make(20, <path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8zM14 3v5h5M9 13h6M9 16.5h4" />);
export const IcoVideoFile = make(20, <path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8zM14 3v5h5M10.5 12.2v4.6l3.8-2.3z" />);
export const IcoAttachment = make(20, <path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.1-8.1a3.3 3.3 0 0 1 4.7 4.7l-8.1 8.1a1.7 1.7 0 0 1-2.4-2.4l7.4-7.4" />);
export const IcoPlay = make(18, <path d="M8 5.5v13l10.5-6.5z" />);
export const IcoPause = make(18, <path d="M8.5 5.5v13M15.5 5.5v13" />);
export const IcoStop = make(18, <rect x="6" y="6" width="12" height="12" rx="2" />);
export const IcoLocation = make(18, <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>);
export const IcoCalendar = make(18, <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>);
export const IcoClock = make(18, <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>);
export const IcoHistory = make(18, <path d="M3.8 12a8.5 8.5 0 1 0 2.5-6M3.8 4.5v4h4M12 8v4.5l3 1.8" />);
export const IcoTag = make(18, <><path d="M3.5 12V5a1.5 1.5 0 0 1 1.5-1.5h7l8.5 8.5-8.5 8.5z" /><Dot cx={8} cy={8} r={1.3} /></>);
export const IcoHeart = ({ size = 14, filled = false, ...rest }) => (
  <IconBase size={size} {...rest}>
    <path className={filled ? 'vx-f' : undefined} d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
  </IconBase>
);
export const IcoRedPacket = make(20, <><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M5 8.5c2 1.6 4.4 2.5 7 2.5s5-.9 7-2.5" /><circle cx="12" cy="11.5" r="1.8" /></>);
export const IcoTransfer = make(20, <path d="M4 8h15.5L16 4.5M20 16H4.5L8 19.5" />);
export const IcoWallet = make(20, <><rect x="3.5" y="6" width="17" height="13.5" rx="2.5" /><path d="M20.5 11h-3.8a1.9 1.9 0 0 0 0 3.8h3.8M6.5 6l9.3-2.4a1.5 1.5 0 0 1 1.9 1.4V6" /></>);
export const IcoCelebrate = make(20, <path d="M4 20l4.3-12 7.7 7.7zM9.3 11.8l3 3M13.8 5.2c.6 1.2.4 2.5-.5 3.4M18.8 10.2c-1.2-.6-2.5-.4-3.4.5M16.5 3.5v1.6M20.5 7.5h-1.6M19 4.9l-.9.9" />);

/* ── 状态 / 语义 ─────────────────────────────────────────────────────── */
export const IcoCheckCircle = make(20, <><circle cx="12" cy="12" r="9" /><path d="M8 12.3l2.7 2.7 5.5-5.5" /></>);
export const IcoWarn = make(20, <><path d="M10.3 4.4L2.9 17.5a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0zM12 9.5v4" /><Dot cx={12} cy={16.9} /></>);
export const IcoErrorX = make(20, <><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>);
export const IcoAlert = make(16, <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V13" /><Dot cx={12} cy={16.3} /></>);
export const IcoInfo = make(16, <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><Dot cx={12} cy={7.8} /></>);
export const IcoHelp = make(18, <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.4a2.6 2.6 0 0 1 5 1c0 1.7-2.5 2.1-2.5 3.6" /><Dot cx={12} cy={17} /></>);
export const IcoBlock = make(18, <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>);
export const IcoLightbulb = make(16, <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2v.1h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />);
export const IcoCampaign = make(16, <path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1zM16.5 9a4 4 0 0 1 0 6M7.5 15l1 5" />);

/* ── 设置 / 账号 / 设备 ──────────────────────────────────────────────── */
export const IcoSettings = make(22, <><path d="M10.23 5.23L10.43 2.83h3.14l.2 2.4 1.77.73 1.83-1.55 2.22 2.22-1.55 1.83.73 1.77 2.4.2v3.14l-2.4.2-.73 1.77 1.55 1.83-2.22 2.22-1.83-1.55-1.77.73-.2 2.4h-3.14l-.2-2.4-1.77-.73-1.83 1.55-2.22-2.22 1.55-1.83-.73-1.77-2.4-.2v-3.14l2.4-.2.73-1.77-1.55-1.83 2.22-2.22 1.83 1.55z" /><circle cx="12" cy="12" r="3" /></>);
export const IcoShield = make(18, <path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6zM9 12l2 2 4-4" />);
export const IcoLock = make(18, <><rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5" /><path d="M8 10.5v-3a4 4 0 0 1 8 0v3M12 14.5V17" /></>);
export const IcoKey = make(18, <><circle cx="8" cy="15.5" r="4" /><path d="M10.9 12.6L20 3.5M16.5 7l2.5 2.5M14.3 9.2l2 2" /></>);
export const IcoLogout = make(18, <path d="M9.5 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3.5M15.5 16.5L20 12l-4.5-4.5M20 12H9.5" />);
export const IcoServer = make(18, <><rect x="3.5" y="4" width="17" height="7" rx="2" /><rect x="3.5" y="13" width="17" height="7" rx="2" /><path d="M7.5 7.5h.01M7.5 16.5h.01" /></>);
export const IcoGlobe = make(20, <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.4 2.5 3.7 5.5 3.7 9s-1.3 6.5-3.7 9c-2.4-2.5-3.7-5.5-3.7-9S9.6 5.5 12 3z" /></>);
export const IcoBadge = make(18, <><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="11" r="2" /><path d="M6 16c.5-1.3 1.6-2 3-2s2.5.7 3 2M14.5 10h3.5M14.5 13.5h3.5" /></>);
export const IcoTicket = make(18, <path d="M4.5 6h15A1.5 1.5 0 0 1 21 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5V14a2 2 0 0 0 0-4V7.5A1.5 1.5 0 0 1 4.5 6zM14.5 6v2.5M14.5 11v2M14.5 15.5V18" />);
export const IcoDesktop = make(20, <><rect x="3" y="4" width="18" height="12.5" rx="2" /><path d="M8.5 20.5h7M12 16.5v4" /></>);
export const IcoMobile = make(20, <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M11 18.5h2" /></>);
export const IcoPhoneIphone = IcoMobile;
export const IcoSun = make(20, <><circle cx="12" cy="12" r="4" /><path d="M12 2.8v1.7M12 19.5v1.7M2.8 12h1.7M19.5 12h1.7M5.5 5.5l1.2 1.2M17.3 17.3l1.2 1.2M5.5 18.5l1.2-1.2M17.3 6.7l1.2-1.2" /></>);
export const IcoMoon = make(20, <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />);
export const IcoAuto = make(20, <><circle cx="12" cy="12" r="9" /><path className="vx-f" d="M12 3a9 9 0 0 1 0 18z" /></>);
export const IcoVisibility = make(18, <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>);
export const IcoVisibilityOff = make(18, <path d="M3.5 3.5l17 17M10.5 5.6A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.6C4 8.4 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.4 4.3-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" />);

/* ── 补充（shell） ─────────────────────────────────────────────────────── */
// 检查更新 / 升级：圆环 + 向上箭头（与 IcoUpload 的托盘造型区分开）
export const IcoUpdate = make(18, <><circle cx="12" cy="12" r="9" /><path d="M12 16.5v-9M8.3 11.2L12 7.5l3.7 3.7" /></>);

/* ── 补充（chat） ─────────────────────────────────────────────────────── */
// 双勾（已送达 / 已读）：两枚错位的勾，右侧勾只画后半段，避免两条线叠成一团
export const IcoCheckDouble = make(16, <path d="M2 12.5l4.5 4.5L16 7.5M11.5 16l1 1L22 7.5" />);
// 截图：裁切角标造型（两只相扣的直角）
export const IcoScreenshot = make(20, <path d="M7 3v14h14M3 7h14v14" />);
// 分享：三个节点 + 两条连线（节点为描边圆，不填充）
export const IcoShare = make(18, <><circle cx="17.5" cy="5.5" r="2.5" /><circle cx="6.5" cy="12" r="2.5" /><circle cx="17.5" cy="18.5" r="2.5" /><path d="M8.7 10.7l6.6-3.9M8.7 13.3l6.6 3.9" /></>);
// 撤回：回转箭头（与 IcoReply 区分：撤回是带圆弧的回退）
export const IcoRecall = make(18, <path d="M9 14.5L4 9.5l5-5M4 9.5h10a5.5 5.5 0 0 1 0 11h-3" />);

/* ── 补充（people） ─────────────────────────────────────────────────────
   通讯录 / 资料卡 / 群管理 / 通话记录 用到、上面没有的字形（同一套 24 网格 + 1.8 描边规则） */
// 新的朋友：人像 + 信封（好友申请），与「添加好友」IcoUserPlus 区分
export const IcoUserRequest = make(20, <><circle cx="9.5" cy="8" r="3.8" /><path d="M3 20c.7-3.6 3.6-5.8 6.5-5.8 1 0 1.9.2 2.8.6" /><rect x="14" y="14" width="7.5" height="5.5" rx="1.2" /><path d="M14.4 14.8l3.35 2.4 3.35-2.4" /></>);
// 拍一拍：点按的手 + 一道触感弧
export const IcoNudge = make(20, <path d="M10 15.6V7.3a1.5 1.5 0 0 1 3 0v3.9l4.1.8a2 2 0 0 1 1.6 2.3l-.7 4.3a2.3 2.3 0 0 1-2.3 1.9h-4.4a2 2 0 0 1-1.5-.7l-3.4-3.9a1.3 1.3 0 0 1 1.9-1.8zM5.5 6.5a7 7 0 0 1 11 0" />);
// 禁止私聊：对话气泡 + 斜杠
export const IcoChatOff = make(18, <path d="M7.5 4.5H16A4.5 4.5 0 0 1 20.5 9v4.5a4.5 4.5 0 0 1-1.6 3.4M14.5 18h-3.7l-4.1 2.9a.6.6 0 0 1-.95-.5V17.6A4.5 4.5 0 0 1 3.5 13.5V9a4.5 4.5 0 0 1 1.2-3.1M3.5 3.5l17 17" />);
// 通话方向：去电 ↗ / 来电 ↙
export const IcoArrowUpRight = make(14, <path d="M7 17L17 7M8.5 7H17v8.5" />);
export const IcoArrowDownLeft = make(14, <path d="M17 7L7 17M15.5 17H7V8.5" />);
