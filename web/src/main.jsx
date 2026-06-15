import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import App from './App';
import './index.css';

// Electron 桌面端：从 preload 同步注入的 __ELECTRON_CONFIG__ 读取服务器地址
// Web 端：从 Vite 环境变量读取（同域部署时留空即可）
const apiBase = window.__ELECTRON_CONFIG__
  ? (localStorage.getItem('vxin_server_url') || window.__ELECTRON_CONFIG__.serverUrl)
  : (import.meta.env.VITE_API_BASE || import.meta.env.VITE_SERVER_URL || '');
if (apiBase) axios.defaults.baseURL = apiBase;

// 跨域请求必须携带 Cookie，全局开启
axios.defaults.withCredentials = true;

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
