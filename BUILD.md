# v信 三端构建与运行

## 项目结构

```
vxin/
├── web/                          # React 前端（三端共享）
│   ├── src/
│   │   ├── components/           # 公共组件
│   │   ├── contexts/             # Context 状态管理
│   │   ├── pages/                # 页面组件
│   │   ├── hooks/                # Hooks
│   │   ├── utils/                # 工具函数
│   │   │   ├── electron.js       # Electron 桌面端桥接
│   │   │   ├── url.js
│   │   │   ├── time.js
│   │   │   └── toast.jsx
│   │   ├── App.jsx               # 路由入口
│   │   ├── main.jsx              # 渲染入口
│   │   ├── index.css
│   │   ├── mobile-adapt.css      # 移动端适配
│   │   └── design-tokens.css
│   ├── public/
│   │   ├── manifest.json         # PWA 配置
│   │   ├── icons/                # 应用图标
│   │   └── sw/service-worker.js  # 服务工作线程
│   ├── index.html
│   └── vite.config.js
│
├── desktop-electron/             # Windows 桌面客户端
│   ├── src/
│   │   ├── main.js               # Electron 主进程
│   │   ├── preload.js            # 安全桥接
│   │   └── screenshot.js         # 截图模块
│   ├── assets/
│   │   └── icon.png
│   ├── build/                    # electron-builder 配置
│   └── package.json
│
├── mobile/                       # Android + iOS 移动客户端
│   ├── src/
│   │   └── bridge.js             # Capacitor 桥接层
│   ├── capacitor.config.json
│   ├── vite.config.js
│   └── package.json
│
├── package.json                  # 工作区根配置
├── BUILD.md                      # 本文档
└── BASELINE-REPORT.md            # 性能基线报告
```

## 后端

```
backend-v2/
├── src/
│   ├── server.js                 # HTTP + Socket.io 启动
│   ├── app.js                    # Express 路由装配
│   ├── config/index.js           # 配置
│   ├── db/
│   │   ├── connection.js
│   │   ├── schema.js
│   │   ├── worker.js             # SQLite 写入 Worker
│   │   └── writer.js             # 写入调度器
│   ├── realtime/
│   │   ├── index.js              # Socket.io 握手+连接管理
│   │   ├── broadcaster.js        # 广播调度器（分片削峰）
│   │   ├── presence.js           # 在线状态
│   │   └── handlers/
│   │       ├── message.js        # 消息收发
│   │       ├── file.js           # 文件消息
│   │       ├── typing.js         # 正在输入
│   │       └── call.js           # WebRTC 信令
│   ├── modules/
│   │   ├── auth/                 # 登录注册
│   │   ├── users/                # 用户资料
│   │   ├── messages/             # 消息 REST
│   │   ├── conversations/        # 会话管理
│   │   ├── contacts/             # 联系人
│   │   ├── groups/               # 群组
│   │   ├── moments/              # 朋友圈
│   │   ├── upload/               # 文件上传
│   │   ├── admin/                # 管理后台
│   │   └── notifications/        # 推送通知
│   └── middleware/
│       ├── auth.js               # JWT 鉴权
│       ├── csrf.js               # CSRF 防护
│       └── rateLimiters.js       # 限流
```

## 运行命令

### 开发模式

```bash
# Web 端（本地开发，代理后端 localhost:3002）
cd web && npx vite

# 桌面端 Electron
cd desktop-electron && npm run dev

# Android（需连接设备或模拟器）
cd mobile && npm run dev:android

# iOS（需 macOS + Xcode）
cd mobile && npm run dev:ios
```

### 构建命令

```bash
# Windows 桌面安装包
cd vxin && npm run build:desktop:win
# 输出: desktop-electron/dist/vxin-2.0.0-setup.exe

# Android APK
cd vxin && npm run build:android
# 输出: mobile/android/app/build/outputs/apk/debug/app-debug.apk

# iOS IPA（需 macOS + Xcode + Apple Developer 账号）
cd vxin && npm run build:ios

# Web 端（部署到服务器）
cd vxin && npm run build:web
# 输出: web/dist/
```

### 一键构建

```bash
# 全部安装依赖
npm run setup:all

# 构建三端
npm run build:desktop:win   # Windows
npm run build:desktop:mac   # macOS
npm run build:desktop:linux # Linux
npm run build:android        # Android
npm run build:ios            # iOS（需 macOS）
```

## 三端功能对照

| 功能 | Web | Windows | Android | iOS |
|------|-----|---------|---------|-----|
| 消息收发 | ✅ | ✅ | ✅ | ✅ |
| 文件上传 | ✅ | ✅ | ✅ | ✅ |
| 图片发送 | ✅ | ✅ | ✅ | ✅ |
| 语音消息 | ✅ | ✅ | ✅ | ✅ |
| 群聊 | ✅ | ✅ | ✅ | ✅ |
| 朋友圈 | ✅ | ✅ | ✅ | ✅ |
| 视频/语音通话 | ✅（WebRTC） | ✅（WebRTC） | ✅（WebRTC） | ✅（WebRTC） |
| 系统托盘 | — | ✅ | — | — |
| 消息通知 | ✅（Web Push） | ✅（原生通知） | ✅（FCM） | ✅（APNS） |
| 开机启动 | — | ✅ | — | — |
| 文件拖拽发送 | — | ✅ | — | — |
| 图片粘贴发送 | — | ✅ | — | — |
| 截图发送 | — | ✅ | — | — |
| 自动更新 | — | ✅（electron-updater） | — | — |
| 相机拍照 | — | — | ✅ | ✅ |
| 相册选择 | — | — | ✅ | ✅ |
| 后台保活 | — | — | ✅ | ✅ |
| Socket 自动重连 | ✅ | ✅ | ✅ | ✅ |
| 安全区域适配 | — | — | ✅ | ✅ |
| 刘海屏适配 | — | — | ✅ | ✅ |
| 横竖屏 | ✅ | — | ✅ | ✅ |
| PWA 离线 | ✅ | — | — | — |

## 服务器配置

所有客户端默认连接 `https://dipsin.com`。

Electron 桌面端可在设置页面修改服务器地址（支持内网部署场景）。

## 更新机制

Windows 桌面端使用 `electron-updater`，更新包部署在 `https://dipsin.com/downloads/updates/`。
移动端通过各应用商店更新。
