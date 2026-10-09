# v信 品牌系统（2026-10-09 起）

标志：墨绿圆角方块 + 白色对话气泡，气泡中是一个墨绿 V（V 与对话气泡合为一体）。
旧版「黑底金色 V」已全部停用。

## 唯一几何源

`web/src/brand/vxinMark.json`（100×100 网格）。只改这一个文件，然后重新生成：

```bash
python3 web/scripts/generate-brand-assets.py   # 在仓库根目录执行；用系统 librsvg + cairo + Pillow
```

- Web / Electron 界面内：`web/src/components/BrandMark.jsx`（`BrandMark` / `BrandLogo`）直接读取同一个 JSON。
- 位图、ICO、启动画面：由上面的脚本生成，不要手改。

## 颜色

| 用途 | 值 |
|---|---|
| 墨绿（标志底 / 主色） | `#176B52` |
| 白（气泡） | `#FFFFFF` |
| 暖白（界面背景 / 启动页） | `#F5F6F2` |
| 深色背景 | `#111412` |
| 深色主色 | `#2E9573` |

## 目录

```
brand/vxin/
├── svg/
│   ├── logo.svg / logo-256.svg   圆角方块（默认标志）
│   ├── logo-light.svg            白底版本（墨绿气泡 + 白 V）
│   ├── icon-square.svg           满版方形（iOS / apple-touch，系统自行切圆角）
│   ├── icon-maskable.svg         PWA maskable（图形缩进到 80% 安全圆内）
│   └── icon-mark.svg             透明底前景（Android 自适应图标前景，背景层用 #176B52）
├── icons/
│   ├── icon-{16…1024}.png        圆角方块
│   ├── legacy-{m…xxxh}dpi.png    Android 旧式图标（48dp）
│   ├── mark-fg-{m…xxxh}dpi.png   Android 自适应前景（108dp）
│   ├── icon-square-1024.png      App Store / iOS
│   ├── maskable-512.png          PWA maskable
│   └── apple-touch-icon.png      180×180
├── preview/brand-preview.png     浅色 / 深色背景下各尺寸预览
├── windows/splash.html           Electron 启动窗口（与 desktop-electron/assets/splash.html 相同）
├── android/  ios/  lottie/       原生启动资源（本轮未改，仍是旧视觉，见下）
```

脚本同时写入：`web/public/`（favicon.svg/png/ico、icon*.png、icons/、apple-touch）、
`web/build/icons/`（web/ 的 electron-builder 图标）、`desktop-electron/assets/`（icon.png / icon-1024.png / icon.ico / splash.html）、
`web/index.html` 首屏启动标志（`<!-- brand:splash:start/end -->` 之间）。

## 注意

- 更换图标后同步修改 `web/index.html`、`web/public/manifest.json` 里图标 URL 的 `?v=`，以及 `web/public/sw.js` 的 `SW_VERSION` / `BRAND_ASSET_VERSION`。
- 原生客户端（Windows 安装包、Android APK、iOS）只有重新打包后才会显示新图标。`android/`、`ios/` 原生工程里的 mipmap / AppIcon、`brand/vxin/android`、`brand/vxin/ios`、`brand/vxin/lottie` 本轮没有替换。
