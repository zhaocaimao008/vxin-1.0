# V信 四端品牌统一替换报告

审核人：Claude Code（Principal Engineer 角色）
日期：2026-08-24

## 0. 提交记录（按端拆分）

| Commit | 内容 |
|---|---|
| `bc5501e` | feat(android): 品牌启动动画接入 |
| `2d90222` | feat(ios): 品牌启动动画接入 |
| `a93ada4` | feat(desktop): 品牌启动窗口 |
| `9be74c0` | feat: 三端 App 图标替换 |
| `051beb2` / `2ab0ee5` | feat/fix(web): favicon 替换 + SW 缓存失效 |
| `2d53d99` | feat(web): 登录/注册页 Logo + 文案替换 |
| `3d7b7ab` | **feat: redesign web login brand theme**（Web 登录/注册页黑金主题重做） |
| `e55a52b` | **feat: unify vxin brand assets across android**（Android 登录/注册/找回密码页黑金重做） |
| `899ebe3` | **feat: unify vxin brand assets across ios**（iOS 登录/注册/找回密码页黑金重做） |

本次任务新增的是 `3d7b7ab`/`e55a52b`/`899ebe3` 三个——前面几个 commit 是同一天更早的分阶段工作，这次任务是在那基础上把**登录/注册/找回密码页**这块之前漏掉的黑金统一补完。全部本地 commit，未 push 到 `origin/main`（`feat/vxin-brand-integration` 分支已推送用于 CI 验证，见下）。

Windows 端**没有新增 commit**：桌面客户端没有独立的原生登录页，Electron 直接加载 `web/dist`（见 `desktop-electron/src/main.js` 的 `loadAppPage()`），Web 端的登录页改动会随下次 `npm run build:win` 自动带入安装包，不需要单独改代码。

## 1. 四端修改文件列表

### Web（本次新增）
- `web/src/styles/login.css`（全量黑金重做：背景/Tab/输入框/按钮/勾选框/链接/深色模式覆盖）
- `web/src/pages/Login.jsx`（内联绿色文字修正）

### Android（本次新增）
- `android/app/src/main/java/com/vxin/app/ui/components/VxinLogoMark.kt`（新增，Canvas 绘制品牌标记）
- `android/app/src/main/java/com/vxin/app/ui/theme/Color.kt`（新增 8 个 Auth 专用色）
- `android/app/src/main/java/com/vxin/app/ui/components/AuthFields.kt`
- `android/app/src/main/java/com/vxin/app/feature/auth/LoginScreen.kt`
- `android/app/src/main/java/com/vxin/app/feature/auth/RegisterScreen.kt`
- `android/app/src/main/java/com/vxin/app/feature/auth/ForgotPasswordScreen.kt`

### iOS（本次新增）
- `ios/Vxin/UI/Components/VxinLogoMark.swift`（新增，SwiftUI Path 绘制品牌标记）
- `ios/Vxin/UI/Theme/Theme.swift`（新增 8 个 Auth 专用色）
- `ios/Vxin/UI/Components/AuthFields.swift`
- `ios/Vxin/UI/Components/PasswordField.swift`
- `ios/Vxin/UI/Components/VxinGradientButton.swift`
- `ios/Vxin/Features/Auth/LoginView.swift`
- `ios/Vxin/Features/Auth/RegisterView.swift`
- `ios/Vxin/Features/Auth/ForgotPasswordView.swift`

### Windows
无本次新增文件——继承 Web。图标/托盘/标题栏/启动窗口在更早的 `a93ada4`/`9be74c0` 已处理。

## 2. 四端替换完成情况

| 项 | Web | Windows | Android | iOS |
|---|---|---|---|---|
| Logo | ✅ | ✅（同 Web） | ✅ | ✅ |
| App Icon | ✅ | ✅ | ✅ | ✅ |
| 启动动画 | N/A（无原生启动概念） | ✅ 品牌启动窗口 | ✅ Lottie | ✅ Lottie |
| 登录页 | ✅ 本次黑金重做 | ✅（同 Web） | ✅ 本次黑金重做 | ✅ 本次黑金重做 |
| 注册页 | ✅（沿用 login.css） | ✅（同 Web） | ✅ 本次黑金重做 | ✅ 本次黑金重做 |
| 找回密码页 | ✅（沿用 login.css，Logo 图标本次同步替换） | ✅（同 Web） | ✅ 本次黑金重做 | ✅ 本次黑金重做 |
| 品牌文案「连接·沟通·未来」 | ✅ | ✅（同 Web） | ✅ | ✅ |
| 主题色（黑/金/白灰） | ✅ | ✅（同 Web） | ✅ | ✅ |

## 3. 截图对比

真实线上 Playwright 截图（Web，`https://vxinchat.com/app/`）已随附件发送：
- 登录页（默认态）
- 注册页
- 登录页填表后按钮启用态（黑底金字描边）

**Android/iOS 无法提供截图**：本环境没有 Android 模拟器/emulator（无 KVM 加速），也没有 macOS/Xcode/iOS 模拟器。这是这台服务器的环境限制，不是没做——两端的代码改动已通过下面第 6 节的方式验证过正确性，但视觉截图确实拿不出来，如实说明，不假装有。

## 4. 图标替换情况

Android/iOS/Windows 三端 App Icon 已在更早的 `9be74c0` 完成（源自 `brand/vxin/icons/icon-1024.png`），Web favicon 在 `051beb2` 完成并修了 Service Worker 缓存导致"换了图标线上看不到"的问题（`2ab0ee5`）。本次任务没有再动图标文件本身。

## 5. 启动动画接入情况

Android/iOS 的 Lottie 品牌动画（`vxin_intro.json`）在更早的 `bc5501e`/`2d90222` 已接入到会话恢复期间的启动占位屏。Windows 用一个独立的品牌启动窗口（`a93ada4`）填补了 `createWindow()` 之前的空窗期。本次任务没有再改这部分，只是在启动动画**之后**的登录/注册页补上同一套黑金视觉，让"启动动画"和"登录页"衔接起来观感一致（之前的问题是：动画放完了，进到登录页又变回绿色，割裂）。

## 6. 登录页替换情况（本次任务的主要工作量）

三端的登录/注册/（Android+iOS 还多做了）找回密码页，此前只换了 Logo 图形，页面主体仍是各自平台的原生绿色主题（Android Material、iOS 系统默认、Web 微信绿）。本次统一做法：

- **黑底**：页面/卡片背景改黑（Web `#000`/`#0d0d0d`，Android/iOS 同色值）
- **金色强调**：Tab 下划线、输入框聚焦态、勾选框、链接、按钮描边+文字全部改金
- **提交按钮**：统一"黑底金字描边"风格（不是纯色实心），三端色值完全对齐（`#141414` 底 + `#FFD700` 描边/文字）
- **统一 Logo 标记**：新写了一个"黑色圆角气泡 + 金色圆环 + 金色 V"的扁平化简版标记，Web 是内联 SVG、Android 是 Compose Canvas、iOS 是 SwiftUI Path——**三处坐标是同一套数学换算**（都从 `brand/vxin/svg/logo.svg` 的 V 字形按 512→100 等比缩小得来），保证三端看起来是同一个 Logo，不是三个人各画一版
- **文案**：「连接世界 · 沟通无限」→「连接 · 沟通 · 未来」，Web/Android/iOS 的 Login 页全部替换；Register 页原本没有这句标语的（Android/iOS）也一并加上了

**范围控制**：只动了这几个屏幕专属或确认"仅供 auth 页使用"的组件（每个平台都先 grep 过全项目确认没有被其它页面复用，比如 Android 的 `VxinGradientButton` 在 `AddFriendScreen.kt` 也用到、就没有动它，改用了独立的按钮实现）。App 内其余页面（聊天、设置等）的绿色主题、全局主题变量（Web `--color-primary`、Android `VxinBrand`、iOS `.vxinBrand`）**完全没碰**。

## 7. 是否影响现有功能

**不影响。** 逐条核对：

- **Web**：只改了 `login.css` 一个文件 + 1 处内联文字颜色，登录逻辑（`Login.jsx`/`Register.jsx`/`ForgotPassword.jsx` 的 `handleSubmit`/校验/API 调用）字节级未动。
- **Android**：`SessionManager`/`AuthRepository`/`SocketManager`/`PushManager`/Firebase/GeTui 初始化代码均未涉及；改动的 3 个 Screen 文件 + 2 个共用 UI 组件文件全部**真实跑过 `./gradlew :app:compileDebugKotlin` 和 `:app:assembleDebug`**，编译器/打包器都过了，不是静态猜测。
- **iOS**：`SessionStore`/`AuthRepository`/`SocketService`/`PushManager`/`VoipCallManager`/`AppDelegate` 的 APNs/PushKit/CallKit 初始化代码均未涉及，`AuthViewModel.swift`（登录/注册的实际提交逻辑）未改一行。**但这次没能拿到真实 Xcode 编译结果**——见下方风险说明。
- **Windows**：没有新代码改动，风险为零。

## 8. 剩余未完成项 / 风险说明

🔴 **GitHub Actions 账号欠费，iOS 改动本轮未做真实编译验证**：本环境没有 macOS/Xcode，一直依赖你们仓库的 `ios-build.yml`（真实 Xcode 16 云端 runner）做验证——上一轮 Lottie 动画接入时用这个方式拿到过真实 `BUILD SUCCEEDED`。这次推送同一分支想再触发一次，结果所有新 workflow 运行都秒失败，报错原文：

> The job was not started because recent account payments have failed or your spending limit needs to be increased.

这是 `zhaocaimao008` 这个 GitHub 账号的 billing 状态问题，不是代码问题，我这边无法处理，需要你去 GitHub → Settings → Billing and plans 处理欠费/额度。处理好之后，PR #58（`feat/vxin-brand-integration` 分支）会自动重新触发，到时候我可以帮你确认真实结果。**在此之前，iOS 这轮登录页改动只做到了代码审查级别的把关**（逐处比对 Web/Android 同款实现、grep 确认组件复用范围），没有编译器背书。

🟡 **发现有其他 Agent/进程在并发改同一个仓库**：`main` 分支上出现了一条我没有提交过的 commit（`2ee64db feat(landing): add vxin brand assets to official site`，作者是账号本人邮箱），只碰了 `landing/` 目录（官网独立站点，不在这次"四端"范围内），跟我这次的改动没有文件冲突，但说明这台机器上不止我一个人/进程在动这个仓库，值得你知道。

🟡 **Android/iOS 冷启动截图/真机验收**：跟之前几轮一样，本环境没有模拟器/真机，做不到。

🟡 **Windows 安装包**：新的登录页 CSS 需要下次实际打包（本地或 CI 的 `windows-build.yml`，同样会撞上面那个 billing 问题）才会体现在真正分发的 `.exe` 里；源码层面已经就绪，不需要额外改代码。

🟢 **iOS LaunchScreen 原生启动图**：沿用第一轮的决定——没有改 `UILaunchScreen`/`Info.plist`，因为那是进程启动瞬间、SwiftUI 还没接管前的系统级画面，改动风险和收益不成比例（毫秒级闪一下），真正看得到的品牌动画是 SwiftUI 层的 Lottie，已经接入。
