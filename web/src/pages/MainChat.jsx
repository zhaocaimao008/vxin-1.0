import React, { useState, useRef, useEffect, useCallback } from 'react';

/* ══════════════════════════════════════════════════
   内联辅助工具（无外部依赖，纯 fake-data 演示模式）
══════════════════════════════════════════════════ */
const AV_COLORS = [
  '#1ABC9C','#3498DB','#9B59B6','#E67E22','#E74C3C',
  '#2ECC71','#F39C12','#07C160','#16A085','#8E44AD',
];
const getAvatarColor = (name) => {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++)
    h = name.charCodeAt(i) + ((h << 5) - h);
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
};

function Av({ name = '', src, size = 40, online = false }) {
  const r = Math.round(size * 0.22);
  const letter = (name || '?')[0].toUpperCase();
  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      {src
        ? <img src={src} alt={name} style={{ width: size, height: size, borderRadius: r, objectFit: 'cover', display: 'block' }} />
        : <div style={{ width: size, height: size, borderRadius: r, background: getAvatarColor(name), color: '#fff', fontSize: size * 0.42, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{letter}</div>
      }
      {online && <span style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, background: '#44C464', borderRadius: '50%', border: '1.5px solid #F0F0F0' }} />}
    </div>
  );
}

/* 群组头像：4宫格拼接 */
function GroupAv({ names = [], size = 46 }) {
  const r = Math.round(size * 0.12);
  const shown = names.slice(0, 4);
  const cellSize = shown.length === 1 ? size * 0.7 : shown.length <= 4 ? size * 0.46 : size * 0.32;
  const gap = size * 0.04;
  return (
    <div style={{ width: size, height: size, borderRadius: r, background: '#D9D9D9', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap, padding: gap * 1.5, flexShrink: 0, overflow: 'hidden' }}>
      {shown.map((n, i) => (
        <div key={i} style={{ width: cellSize, height: cellSize, borderRadius: cellSize * 0.2, background: getAvatarColor(n), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: cellSize * 0.48, fontWeight: 600, flexShrink: 0 }}>
          {(n || '?')[0].toUpperCase()}
        </div>
      ))}
    </div>
  );
}

function fmtTime(ts) {
  const now = Date.now(), d = new Date(ts), diff = now - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (d >= today) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (d >= yest) return '昨天';
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}
function fmtFull(ts) {
  const d = new Date(ts);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (d >= today) return time;
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (d >= yest) return '昨天 ' + time;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`;
}

/* ══════════════════════════════════════════════════
   SVG 图标
══════════════════════════════════════════════════ */
const IcoChat     = () => <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>;
const IcoContacts = () => <svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>;
const IcoDiscover = () => <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1.41-5.17L16 12l-5.41-4.83L9 9l4 3-4 3 1.59 1.83z"/></svg>;
const IcoMe       = () => <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>;
const IcoSettings = () => <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>;
const IcoSearch   = () => <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>;
const IcoAdd      = () => <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>;
const IcoVideo    = () => <svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>;
const IcoPhone    = () => <svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>;
const IcoMore     = () => <svg viewBox="0 0 24 24"><path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>;
const IcoEmoji    = () => <svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>;
const IcoFile     = () => <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>;
const IcoScissor  = () => <svg viewBox="0 0 24 24"><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3h-3z"/></svg>;
const IcoMic      = () => <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93h2c0 3.31 2.69 6 6 6s6-2.69 6-6h2c0 4.08-3.06 7.44-7 7.93V19h3v2H9v-2h3v-3.07z"/></svg>;
const IcoChevron  = () => <svg viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>;
const IcoPinned   = () => <svg viewBox="0 0 24 24"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>;

/* ══════════════════════════════════════════════════
   Fake 数据
══════════════════════════════════════════════════ */
const NOW = Date.now();
const MIN = 60000;
const HR  = 3600000;
const DAY = 86400000;

const INIT_CONVS = [
  { id:1,  name:'微信团队',     type:'private', members:[], lastMsg:'欢迎使用 v信！祝使用愉快 😊',            lastTime:NOW-2*MIN,   unread:0, pinned:true  },
  { id:2,  name:'张明',         type:'private', members:[], lastMsg:'明天下午有空吗？商量一下项目进度',        lastTime:NOW-8*MIN,   unread:3  },
  { id:3,  name:'前端开发群',   type:'group',   members:['王华','刘思','赵磊','李欣','陈博'], lastMsg:'王华: 接口文档已更新，大家看一下', lastTime:NOW-22*MIN,  unread:12 },
  { id:4,  name:'王晓雪',       type:'private', members:[], lastMsg:'好的，收到了，谢谢你 😊',                lastTime:NOW-1.2*HR,  unread:0  },
  { id:5,  name:'李强',         type:'private', members:[], lastMsg:'[图片]',                                 lastTime:NOW-2*HR,    unread:1  },
  { id:6,  name:'产品设计讨论', type:'group',   members:['赵磊','林悦','孙磊','王芳'],       lastMsg:'赵磊: 原型图已经发到群里了',        lastTime:NOW-3*HR,    unread:0  },
  { id:7,  name:'陈志远',       type:'private', members:[], lastMsg:'你好，最近怎么样？',                     lastTime:NOW-1*DAY,   unread:0  },
  { id:8,  name:'同学群',       type:'group',   members:['刘洋','何静','张伟','周婷','马超'], lastMsg:'刘洋: 周末聚餐的事定了吗',         lastTime:NOW-2*DAY,   unread:0  },
  { id:9,  name:'赵薇',         type:'private', members:[], lastMsg:'我发你的文件看到了吗',                   lastTime:NOW-3*DAY,   unread:0  },
];

const INIT_MESSAGES = {
  1:[
    { id:101, mine:false, name:'微信团队', text:'欢迎使用 v信！这是一款高保真微信 PC 端复刻应用。', ts:NOW-30*MIN },
    { id:102, mine:false, name:'微信团队', text:'您可以通过左侧导航栏切换不同功能区域，点击联系人即可开始聊天。', ts:NOW-28*MIN },
    { id:103, mine:true,  name:'我',       text:'好的，谢谢！', ts:NOW-10*MIN },
    { id:104, mine:false, name:'微信团队', text:'欢迎使用 v信！祝使用愉快 😊', ts:NOW-2*MIN },
  ],
  2:[
    { id:201, mine:false, name:'张明', text:'嘿！最近在忙什么？', ts:NOW-1.5*HR },
    { id:202, mine:true,  name:'我',   text:'在做一个 IM 应用，React + 毛玻璃风格，你呢？', ts:NOW-1.3*HR },
    { id:203, mine:false, name:'张明', text:'我在优化大列表渲染，虚拟滚动有点头大😅', ts:NOW-1.1*HR },
    { id:204, mine:true,  name:'我',   text:'可以试试 react-window，配合 IntersectionObserver 效果很好', ts:NOW-1*HR },
    { id:205, mine:false, name:'张明', text:'好的！我试试，感谢大佬 👍', ts:NOW-55*MIN },
    { id:206, mine:false, name:'张明', text:'对了，明天下午有空吗？我们商量一下项目进度', ts:NOW-8*MIN },
  ],
  3:[
    { id:301, mine:false, name:'王华',  text:'大家好，今天讨论本周开发计划', ts:NOW-2*HR, group:true },
    { id:302, mine:false, name:'刘思',  text:'UI 部分基本完成，今天可以联调', ts:NOW-1.8*HR, group:true },
    { id:303, mine:true,  name:'我',    text:'接口还差两个，今天能完成', ts:NOW-1.5*HR, group:true },
    { id:304, mine:false, name:'赵磊',  text:'测试环境搭好了，随时可以', ts:NOW-1.2*HR, group:true },
    { id:305, mine:false, name:'王华',  text:'那下午 3 点联调，不见不散 😄', ts:NOW-1*HR, group:true },
    { id:306, mine:false, name:'刘思',  text:'@我 标注文件什么时候给？', ts:NOW-40*MIN, group:true },
    { id:307, mine:false, name:'王华',  text:'接口文档已更新，大家看一下', ts:NOW-22*MIN, group:true },
  ],
  4:[
    { id:401, mine:true,  name:'我',     text:'你好，最近怎么样？有什么新动态吗', ts:NOW-3*HR },
    { id:402, mine:false, name:'王晓雪', text:'挺好的！最近在学设计系统，你在做什么项目？', ts:NOW-2.8*HR },
    { id:403, mine:true,  name:'我',     text:'微信 PC 端高保真复刻，React + Tailwind CSS', ts:NOW-2.6*HR },
    { id:404, mine:false, name:'王晓雪', text:'哇，好酷！有没有用到毛玻璃效果？', ts:NOW-2.4*HR },
    { id:405, mine:true,  name:'我',     text:'用了！backdrop-filter + 半透明背景，效果很棒', ts:NOW-2.2*HR },
    { id:406, mine:false, name:'王晓雪', text:'好的，收到了，谢谢你 😊', ts:NOW-1.2*HR },
  ],
  5:[
    { id:501, mine:false, name:'李强', text:'最近项目怎么样了？', ts:NOW-5*HR },
    { id:502, mine:true,  name:'我',   text:'进展不错，快完成了', ts:NOW-4.5*HR },
    { id:503, mine:false, name:'李强', text:'发你一张效果图', ts:NOW-2*HR, isImage:true },
  ],
  6:[
    { id:601, mine:false, name:'林悦', text:'大家好，这是本次迭代的设计方案', ts:NOW-5*HR, group:true },
    { id:602, mine:true,  name:'我',   text:'看起来不错，交互逻辑很清晰', ts:NOW-4.5*HR, group:true },
    { id:603, mine:false, name:'赵磊', text:'原型图已经发到群里了', ts:NOW-3*HR, group:true },
  ],
  7:[
    { id:701, mine:false, name:'陈志远', text:'你好，最近怎么样？', ts:NOW-1*DAY },
    { id:702, mine:true,  name:'我',     text:'还好，你呢？', ts:NOW-23*HR },
  ],
  8:[
    { id:801, mine:false, name:'刘洋', text:'大家好！', ts:NOW-3*DAY, group:true },
    { id:802, mine:false, name:'何静', text:'周末聚餐地点定了吗？', ts:NOW-2.5*DAY, group:true },
    { id:803, mine:false, name:'刘洋', text:'周末聚餐的事定了吗', ts:NOW-2*DAY, group:true },
  ],
  9:[
    { id:901, mine:false, name:'赵薇', text:'我发你的文件看到了吗？', ts:NOW-3*DAY },
    { id:902, mine:true,  name:'我',   text:'看到了，谢谢', ts:NOW-2.9*DAY },
  ],
};

const FAKE_CONTACTS = [
  { letter:'C', items:[{ id:7, name:'陈志远', online:false }, { id:9, name:'陈博',  online:true }] },
  { letter:'H', items:[{ id:14,name:'何静',   online:false }] },
  { letter:'L', items:[{ id:5, name:'李强',   online:true  }, { id:15,name:'李欣',  online:false }, { id:11,name:'林悦',  online:true  }, { id:16,name:'刘思',  online:false }, { id:17,name:'刘洋',  online:false }] },
  { letter:'M', items:[{ id:18,name:'马超',   online:false }] },
  { letter:'S', items:[{ id:13,name:'孙磊',   online:true  }] },
  { letter:'W', items:[{ id:4, name:'王晓雪', online:true  }, { id:10,name:'王华',  online:false }, { id:12,name:'王芳',  online:false }] },
  { letter:'Z', items:[{ id:9, name:'赵薇',   online:false }, { id:6, name:'赵磊',  online:true  }, { id:2, name:'张明',  online:true  }, { id:19,name:'周婷',  online:false }] },
];

const EMOJIS = [
  '😀','😄','😃','😊','😍','🥰','😎','🤩','😏','😉',
  '🤣','😂','😅','😆','😋','😜','🤔','🤨','😐','😑',
  '🙁','😮','😲','😱','😢','😭','🤗','😴','🤧','🥴',
  '👍','👎','👏','🙌','🤝','✌️','🤜','💪','🫶','🙏',
  '❤️','💕','💯','🎉','🔥','✨','🌟','🍺','🎂','🎁',
];

/* ══════════════════════════════════════════════════
   空状态
══════════════════════════════════════════════════ */
function WcEmpty() {
  return (
    <div className="wc-empty">
      <svg viewBox="0 0 62 52" style={{ width: 62, height: 52, marginBottom: 14 }}>
        <path fill="rgba(7,193,96,0.5)"  d="M20 1C9.5 1 1 7.8 1 16.2c0 4.7 2.5 8.9 6.5 11.7l-1.2 5.8 6.8-3.9c2.2.5 4.5.8 6.9.8 10.5 0 19-6.8 19-15.2S30.5 1 20 1z"/>
        <path fill="#07C160"              d="M40 13C28.4 13 19 20.5 19 29.7c0 5.3 2.9 10 7.6 13.1l-1.3 6.2 7.8-4.6c2.5.6 5.1.9 7.9.9 11.6 0 21-7.5 21-16.7S51.6 13 40 13z"/>
      </svg>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', letterSpacing: '.3px' }}>v信</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   截图 Modal
══════════════════════════════════════════════════ */
function ScreenshotModal({ onClose }) {
  const [stage, setStage] = useState('capture'); // capture → preview → done

  const handleCapture = () => setStage('preview');
  const handleConfirm = () => { onClose(); };

  return (
    <div className="wc-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="wc-modal wide" style={{ width: 540 }}>
        <div className="wc-modal-header">
          <span className="wc-modal-title">截图</span>
          <button className="wc-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="wc-modal-body" style={{ padding: 0 }}>
          {stage === 'capture' ? (
            <div style={{ background: '#1a1a2e', position: 'relative', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {/* 模拟桌面内容 */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', opacity: .9 }} />
              <div style={{ position: 'absolute', top: 20, left: 20, right: 20, height: 28, background: 'rgba(255,255,255,.08)', borderRadius: 6, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF5F57' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FEBC2E' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28C840' }} />
                <div style={{ flex:1, height: 16, background: 'rgba(255,255,255,.1)', borderRadius: 3, marginLeft: 8 }} />
              </div>
              {/* 选区框（拖拽框模拟） */}
              <div style={{ position: 'absolute', left: 60, top: 60, right: 60, bottom: 60, border: '2px solid #07C160', borderRadius: 2, boxShadow: '0 0 0 9999px rgba(0,0,0,.55)' }}>
                {/* 角标 */}
                {[['0%','0%'],['100%','0%'],['0%','100%'],['100%','100%']].map(([l,t],i) => (
                  <div key={i} style={{ position:'absolute', left:l, top:t, width:8, height:8, background:'#07C160', transform:'translate(-50%,-50%)' }} />
                ))}
                <div style={{ position:'absolute', bottom:-28, right:0, display:'flex', gap:6 }}>
                  <div style={{ background:'#07C160', color:'#fff', fontSize:11, padding:'3px 10px', borderRadius:3, cursor:'pointer', fontWeight:500 }} onClick={handleCapture}>截取</div>
                  <div style={{ background:'rgba(255,255,255,.15)', color:'#fff', fontSize:11, padding:'3px 10px', borderRadius:3, cursor:'pointer' }} onClick={onClose}>取消</div>
                </div>
                {/* 尺寸标注 */}
                <div style={{ position:'absolute', top:-22, left:0, fontSize:10, color:'#07C160', background:'rgba(0,0,0,.7)', padding:'2px 6px', borderRadius:2 }}>360 × 180</div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 20 }}>
              <div style={{ background: '#F5F5F5', borderRadius: 6, overflow: 'hidden', marginBottom: 14, border: '1px solid #E5E5E5' }}>
                <div style={{ background: 'linear-gradient(135deg,#0f0c29,#302b63)', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, letterSpacing: 1 }}>[ 截图区域预览 ]</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#888', marginBottom: 12 }}>
                <span>尺寸: 360 × 180 px</span>
                <span style={{ marginLeft: 'auto', color: '#07C160', cursor: 'pointer' }} onClick={() => setStage('capture')}>重新截图</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex:1, padding:'7px 0', background:'#F5F5F5', borderRadius:4, textAlign:'center', fontSize:13, color:'#555', cursor:'pointer', border:'1px solid #E5E5E5' }} onClick={onClose}>关闭</div>
                <div style={{ flex:1, padding:'7px 0', background:'#07C160', borderRadius:4, textAlign:'center', fontSize:13, color:'#fff', cursor:'pointer', fontWeight:500 }} onClick={handleConfirm}>发送到聊天</div>
                <div style={{ flex:1, padding:'7px 0', background:'#F5F5F5', borderRadius:4, textAlign:'center', fontSize:13, color:'#555', cursor:'pointer', border:'1px solid #E5E5E5' }}>保存图片</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   ChatWindow（自包含，仅 fake 数据）
══════════════════════════════════════════════════ */
function ChatWindow({ conv, messages, onSend, onClose }) {
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null);
  const endRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setInput(''); setShowEmoji(false); setVoiceMode(false);
  }, [conv.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const doSend = useCallback(() => {
    const t = input.trim();
    if (!t) return;
    onSend(conv.id, t);
    setInput('');
    setShowEmoji(false);
  }, [input, conv.id, onSend]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  };

  const insertEmoji = (em) => {
    setInput(p => p + em);
    textareaRef.current?.focus();
  };

  /* 消息时间分割 */
  const items = [];
  let lastTs = 0;
  messages.forEach(msg => {
    if (msg.ts - lastTs > 5 * MIN) {
      items.push({ type:'time', ts: msg.ts, id: 't_' + msg.id });
      lastTs = msg.ts;
    }
    items.push({ type:'msg', ...msg });
  });

  const memberCount = conv.type === 'group' ? conv.members.length : null;

  return (
    <div className="wc-chat">
      {/* ── Header ── */}
      <div className="wc-chat-header">
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div className="wc-chat-header-name">
            {conv.name}
            {memberCount ? <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 5 }}>({memberCount})</span> : null}
          </div>
          {conv.type === 'private' && (
            <div className="wc-chat-header-sub">在线</div>
          )}
        </div>
        <div className="wc-chat-header-right">
          {conv.type === 'private' && <>
            <button className="wc-chat-header-btn" title="语音通话"><IcoPhone /></button>
            <button className="wc-chat-header-btn" title="视频通话"><IcoVideo /></button>
          </>}
          <button className="wc-chat-header-btn" title="更多"><IcoMore /></button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="wc-messages">
        {items.map(item => {
          if (item.type === 'time') {
            return (
              <div key={item.id} className="wc-msg-time">
                <span>{fmtFull(item.ts)}</span>
              </div>
            );
          }
          const isMine = item.mine;
          return (
            <div
              key={item.id}
              className={`wc-msg-row${isMine ? ' mine' : ''}`}
              onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: Math.min(e.clientX, window.innerWidth - 170), y: Math.min(e.clientY, window.innerHeight - 200), msg: item }); }}
            >
              <div className="wc-msg-avatar">
                <Av name={item.name} size={38} />
              </div>
              <div className="wc-msg-body">
                {!isMine && conv.type === 'group' && (
                  <div className="wc-msg-sender">{item.name}</div>
                )}
                <div className="wc-msg-bubble-wrap">
                  {isMine && <div className="wc-msg-read" style={{ color: '#B2B2B2' }}>✓✓</div>}
                  {item.isImage ? (
                    <div className={`wc-msg-bubble ${isMine ? 'mine' : 'other'}`} style={{ padding: 4 }}>
                      <div style={{ width: 160, height: 120, background: 'linear-gradient(135deg,#667eea,#764ba2)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.7)', fontSize: 12 }}>📷 图片</div>
                    </div>
                  ) : (
                    <div className={`wc-msg-bubble ${isMine ? 'mine' : 'other'}`}>
                      {item.text}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* ── Emoji Picker ── */}
      {showEmoji && (
        <div style={{ background: '#FAFAFA', borderTop: '1px solid rgba(0,0,0,.07)', padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: 2, maxHeight: 130, overflowY: 'auto', flexShrink: 0 }}>
          {EMOJIS.map(em => (
            <button key={em} className="wc-emoji-btn" onClick={() => insertEmoji(em)}>{em}</button>
          ))}
        </div>
      )}

      {/* ── Input Area ── */}
      <div className="wc-input-area">
        {/* Toolbar */}
        <div className="wc-input-toolbar">
          <button
            className={`wc-tool-btn${showEmoji ? ' active' : ''}`}
            title="表情"
            onClick={() => setShowEmoji(v => !v)}
          ><IcoEmoji /></button>
          <button className="wc-tool-btn" title="文件"><IcoFile /></button>
          <button
            className="wc-tool-btn"
            title="截图"
            onClick={() => setShowScreenshot(true)}
          ><IcoScissor /></button>
          <button
            className={`wc-tool-btn${voiceMode ? ' active' : ''}`}
            title="语音输入"
            onClick={() => setVoiceMode(v => !v)}
          ><IcoMic /></button>
        </div>

        {/* 语音模式 */}
        {voiceMode ? (
          <div style={{ padding: '4px 14px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="wc-voice-btn"
              onMouseDown={() => {}}
              style={{ flex: 1, height: 36, background: '#fff', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              按住 说话
            </button>
          </div>
        ) : (
          <>
            <div className="wc-input-box">
              <textarea
                ref={textareaRef}
                className="wc-textarea"
                placeholder="输入消息..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
              />
            </div>
            <div className="wc-input-footer">
              <span className="wc-input-hint">Enter 发送，Shift+Enter 换行</span>
              <button
                className={`wc-send-btn${input.trim() ? ' active' : ''}`}
                onClick={doSend}
                disabled={!input.trim()}
              >发送</button>
            </div>
          </>
        )}
      </div>

      {/* 右键菜单 */}
      {ctxMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setCtxMenu(null)} />
          <div className="wc-ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
            <div className="wc-ctx-emoji-row">
              {['👍','❤️','😄','😮','😢','🙏'].map(em => (
                <div key={em} className="wc-ctx-emoji" onClick={() => setCtxMenu(null)}>{em}</div>
              ))}
            </div>
            <div className="wc-ctx-item" onClick={() => setCtxMenu(null)}>回复</div>
            <div className="wc-ctx-item" onClick={() => setCtxMenu(null)}>复制</div>
            <div className="wc-ctx-item" onClick={() => setCtxMenu(null)}>转发</div>
            <div className="wc-ctx-divider" />
            <div className="wc-ctx-item danger" onClick={() => setCtxMenu(null)}>删除</div>
          </div>
        </>
      )}

      {/* 截图 Modal */}
      {showScreenshot && <ScreenshotModal onClose={() => setShowScreenshot(false)} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   发现页（静态）
══════════════════════════════════════════════════ */
function DiscoverPage() {
  const sections = [
    [
      { icon: '📺', bg: '#4ECDC4', label: '视频号' },
    ],
    [
      { icon: '🔍', bg: '#45B7D1', label: '搜一搜' },
      { icon: '📍', bg: '#96CEB4', label: '附近' },
    ],
    [
      { icon: '🛍', bg: '#FFEAA7', label: '购物' },
      { icon: '🎮', bg: '#DDA0DD', label: '游戏' },
    ],
    [
      { icon: '🔖', bg: '#F0E68C', label: '收藏' },
    ],
  ];
  return (
    <div className="wc-discover">
      {sections.map((sec, si) => (
        <div key={si} className="wc-discover-section">
          {sec.map(item => (
            <div key={item.label} className="wc-discover-item">
              <div className="wc-discover-icon" style={{ background: item.bg }}>{item.icon}</div>
              <span className="wc-discover-label">{item.label}</span>
              <span className="wc-discover-arrow">›</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   我页（静态）
══════════════════════════════════════════════════ */
function ProfilePage() {
  return (
    <div className="wc-profile">
      {/* 个人信息卡 */}
      <div className="wc-profile-card">
        <Av name="我" size={64} />
        <div className="wc-profile-info">
          <div className="wc-profile-name">v信用户</div>
          <div className="wc-profile-wid">微信号：vxin_demo</div>
        </div>
        <span style={{ color: '#C7C7CC', fontSize: 18 }}>›</span>
      </div>

      <div className="wc-menu-section">
        {[
          { icon: '🎁', bg: '#FF6B6B', label: '收藏' },
          { icon: '💳', bg: '#45B7D1', label: '卡包' },
          { icon: '😊', bg: '#96CEB4', label: '表情' },
        ].map(item => (
          <div key={item.label} className="wc-menu-item">
            <div className="wc-menu-icon" style={{ background: item.bg }}>{item.icon}</div>
            <span className="wc-menu-label">{item.label}</span>
            <span className="wc-menu-arrow">›</span>
          </div>
        ))}
      </div>

      <div className="wc-menu-section">
        {[
          { icon: '⚙️', bg: '#778CA3', label: '设置' },
        ].map(item => (
          <div key={item.label} className="wc-menu-item">
            <div className="wc-menu-icon" style={{ background: item.bg }}>{item.icon}</div>
            <span className="wc-menu-label">{item.label}</span>
            <span className="wc-menu-arrow">›</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MainChat — 主入口
══════════════════════════════════════════════════ */
let _msgId = 9999;

export default function MainChat() {
  const [tab, setTab]             = useState('chats');
  const [convs, setConvs]         = useState(INIT_CONVS);
  const [msgs, setMsgs]           = useState(INIT_MESSAGES);
  const [activeConv, setActiveConv] = useState(null);
  const [search, setSearch]       = useState('');
  const [ctxConv, setCtxConv]     = useState(null);

  /* 徽章数（取自 convs） */
  const totalUnread = convs.reduce((s, c) => s + (c.unread || 0), 0);
  const badges = { chats: totalUnread };

  /* 选中会话 */
  const selectConv = (conv) => {
    setActiveConv(conv);
    setConvs(prev => prev.map(c => c.id === conv.id ? { ...c, unread: 0 } : c));
    setTab('chats');
  };

  /* 发送消息 */
  const handleSend = useCallback((convId, text) => {
    const newMsg = { id: ++_msgId, mine: true, name: '我', text, ts: Date.now() };
    setMsgs(prev => ({ ...prev, [convId]: [...(prev[convId] || []), newMsg] }));
    setConvs(prev => prev.map(c =>
      c.id === convId ? { ...c, lastMsg: text, lastTime: Date.now() } : c
    ).sort((a, b) => (b.pinned || 0) - (a.pinned || 0) || b.lastTime - a.lastTime));
  }, []);

  /* 搜索过滤 */
  const filtered = convs.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.lastMsg.toLowerCase().includes(search.toLowerCase())
  );

  /* 会话列表面板 */
  const renderChatList = () => (
    <>
      <div className="wc-panel-topbar">
        <div className="wc-search">
          <span className="wc-search-icon"><IcoSearch /></span>
          <input
            placeholder="搜索"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button style={{ color: 'var(--text-tertiary)', fontSize: 14, lineHeight: 1 }} onClick={() => setSearch('')}>✕</button>
          )}
        </div>
        <button className="wc-icon-btn" title="发起聊天"><IcoAdd /></button>
      </div>

      <div className="wc-list">
        {filtered.map(conv => {
          const count = conv.unread || 0;
          return (
            <div
              key={conv.id}
              className={`wc-chat-item${activeConv?.id === conv.id ? ' active' : ''}${conv.pinned ? ' pinned' : ''}`}
              onClick={() => selectConv(conv)}
              onContextMenu={e => { e.preventDefault(); setCtxConv({ x: Math.min(e.clientX, window.innerWidth - 160), y: Math.min(e.clientY, window.innerHeight - 120), conv }); }}
              style={conv.pinned && activeConv?.id !== conv.id ? { background: '#F9F9F9' } : undefined}
            >
              <div className="wc-chat-item-avatar">
                {conv.type === 'group'
                  ? <GroupAv names={conv.members} size={46} />
                  : <Av name={conv.name} size={46} />
                }
                {count > 0 && (
                  <span className="wc-chat-item-badge">{count > 99 ? '99+' : count}</span>
                )}
              </div>
              <div className="wc-chat-item-info">
                <div className="wc-chat-item-row1">
                  <span className="wc-chat-item-name">{conv.name}</span>
                  <span className="wc-chat-item-time">{fmtTime(conv.lastTime)}</span>
                </div>
                <div className="wc-chat-item-preview">{conv.lastMsg}</div>
              </div>
              {conv.pinned && (
                <svg viewBox="0 0 24 24" style={{ position: 'absolute', top: 7, right: 8, width: 10, height: 10, fill: 'var(--text-tertiary)' }}>
                  <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>
                </svg>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#B2B2B2', fontSize: 13 }}>
            {search ? '未找到相关会话' : '暂无会话'}
          </div>
        )}
      </div>

      {/* 会话右键菜单 */}
      {ctxConv && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setCtxConv(null)} />
          <div className="wc-ctx-menu" style={{ left: ctxConv.x, top: ctxConv.y }}>
            <div className="wc-ctx-item" onClick={() => {
              setConvs(prev => prev.map(c => c.id === ctxConv.conv.id ? { ...c, pinned: !c.pinned } : c).sort((a,b)=>(b.pinned||0)-(a.pinned||0)||b.lastTime-a.lastTime));
              setCtxConv(null);
            }}>
              {ctxConv.conv.pinned ? '取消置顶' : '置顶聊天'}
            </div>
            <div className="wc-ctx-item" onClick={() => setCtxConv(null)}>消息免打扰</div>
            <div className="wc-ctx-divider" />
            <div className="wc-ctx-item danger" onClick={() => setCtxConv(null)}>删除聊天</div>
          </div>
        </>
      )}
    </>
  );

  /* 通讯录面板 */
  const renderContacts = () => (
    <>
      <div className="wc-panel-topbar">
        <div className="wc-search">
          <span className="wc-search-icon"><IcoSearch /></span>
          <input placeholder="搜索联系人" />
        </div>
        <button className="wc-icon-btn" title="添加朋友"><IcoAdd /></button>
      </div>
      <div className="wc-list">
        {/* 功能入口 */}
        {[
          { icon:'👤', bg:'#07C160', label:'新的朋友',    sub:'暂无新申请' },
          { icon:'👥', bg:'#3498DB', label:'群聊',       sub:'' },
          { icon:'🏷', bg:'#9B59B6', label:'标签',       sub:'' },
          { icon:'💻', bg:'#E67E22', label:'公众号',     sub:'' },
        ].map(item => (
          <div key={item.label} className="wc-contact-item" style={{ height: 56 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
            <div>
              <div className="wc-contact-item-name">{item.label}</div>
              {item.sub && <div className="wc-contact-item-sub">{item.sub}</div>}
            </div>
          </div>
        ))}
        {/* 按字母分组联系人 */}
        {FAKE_CONTACTS.map(group => (
          <React.Fragment key={group.letter}>
            <div className="wc-contacts-alpha">{group.letter}</div>
            {group.items.map(c => (
              <div key={c.id} className="wc-contact-item" onClick={() => selectConv(convs.find(v => v.id === c.id) || { id: c.id, name: c.name, type: 'private', members: [], lastMsg: '', lastTime: Date.now(), unread: 0 })}>
                <Av name={c.name} size={40} online={c.online} />
                <div>
                  <div className="wc-contact-item-name">{c.name}</div>
                  {c.online && <div className="wc-contact-item-sub" style={{ color: '#07C160' }}>在线</div>}
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </>
  );

  /* 面板渲染 */
  const renderPanel = () => {
    switch (tab) {
      case 'chats':    return renderChatList();
      case 'contacts': return renderContacts();
      case 'discover': return (
        <>
          <div className="wc-panel-topbar">
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>发现</span>
          </div>
          <DiscoverPage />
        </>
      );
      case 'profile': return (
        <>
          <div className="wc-panel-topbar">
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>我</span>
          </div>
          <ProfilePage />
        </>
      );
      default: return null;
    }
  };

  return (
    <div className="wc-app">
      {/* ── Sidebar ── */}
      <div className="wc-sidebar">
        {/* 头像 */}
        <div className="wc-sidebar-avatar" title="个人资料" style={{ cursor: 'pointer' }} onClick={() => setTab('profile')}>
          <Av name="我" size={36} />
        </div>

        {/* 导航 */}
        <div className="wc-sidebar-nav">
          {[
            { key: 'chats',    label: '消息',   Icon: IcoChat     },
            { key: 'contacts', label: '通讯录', Icon: IcoContacts },
            { key: 'discover', label: '发现',   Icon: IcoDiscover },
            { key: 'profile',  label: '我',     Icon: IcoMe       },
          ].map(({ key, label, Icon }) => {
            const count = badges[key] || 0;
            return (
              <div
                key={key}
                className={`wc-sidebar-btn${tab === key ? ' active' : ''}`}
                onClick={() => setTab(key)}
                title={label}
              >
                <div className="icon"><Icon /></div>
                <span className="wc-tip">{label}</span>
                {count > 0 && (
                  <span className="wc-sidebar-badge">{count > 99 ? '99+' : count}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* 底部设置 */}
        <div className="wc-sidebar-bottom">
          <div className="wc-sidebar-btn" title="设置">
            <div className="icon"><IcoSettings /></div>
            <span className="wc-tip">设置</span>
          </div>
        </div>
      </div>

      {/* ── Panel ── */}
      <div className="wc-panel" style={{ position: 'relative' }}>
        {renderPanel()}
      </div>

      {/* ── Chat / Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'chats' || tab === 'contacts' ? (
          activeConv
            ? <ChatWindow
                conv={activeConv}
                messages={msgs[activeConv.id] || []}
                onSend={handleSend}
                onClose={() => setActiveConv(null)}
              />
            : <WcEmpty />
        ) : (
          <WcEmpty />
        )}
      </div>
    </div>
  );
}
