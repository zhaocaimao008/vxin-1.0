'use strict';
const express = require('express');
const router = express.Router();

const DOWNLOADS = [
  {
    icon: '🖥️',
    name: 'v信 Windows 安装版',
    desc: 'Windows 7/10/11 x64，含安装向导',
    url: 'https://github.com/zhaocaimao008/vxin-1.0/releases/download/v1.0.0/v.-Setup-1.0.0.exe',
    size: '~74 MB',
  },
  {
    icon: '📦',
    name: 'v信 Windows 便携版',
    desc: '免安装，直接运行，解压即用',
    url: 'https://github.com/zhaocaimao008/vxin-1.0/releases/download/v1.0.0/v.-1.0.0-portable.exe',
    size: '~74 MB',
  },
  {
    icon: '🤖',
    name: 'v信 Android APK',
    desc: 'Android 5.0+，需允许安装未知来源',
    url: 'https://github.com/zhaocaimao008/vxin-1.0/releases/download/v1.0.0/vxin-android-1.0.0.apk',
    size: '~61 MB',
  },
  {
    icon: '🍎',
    name: 'v信 iOS（即将上线）',
    desc: 'App Store 审核中，敬请期待',
    url: null,
    size: '',
  },
];

router.get('/', (req, res) => {
  const cards = DOWNLOADS.map(d => `
    <div class="card${d.url ? '' : ' disabled'}">
      <div class="icon">${d.icon}</div>
      <div class="info">
        <div class="name">${d.name}</div>
        <div class="desc">${d.desc}</div>
        ${d.size ? `<div class="size">${d.size}</div>` : ''}
      </div>
      ${d.url
        ? `<a class="btn" href="${d.url}">下载</a>`
        : `<span class="btn-disabled">敬请期待</span>`}
    </div>`).join('');

  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>v信 下载中心</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;
  background:#F0F2F5;min-height:100vh;display:flex;flex-direction:column;align-items:center;
  justify-content:center;padding:24px}
.header{text-align:center;margin-bottom:36px}
.logo{width:80px;height:80px;border-radius:20px;background:#07C160;display:flex;align-items:center;
  justify-content:center;font-size:36px;font-weight:800;color:#fff;margin:0 auto 16px;
  box-shadow:0 8px 28px rgba(7,193,96,.4)}
h1{font-size:30px;font-weight:700;color:#1F2D3D;letter-spacing:2px}
.sub{font-size:14px;color:#7A8694;margin-top:8px}
.cards{display:flex;flex-direction:column;gap:14px;width:100%;max-width:540px}
.card{background:#fff;border-radius:14px;padding:18px 20px;display:flex;align-items:center;gap:14px;
  box-shadow:0 2px 10px rgba(0,0,0,.07);transition:.15s}
.card:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,.1)}
.card.disabled{opacity:.55}
.icon{font-size:34px;flex-shrink:0;width:48px;text-align:center}
.info{flex:1;min-width:0}
.name{font-size:15px;font-weight:600;color:#1F2D3D}
.desc{font-size:12px;color:#7A8694;margin-top:3px}
.size{font-size:11px;color:#B0BAC5;margin-top:3px}
.btn{padding:10px 22px;background:#07C160;color:#fff;border-radius:10px;text-decoration:none;
  font-size:14px;font-weight:600;white-space:nowrap;flex-shrink:0}
.btn:hover{background:#06AD56}
.btn-disabled{padding:10px 16px;background:#E8ECF0;color:#B0BAC5;border-radius:10px;
  font-size:13px;white-space:nowrap;flex-shrink:0}
.footer{margin-top:28px;font-size:12px;color:#B0BAC5;text-align:center;line-height:1.8}
@media(max-width:480px){.card{flex-wrap:wrap}.btn,.btn-disabled{width:100%;text-align:center;margin-top:8px}}
</style>
</head>
<body>
<div class="header">
  <div class="logo">v</div>
  <h1>v信</h1>
  <p class="sub">安全 · 快速 · 私密 &nbsp;|&nbsp; v1.0.0</p>
</div>
<div class="cards">${cards}</div>
<div class="footer">
  Web 端: <a href="/" style="color:#07C160">立即使用</a><br>
  服务器: ${req.hostname}
</div>
</body>
</html>`);
});

module.exports = router;
