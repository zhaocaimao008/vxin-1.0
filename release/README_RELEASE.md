# v信 v2.0.0 发布包

> 构建时间：2026-06-19 14:50 CST
> Git Commit：`3845bf5`
> 版本号：2.0.0

---

## 文件清单

| 文件 | 说明 | 平台 |
|------|------|------|
| `vxin-windows-2.0.0-setup.exe` | Windows 安装包（NSIS） | Windows 7+ / 10 / 11 |
| `vxin-android-2.0.0-debug.apk` | Android 调试 APK | Android 8.0+ (API 24+) |
| `vxin-web-dist.zip` | Web 端构建产物 | 任意浏览器 |
| `vxin-ios-project.zip` | iOS Xcode 工程源码 | macOS + Xcode 15+ |

---

## 安装方法

### Windows

1. 下载 `vxin-windows-2.0.0-setup.exe`
2. 双击运行安装
3. 自动创建桌面快捷方式和开始菜单
4. 安装完成后自动启动 v信

**可选：便携版**
```bash
# 解压 win-unpacked 目录即可使用，无需安装
```

**系统托盘：**
- 关闭窗口时自动最小化到托盘
- 右键托盘图标可切换开机启动

**快捷键：**
- `Ctrl+Alt+A`：截图发送
- `Enter`：发送消息
- `Shift+Enter`：换行

### Android

1. 下载 `vxin-android-2.0.0-debug.apk`
2. 在手机上打开 APK 文件
3. 允许"安装未知来源应用"
4. 安装完成后打开 v信

**权限说明：**
- 相机：用于拍照发送
- 存储：用于发送文件和图片
- 通知：用于消息推送提醒

### iOS（需自行构建）

```bash
# 需要 macOS + Xcode 15+
# 需要 CocoaPods

cd vxin-ios-project/ios/App
pod install
open App.xcworkspace

# 在 Xcode 中：
# 1. 修改 Bundle Identifier 为你的开发者账号
# 2. 配置推送证书（APNS）
# 3. 选择真机或模拟器运行
```

### Web 部署

```bash
# 解压到 nginx 目录
unzip vxin-web-dist.zip -d /var/www/vxin-web/
cd /var/www/vxin-web/dist/

# nginx 配置示例
server {
    listen 443 ssl;
    server_name dipsin.com;

    root /var/www/vxin-web/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理到后端
    location /api/ {
        proxy_pass http://127.0.0.1:3002;
    }
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 服务器地址配置

### Windows 桌面端
- 默认连接 `https://dipsin.com`
- 在设置页面可修改服务器地址
- 支持内网部署：`http://192.168.x.x:3002`

### Android / iOS
- 默认连接 `https://dipsin.com`
- 修改 `mobile/capacitor.config.json` 中的 `server.url`
- 重新构建 APK

### Web
- 同域部署时无需配置
- 跨域部署需设置 `VITE_SERVER_URL` 环境变量

---

## 推送通知配置

### Web Push（预配置，免费）
- 使用 VAPID 协议，无需额外服务
- 后端 `push.js` 自动处理
- 在 `/admin` 管理后台配置 VAPID 密钥

### FCM（Android）/ APNS（iOS）
- 需要 Firebase 项目
- 设置以下环境变量：
  ```bash
  FIREBASE_PROJECT_ID=your-project-id
  FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
  FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
  ```
- 后端自动检测并启用 Firebase Admin SDK

---

## 自动更新（Windows）

- 使用 `electron-updater`
- 更新服务器地址：`https://dipsin.com/downloads/updates/`
- 更新文件命名规范：
  ```
  vxin-2.0.0-setup.exe
  latest.yml                # 更新清单
  ```
- 部署新版本后，客户端下次启动自动检测更新

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 19 |
| 构建工具 | Vite 8 |
| 桌面端 | Electron 30 + electron-builder 24 |
| 移动端 | Capacitor 6 |
| 后端 | Node.js 22 + Express |
| 实时通信 | Socket.IO |
| 数据库 | SQLite (WAL 模式) |
| 通话 | WebRTC |
| 推送 | Web Push (VAPID) / FCM / APNS |

---

## 性能基线

- 1000 人同时在线：✅ 通过
- 消息 0 丢失/重复/乱序：✅ 通过
- 单聊延迟 p99：197ms（真实浏览器）
- 群聊延迟 p99：235ms
- REST p99：142ms
- 服务端处理 p99：2.87ms

详情见 `BASELINE-REPORT.md`。

---

## 构建时间

| 文件 | 构建时间 | 大小 |
|------|---------|------|
| vxin-windows-2.0.0-setup.exe | 2026-06-19 14:49 CST | 见 manifest |
| vxin-android-2.0.0-debug.apk | 2026-06-19 14:51 CST | 见 manifest |
| vxin-web-dist.zip | 2026-06-19 14:44 CST | 见 manifest |
| vxin-ios-project.zip | 2026-06-19 14:51 CST | 见 manifest |

---

## 构建命令（开发用）

```bash
# Windows
cd desktop-electron && npm install && npm run build:win

# Android
cd mobile && npm install && ANDROID_HOME=/opt/android-sdk npx cap sync android
cd android && ./gradlew assembleDebug

# iOS
cd mobile && npm install && npx cap sync ios
# 在 macOS 上执行：cd ios/App && pod install && open App.xcworkspace

# Web
cd web && npm install && npx vite build
```
