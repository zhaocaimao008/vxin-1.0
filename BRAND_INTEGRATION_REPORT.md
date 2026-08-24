# V信 Brand System Integration Report

审核人：Claude Code（Principal Engineer 角色）
日期：2026-08-24
关联 Commit：`bc5501e`（Android）/ `2d90222`（iOS）/ `a93ada4`（Desktop）

## 1. 修改文件列表

| 平台 | 文件 | 类型 |
|---|---|---|
| Android | `android/gradle/libs.versions.toml` | 改（新增 lottie-compose 依赖声明） |
| Android | `android/app/build.gradle.kts` | 改（引入依赖） |
| Android | `android/app/src/main/res/raw/vxin_intro.json` | 新增（品牌动画资源） |
| Android | `android/app/src/main/java/com/vxin/app/navigation/AppNavigation.kt` | 改（`SplashScreen()` 接入 Lottie + 最短展示时长） |
| iOS | `ios/project.yml` | 改（新增 Lottie SPM 包声明） |
| iOS | `ios/Vxin/Resources/vxin_intro.json` | 新增（品牌动画资源） |
| iOS | `ios/Vxin/UI/Components/LottieSplashView.swift` | 新增（Lottie 播放封装 + 兜底） |
| iOS | `ios/Vxin/App/RootView.swift` | 改（`VxinSplashView` 接入 Lottie + 最短展示时长） |
| Windows | `desktop-electron/assets/splash.html` | 新增（品牌启动窗口页面，原样搬自 brand 资源） |
| Windows | `desktop-electron/src/main.js` | 改（新增品牌启动窗口的创建/关闭逻辑） |

未改动任何聊天业务逻辑、登录鉴权、消息收发相关代码。

## 2. 架构决策（先分析后执行）

三端都**没有**新增独立的启动步骤，而是在已存在的"会话恢复中"占位屏上接入品牌动画：

- **Android**：`AppNavigation.kt` 里 `AuthState.Loading` 时展示的 `SplashScreen()` 组件本就存在（原先是纯绿底文字），改造它即可，无需动 `VxinApp.onCreate()` 的 Firebase/个推初始化顺序、也无需动 `SessionManager.init()` 的会话恢复逻辑。
- **iOS**：`RootView.swift` 里 `.loading` 状态展示的 `VxinSplashView` 同理已存在（代码注释写着"与 Android SplashScreen 对齐"），同样只改这一层。
- **Windows**：这里没有现成的"启动占位屏"，且发现一个真实的既有缺口——`app.whenReady()` 里 `createWindow()` 之前要跑 `loadRemoteServerUrl()`（远程 config 拉取，兜底超时 5s）+ `clearRenderCaches()`，这段时间用户点开图标后**没有任何窗口**，正是 Phase 4 要求解决的"白屏/闪烁/启动延迟"现象（代码里已有相关注释印证这是已知问题）。方案是在 `whenReady()` 最开头立即建一个品牌启动窗口填补这段空窗期，`mainWindow` 可显示时关闭。

三端都保留了失败兜底：Lottie 资源加载/解析失败时不会白屏或崩溃，会退回原来的纯色+文字启动态。

## 3. 各端接入结果

### 3.1 Android — ✅ 已接入，真实编译通过
`SplashScreen()` 播放 `vxin_intro.json`（180帧@60fps，黑底金色），最短展示 1.8s（见下方 §5 说明），会话恢复未完成时自然延长展示。

```
cd android && ./gradlew :app:compileDebugKotlin
BUILD SUCCESSFUL
```
这是真实 Kotlin 编译器跑出来的结果（含依赖下载），不是静态检查。

### 3.2 iOS — ✅ 代码已接入，⚠️ 未做真实构建验证
`RootView.swift` 的 `VxinSplashView` 改为 `LottieSplashView`（新文件），`project.yml` 新增 Lottie SPM 包声明（沿用现有 SocketIO/Kingfisher/Firebase/WebRTC 的同一套依赖声明方式）。逻辑与 Android 对称（同一份动画源文件、同样 1.8s 最短展示时长）。

**未验证项**：本环境是 Linux 容器，没有 macOS/Xcode 工具链，无法执行 `xcodegen generate` + `xcodebuild` 做真实编译验证，也无法用 iOS 模拟器做冷启动/后台恢复测试。这与本项目此前记录在案的"无真机/模拟器环境"限制一致，不在此假装跑过测试。

### 3.3 Windows/Electron — ✅ 代码已接入，⚠️ 部分验证（容器沙箱限制）
`main.js` 新增 `createSplashWindow()`/`closeSplashWindow()`，独立 session partition（避免被 `setupSecurity()` 那份按 `web/dist/index.html` 现算哈希的严格 CSP 误伤 splash.html 自己的内联脚本）。

**已验证**：
- `node --check src/main.js` 语法通过
- 用 `xvfb-run` 真实拉起 Electron 主进程，`electron-log` 落盘的 `main.log` 显示流程正常跑到 `RemoteConfig` 拉取成功、渲染缓存清理完成（即 `createSplashWindow()` 调用未抛异常、未阻塞后续启动步骤）：
  ```
  v信 Desktop v2 启动
  [RemoteConfig] server = https://vxinchat.com (from https://cdn.jsdelivr.net/gh/...)
  已清理渲染缓存目录: Cache
  已清理渲染缓存目录: Code Cache
  ```
- 无 JS 异常/未处理 Promise 拒绝日志（主进程有全局兜底会记录）

**未能验证**：splash 窗口实际绘制画面、以及 `mainWindow` 出现时是否精确关闭 splash——本容器以 root 运行且缺少 user namespace 支持，Chromium 沙箱（即使传 `--no-sandbox` / 关闭 `sandbox` webPreference）反复崩溃重启网络服务进程，导致任何渲染进程都起不稳定，**这是容器环境本身的沙箱限制，与本次改动的代码逻辑无关**（mainWindow 若跑到这一步也会撞上同样的问题）。顺手把 splash 窗口的 `sandbox` 选项对齐了 mainWindow 已有的 `VISUAL_AUDIT` 环境变量约定，方便你们自己的 `ui-audit` 工具链后续在有 GUI 的机器上直接验证。

## 4. 测试结果（诚实说明，不编造）

| 项目 | 要求 | 实际结果 |
|---|---|---|
| Android 冷启动×10 / 热启动×10 | 需真机/模拟器 | ❌ 未执行——本环境无 adb/模拟器/真机，无法做到 |
| iOS 冷启动×10 / 后台恢复×10 | 需 iOS 模拟器/真机 | ❌ 未执行——本环境无 macOS |
| Windows 白屏/闪烁/延迟 | 可用桌面环境肉眼验证 | ⚠️ 部分——见 §3.3，容器沙箱限制无法完整验证渲染层 |

这三条与此前 JARVIS Chat Phase 1.9 记录的环境限制一致：本服务器没有任何移动端真机/模拟器/设备农场接入能力。如果需要真实验收，需要你提供真机远程协助、或云端设备farm 凭证，我可以照此继续；否则以上是本环境能给到的最高质量诚实验证（真实编译器/真实进程启动日志），不是静态假装。

## 5. 性能与设计权衡

- `vxin_intro.json` 体积 4971 字节，180 帧 @ 60fps（时长 3.0s），3 个图层——**确实偏简单**（金色圆环 + V + 渐变），符合 Phase 5 预判。因为这是纯设计资产、不是代码问题，我没有替你们重新设计动画内容；如果想要更丰富的效果（粒子、光晕、更细的曲线动效），建议交给设计工具（AE + bodymovin，或类似 LottieFiles 编辑器）产出新版 JSON，代码这边的接入方式不用变。
- 三端均未强制等满 3 秒——设为**最短展示 1.8s**（覆盖动画自身 0~1.4s 的核心内容：Logo 出现→标题→标语），会话恢复更慢时自然顺延展示，直到能进入 Login/Main。这是一个产品体验取舍，理由写在代码注释里：不这样做的话，缓存 token + 快网时用户几乎看不到品牌动画就直接进主界面了。如果你们更希望不论网络快慢都固定播完整 3 秒，改一个常量（Android `MIN_SPLASH_DURATION_MS`，iOS `RootView.minSplashDuration`）即可，我先按更常见的"不拖慢已经很快的登录"来定。
- 内存/加载时间的量化数据无法在本环境给出（无设备可测），静态层面：JSON 仅 5KB，lottie-compose/lottie-ios 都是成熟库，不预期有可观测的启动开销。

## 6. 是否影响现有聊天核心功能

**不影响。** 三端改动都只发生在"会话状态为 Loading 期间展示什么"这一层：
- Android：`VxinApp.onCreate()`（主题同步初始化→通知桥→Firebase/个推延迟初始化）、`SessionManager.init()`（远程配置→会话恢复→Socket 连接→Push token 注册）调用顺序和时机**完全未改**。`./gradlew compileDebugKotlin` 全量编译通过，会连带编译到这些文件，若有意外破坏早已报错。
- iOS：`AppDelegate.application(_:didFinishLaunchingWithOptions:)`（Firebase/APNs/PushKit/CallKit 初始化）、`SessionStore.init()`（远程配置→会话恢复）**完全未改**，只是 `RootView` 的 `.loading` 分支渲染内容变了。
- Windows：`app.whenReady()` 里原有的 `loadRemoteServerUrl → clearRenderCaches → setupSecurity → setupIPC → createWindow → createTray → setupAutoUpdater → setupShortcuts` 顺序**完全未变**，`createSplashWindow()` 只是在最前面多了一条不依赖、不阻塞后续任何一步的独立调用。

## 7. 遗留 / 建议

- iOS、Windows 视觉/真机验证需要你提供设备或授权云端 farm；Android 若需要冷/热启动 10 次的真实数据同理需要真机或本地可用的 emulator（本容器没有 KVM 加速，装了也大概率跑不动）。
- `vxin_intro.json` 是可用但简单的占位级动画，正式上线前建议找设计资源升级一版更精致的效果（不阻塞本次代码接入）。
- App Icon 资源（`brand/vxin/icons/`）本次**未接入**——Phase 2/3/4 的具体步骤只列了 Lottie 启动动画，未列图标替换步骤，且 `brand/vxin/android/`、`brand/vxin/ios/` 下没有配好各分辨率的 mipmap/AppIcon 分层集，贸然套用会有裁切/边距不对的风险。如需要我接着做，请确认后我再单独处理（属于新的一批改动，不和本次动画改动混在一起）。
