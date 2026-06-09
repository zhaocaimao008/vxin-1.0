import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import App from './App';
import './index.css';

// VITE_API_BASE：跨域部署时指向后端地址（如 https://api.example.com）
// 同域 Nginx 反代部署时留空，使用相对路径即可
// VITE_SERVER_URL 为 Electron 旧版兼容，优先级低于 VITE_API_BASE
const apiBase = import.meta.env.VITE_API_BASE || import.meta.env.VITE_SERVER_URL || '';
if (apiBase) axios.defaults.baseURL = apiBase;

// 跨域请求必须携带 Cookie，全局开启
axios.defaults.withCredentials = true;

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
