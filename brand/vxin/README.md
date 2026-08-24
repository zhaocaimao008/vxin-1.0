# V信品牌系统

## 目录结构

```
brand/vxin/
├── svg/                      # 矢量Logo资源
│   ├── logo.svg             # 深色版Logo (512x512)
│   ├── logo-256.svg         # 深色版Logo (256x256)
│   └── logo-light.svg       # 浅色版Logo (512x512)
│
├── icons/                    # App Icon资源 (PNG格式)
│   ├── icon-16.png          # 16x16
│   ├── icon-32.png          # 32x32
│   ├── icon-48.png          # 48x48
│   ├── icon-64.png          # 64x64
│   ├── icon-72.png          # 72x72
│   ├── icon-96.png          # 96x96
│   ├── icon-128.png         # 128x128
│   ├── icon-144.png         # 144x144
│   ├── icon-152.png         # 152x152
│   ├── icon-192.png         # 192x192
│   ├── icon-256.png         # 256x256
│   ├── icon-384.png         # 384x384
│   ├── icon-512.png         # 512x512
│   ├── icon-1024.png        # 1024x1024 (App Store标准)
│   ├── icon-*-light.png     # 浅色版 (同上尺寸)
│
├── lottie/                   # Lottie动画资源
│   ├── vxin_intro.json      # 3秒启动动画 (60FPS, <1MB)
│   └── splash-animation.json # Splash动画
│
├── ios/                      # iOS资源
│   ├── LaunchScreen.storyboard # 启动页
│   └── icon-1024.png        # App Store图标
│
├── android/                  # Android资源
│   ├── launch_background.xml # 启动背景
│   └── mipmap-* */ic_launcher.png # 各分辨率图标
│
└── windows/                  # Windows/Electron资源
    ├── splash.html          # 启动动画页面
    └── icon-1024.png        # 应用图标

## 品牌规范

### 主色调
- 金色: `#FFD700` (主色), `#FFA500` (辅色), `#FF8C00` (深金)
- 黑色: `#000000` (背景)
- 灰色: `#1a1a1a` (聊天气泡), `#CCCCCC` (文字)

### 字体
- iOS: PingFang SC
- Android: Noto Sans SC
- Windows: Microsoft YaHei

### 动画时长
- 启动动画: 3秒 (180帧, 60FPS)
- Logo出现: 0.3-0.8秒
- 文字淡入: 1.0-1.2秒

## 使用说明

### iOS接入
1. 将 `ios/` 目录下的资源复制到 Xcode 项目
2. 配置 Lottie-iOS 库播放 `vxin_intro.json`
3. 设置 `LaunchScreen.storyboard` 为启动页

### Android接入
1. 将 `android/` 目录下的资源复制到 Android 项目
2. 配置 Lottie-Android 库播放 `vxin_intro.json`
3. 使用 `launch_background.xml` 作为启动背景

### Windows接入
1. 将 `windows/` 目录下的资源复制到 Electron 项目
2. 使用 `splash.html` 创建启动窗口
3. 3秒后关闭启动窗口，显示主窗口

## 版本历史
- v1.0.0 (2026-08-24): 初始品牌系统
