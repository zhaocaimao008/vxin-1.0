// 把后端返回的相对资源路径（如 /uploads/avatars/x.jpg、/api/...）解析成可用的绝对地址。
//
// Web 端：同源，相对路径本就能用，原样返回。
// Electron 桌面端：页面跑在 file:// 下，<img src="/uploads/x.jpg"> 会解析成
//   file:///uploads/x.jpg（不存在）。必须补上服务器地址。
//   注意：axios.defaults.baseURL 只对 axios/fetch 生效，对 <img> 标签无效，
//   所以这里必须显式拼接。
export function mediaUrl(u) {
  if (!u) return u;
  // 已经是绝对地址 / data / blob，原样返回
  if (/^(https?:|data:|blob:)/i.test(u)) return u;
  if (!window.__ELECTRON_CONFIG__) return u; // Web 同源，相对路径可用

  const base = (localStorage.getItem('vxin_server_url') || window.__ELECTRON_CONFIG__.serverUrl || '').replace(/\/$/, '');
  if (!base) return u;
  return u.startsWith('/') ? base + u : `${base}/${u}`;
}

// 跳转到登录页。Electron 跑在 file:// 下，不能用绝对路径 '/login'
// （会跳到 file:///login 白屏），必须用 HashRouter 的 hash 路由。
export function goLogin() {
  if (window.__ELECTRON_CONFIG__) window.location.hash = '#/login';
  else window.location.replace('/login');
}
