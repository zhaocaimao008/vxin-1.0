# V信 Icon Integration Report

审核人：Claude Code（Principal Engineer 角色）
日期：2026-08-24
Commit：`9be74c0`（本地未 push）

## 1. 源资源

统一使用 `brand/vxin/icons/icon-1024.png`（1024×1024，RGBA，黑底金色圆形徽标，四角为不透明白色，非镂空透明）作为三端的共同图标来源。

## 2. 各端处理方式

### Android — 🟢 完成，真实构建验证通过
- **legacy 方形图标**（`ic_launcher.png`，API<26 无自适应图标的机型）：直接按各密度尺寸缩放源图（含白色方角），5 档密度全部重新生成（mdpi 48 / hdpi 72 / xhdpi 96 / xxhdpi 144 / xxxhdpi 192，与项目原有尺寸完全一致）。
- **legacy 圆形图标**（`ic_launcher_round.png`）：源图本身是圆形徽标内切于方形画布，直接用内切圆做 alpha 遮罩去掉四角白边，再按密度缩放。
- **自适应图标前景**（`ic_launcher_foreground.png`，API26+）：同样先做圆形遮罩去白边，再缩到安全区（画布 70%）居中贴到透明画布上——不这样处理的话，不同厂商的图标遮罩形状（圆形/圆角方形/squircle）裁切位置不一致，直接用满版前景会导致部分厂商启动器上徽标被切边。
- **自适应图标背景色**：`ic_launcher_background.xml` 从旧的 App 主绿 `#07C160` 改成品牌黑 `#000000`，与前景的黑底徽标衔接，视觉上是一整块黑底圆形徽标。
- **AndroidManifest.xml**：已检查，`android:icon="@mipmap/ic_launcher"` / `android:roundIcon="@mipmap/ic_launcher_round"` 引用本就正确，未改动。
- **applicationId**：未触碰，仍为 `com.vxin.app`。
- **验证**：`./gradlew :app:assembleDebug` 真实打出 `app-debug.apk`（含 aapt2 资源编译/链接，会真实校验 XML 引用和 PNG 有效性），并 `unzip -l` 确认 15 张新图标全部正确打进 APK。

### iOS — 🟡 代码/资源已替换，🔴 未做真实构建验证
- `AppIcon.appiconset/Contents.json` 已是 Xcode 现代"单尺寸 universal"格式（只声明一张 `AppIcon-1024.png`，其余全部尺寸由 Xcode 在编译/导出时自动生成），本身无需改动，已检查确认。
- 替换了 `AppIcon-1024.png`：源图转成**不含 alpha 通道的纯 RGB**（iOS App 图标不允许透明通道，App Store 校验会直接拒绝带 alpha 的图标；原文件本就是 RGB，保持一致）。
- 项目里另有一批 `AppIcon-120/152/167/180/20/29/40/58/60/76/80/87.png`——这些文件 `Contents.json` 根本没引用，是历史遗留的死文件，本次未动（不在这次"替换"范围内，也不影响构建）。
- **未验证**：本环境无 macOS/Xcode，无法跑 `xcodegen generate` / `xcodebuild` 做真实构建验证，与此前 Lottie 动画接入的记录限制一致。

### Windows/Electron — 🟢 完成，静态验证通过
- `assets/icon.ico`：用 Pillow 从源图重新生成**真正的多分辨率 ICO**（16/24/32/48/64/128/256 七档全部内嵌在同一个 .ico 里，`identify` 逐档确认），替换掉原来实际只有单一 256×256 的旧文件。
- `assets/icon.png`（托盘/Linux/窗口图标用）、`assets/icon-1024.png`：同源重新生成，尺寸与原文件一致（512 / 1024）。
- `package.json` 里 electron-builder 的 `win.icon`/`nsis.installerIcon`/`nsis.uninstallerIcon`（均指向 `assets/icon.ico`）、`mac.icon`/`linux.icon`（均指向 `assets/icon.png`）——已检查，路径本就正确，未改动配置。
- 未重新做上一轮那种真实 `xvfb-run electron .` 冷启动测试：本次是纯静态资源替换，不涉及 `main.js` 逻辑，`identify` 已经是对文件本身有效性的真实验证；容器的 Chromium 沙箱限制（上一轮已确认）不会因为换了图标文件而有任何变化。

## 3. 结论

| 平台 | 图标替换 | applicationId/Bundle ID | 构建验证 |
|---|---|---|---|
| Android | 🟢 完成 | 🟢 未改动 | 🟢 真实 `assembleDebug` 通过 |
| iOS | 🟢 完成 | 🟢 未改动（未涉及） | 🔴 无 Xcode 环境，未验证 |
| Windows | 🟢 完成 | — | 🟢 `identify` 校验通过 |

未修改任何聊天业务逻辑、登录/鉴权、消息收发相关代码。
