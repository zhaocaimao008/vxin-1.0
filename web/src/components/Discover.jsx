import React, { useState, useCallback, useEffect, useRef } from 'react';
import MomentsPage from '../pages/MomentsPage';

// ── 内联 Toast（零外部依赖）────────────────────────────────────
let _toastTimer = null;
function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,.72)', color: '#fff', padding: '8px 18px',
      borderRadius: 6, fontSize: 13, zIndex: 9999, pointerEvents: 'none',
      whiteSpace: 'nowrap', animation: 'fadeIn .15s ease',
    }}>
      {message}
    </div>
  );
}

function useToast() {
  const [msg, setMsg] = useState('');
  const show = useCallback((text) => {
    setMsg(text);
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => setMsg(''), 2400);
  }, []);
  return { toastMsg: msg, showToast: show };
}

// ── SVG Icons ────────────────────────────────────────────────────
const Icons = {
  video:   <svg viewBox="0 0 24 24" style={{ width:20,height:20,fill:'#fff' }}><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>,
  moments: <svg viewBox="0 0 24 24" style={{ width:20,height:20,fill:'#fff' }}><path d="M9 17l-5-5 1.41-1.41L9 14.17l9.59-9.59L20 6l-11 11z"/></svg>,
  scan:    <svg viewBox="0 0 24 24" style={{ width:20,height:20,fill:'#fff' }}><path d="M9.5 6.5v3h-3v-3h3M11 5H5v6h6V5zm-1.5 9.5v3h-3v-3h3M11 13H5v6h6v-6zm6.5-6.5v3h-3v-3h3M19 5h-6v6h6V5zm-6 8h1.5v1.5H13V13zm1.5 1.5H16V16h-1.5v-1.5zM16 13h1.5v1.5H16V13zm-3 3h1.5v1.5H13V16zm1.5 1.5H16V19h-1.5v-1.5zM16 16h1.5v1.5H16V16zm1.5-1.5H19V16h-1.5v-1.5zm0 3H19V19h-1.5v-1.5z"/></svg>,
  shake:   <svg viewBox="0 0 24 24" style={{ width:20,height:20,fill:'#fff' }}><path d="M7.72 3.37l-1.42-1.41C4.1 4.16 3 6.97 3 10h2c0-2.49.97-4.74 2.72-6.63zM17.71 1.96L16.3 3.37C18.03 5.26 19 7.51 19 10h2c0-3.03-1.1-5.84-3.29-8.04zM16 9h-2V5h-4v4H8l4 4 4-4zM8 15v2h8v-2H8zm-2 4v2h12v-2H6z"/></svg>,
  look:    <svg viewBox="0 0 24 24" style={{ width:20,height:20,fill:'#fff' }}><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>,
  search:  <svg viewBox="0 0 24 24" style={{ width:20,height:20,fill:'#fff' }}><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>,
  nearby:  <svg viewBox="0 0 24 24" style={{ width:20,height:20,fill:'#fff' }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>,
  shop:    <svg viewBox="0 0 24 24" style={{ width:20,height:20,fill:'#fff' }}><path d="M19.5 3.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2v14H3v3c0 1.66 1.34 3 3 3h12c1.66 0 3-1.34 3-3V2l-1.5 1.5zM19 19c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-1h14v1zm0-3H8V5h11v11z"/></svg>,
  game:    <svg viewBox="0 0 24 24" style={{ width:20,height:20,fill:'#fff' }}><path d="M15 7.5V2H9v5.5l3 3 3-3zM7.5 9H2v6h5.5l3-3-3-3zM9 16.5V22h6v-5.5l-3-3-3 3zM16.5 9l-3 3 3 3H22V9h-5.5z"/></svg>,
  miniapp: <svg viewBox="0 0 24 24" style={{ width:20,height:20,fill:'#fff' }}><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>,
};

// ── 配置表：label / 是否已实现 / 颜色 ───────────────────────────
const SECTIONS = [
  [
    { key:'moments', color:'#07C160', label:'朋友圈',   impl:'moments' },
  ],
  [{ key:'video',   color:'#181818', label:'视频号',   impl:false }],
  [
    { key:'scan',   color:'#333',    label:'扫一扫',   impl:'scan' },
    { key:'shake',  color:'#333',    label:'摇一摇',   impl:false },
  ],
  [
    { key:'look',   color:'#FF7A45', label:'看一看',   impl:false },
    { key:'search', color:'#1890FF', label:'搜一搜',   impl:false },
  ],
  [{ key:'nearby',  color:'#FA5151', label:'附近的人', impl:false }],
  [
    { key:'shop',   color:'#FA8C16', label:'购物',     impl:false },
    { key:'game',   color:'#7B61FF', label:'游戏',     impl:false },
  ],
  [{ key:'miniapp', color:'#444',    label:'小程序',   impl:false }],
];

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" style={{ width:14,height:14,fill:'#C7C7CC',flexShrink:0 }}>
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
  </svg>
);

// ── 扫一扫（调用摄像头解析 QR，降级为 toast）───────────────────
function ScanModal({ onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
      .then(s => { stream = s; if (videoRef.current) videoRef.current.srcObject = s; })
      .catch(() => setError('无法访问摄像头，请检查权限'));
    return () => stream?.getTracks().forEach(t => t.stop());
  }, []);

  return (
    <div style={{ position:'fixed', inset:0, zIndex:3000, background:'#000', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', zIndex:1 }}>
        <button style={{ color:'#fff', fontSize:15 }} onClick={onClose}>取消</button>
        <span style={{ color:'#fff', fontSize:16, fontWeight:600 }}>扫一扫</span>
        <div style={{ width:40 }} />
      </div>
      {error
        ? <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:14 }}>{error}</div>
        : (
          <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
            <video ref={videoRef} autoPlay playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:220, height:220, border:'2px solid #07C160', borderRadius:12, boxShadow:'0 0 0 9999px rgba(0,0,0,.5)' }} />
            </div>
            <div style={{ position:'absolute', bottom:40, left:0, right:0, textAlign:'center', color:'rgba(255,255,255,.7)', fontSize:13 }}>
              将二维码/条码放入框中
            </div>
          </div>
        )
      }
    </div>
  );
}

export default function Discover() {
  const { toastMsg, showToast } = useToast();
  const [showScan, setShowScan] = useState(false);
  const [showMoments, setShowMoments] = useState(false);

  const handleItem = useCallback((key) => {
    if (key === 'scan')    { setShowScan(true); return; }
    if (key === 'moments') { setShowMoments(true); return; }

    const LABELS = {
      video:'视频号', shake:'摇一摇', look:'看一看', search:'搜一搜',
      nearby:'附近的人', shop:'购物', game:'游戏', miniapp:'小程序',
    };
    showToast(`「${LABELS[key] || key}」功能即将上线`);
  }, [showToast]);

  // If moments page is showing, render it instead
  if (showMoments) {
    return <MomentsPage onBack={() => setShowMoments(false)} />;
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#F0F0F0' }}>
      <Toast message={toastMsg} />
      {showScan && <ScanModal onClose={() => setShowScan(false)} />}

      <div className="wc-panel-topbar" style={{ justifyContent:'flex-start' }}>
        <span style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)', paddingLeft:4 }}>发现</span>
      </div>

      <div style={{ flex:1, overflowY:'auto', paddingTop:10 }}>
        {SECTIONS.map((section, si) => (
          <div key={si} className="wc-discover-section">
            {section.map(item => (
              <div
                key={item.key}
                className="wc-discover-item"
                onClick={() => handleItem(item.key)}
                style={{ cursor:'pointer' }}
              >
                <div style={{
                  width:32, height:32, borderRadius:8, background:item.color,
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                }}>
                  {Icons[item.key]}
                </div>
                <span className="wc-discover-label">{item.label}</span>
                {!item.impl && (
                  <span style={{ fontSize:10, color:'#B2B2B2', marginRight:4 }}>即将上线</span>
                )}
                <ChevronRight />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
