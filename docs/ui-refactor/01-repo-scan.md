# v信项目仓库扫描（01 / 3）

> 只读扫描，不涉及任何代码修改。数据来源：仓库文件系统直接读取 + git 元数据，色值等关键结论均已核对源码，非猜测。

## 1. 仓库顶层结构（2–3 层深度，节选与本次 UI 改版相关的目录）

```
vxin-1.0/
├── android/                  ← 【原生 Android，当前维护】Kotlin + Jetpack Compose
│   ├── app/src/main/java/com/vxin/app/
│   │   ├── feature/           # 按业务切的 Compose 页面（chat/contacts/profile/settings/group/...）
│   │   ├── ui/{theme,components}/
│   │   ├── data/{model,api,repository}/
│   │   └── core/{network,auth,push,call,...}/
│   └── README.md
├── ios/                      ← 【原生 iOS，当前维护】SwiftUI
│   └── Vxin/
│       ├── Features/{Chat,Contacts,Profile,Group,Moments,Auth,Call,Search,Favorites}/
│       ├── UI/{Theme,Components}/
│       ├── Core/{Network,Auth,Push,Call,Session,Sync,Realtime,Media,Storage,Config,Util}/
│       ├── Data/{Models,Repositories}/
│       └── App/                # MainTabView.swift 等入口
├── web/                       ← 【Web 客户端，当前维护】React（同时是 Windows 桌面端的渲染层）
│   ├── src/
│   │   ├── components/         # ChatList/ChatWindow/ContactList/Profile/GroupInfo/UserProfile...
│   │   ├── pages/               # Login/Register/Home/Moments...
│   │   ├── styles/windows/      # 仅 Electron 桌面端生效的样式覆盖（.electron-app 作用域）
│   │   └── design-tokens.css    # Web/Mobile 共享的设计令牌
│   └── android/                ← 【已废弃】Capacitor 生成壳，见第 3 节判据
├── desktop-electron/          ← 【Windows 桌面端】Electron 外壳，加载 web/dist 构建产物
│   └── src/main.js
├── backend-v2/                 ← 后端（本次扫描不涉及，仅列出以说明四端共用同一套 API）
├── docs/ui-refactor/            ← 本次扫描文档输出目录（新建）
└── .github/workflows/          # android-build.yml / android-release.yml / windows-build.yml / ios-build.yml / ios-testflight.yml 等
```

## 2. 四端真实目录标注

| 端 | 真实目录 | 状态 |
|---|---|---|
| **Windows 客户端** | `desktop-electron/`（Electron 外壳）+ `web/src/`（渲染层源码，`web/dist` 是构建产物）+ `web/src/styles/windows/*.css`（桌面专属样式，`.electron-app` 作用域） | 当前维护 |
| **Web 客户端** | `web/src/`（与 Windows 共用同一份 React 源码，非 `.electron-app` 作用域的部分即纯 Web/移动 Web 表现） | 当前维护 |
| **Android 原生** | `android/app/src/main/java/com/vxin/app/`（Kotlin + Jetpack Compose） | **当前维护** |
| ~~Android (Capacitor)~~ | `web/android/`（`cap add android` 自动生成的壳工程） | **已废弃**，见第 3 节 |
| **iOS 原生** | `ios/Vxin/`（SwiftUI） | 当前维护 |

Web 和 Windows 是**同一套 React 源码**，Windows 通过 Electron 加载 `web/dist`，并用 `web/src/styles/windows/*.css`（选择器统一加 `.electron-app` 前缀）叠加桌面专属样式；这意味着"Windows/Web 视觉统一"这一诉求在代码层面本来就有共享基础，改版时改一处共享组件即可同时影响两端，只有 `.electron-app` 作用域下的桌面专属样式需要单独处理。

## 3. Capacitor 废弃项目判据

判断对象：`web/android/`（Capacitor 生成壳）vs `android/`（本次归类为"当前维护"的原生工程）。

| 判据 | `web/android/`（Capacitor 壳） | `android/`（原生工程） |
|---|---|---|
| 自定义源码量 | 仅 1 个自定义文件：`app/src/main/java/com/vxin/app/MainActivity.java`（Capacitor 标准桥接样板），其余是 Capacitor/Cordova 自动生成的骨架（`capacitor-cordova-android-plugins/` 等） | 30+ 个按 feature 组织的 Kotlin 目录：`feature/{chat,contacts,profile,settings,group,labels,favorites,wallet,call,callhistory,search,sessions,auth,update}/`，加 `ui/{theme,components}`、`data/{model,api,repository}`、`core/{network,auth,push,call,media,storage,config,util,realtime,di,update}` |
| 生成方式 | `web/package.json` 的 `build:android` 脚本是 `npm run build && cap add android && cap sync android && cap open android`——`cap add android` 每次执行都会**重新生成/覆盖**该目录，证明它是可丢弃的构建产物，不是手工维护源码 | 手工维护，有独立 `README.md`：`# v信 Android（Kotlin + Jetpack Compose）` |
| CI 依赖 | 全仓库 `.github/workflows/*.yml` **零处**引用 `web/android` 路径 | `android-build.yml`/`android-release.yml` 明确以 `'android/**'` 为路径触发条件，产物路径为 `android/app/build/outputs/apk/...` |
| 历史提交量 | 全部历史仅 **7 次**提交触及该目录 | 持续的原生 feature 提交记录（本次扫描当天仍有相关 commit） |
| README 说明 | 无独立 README | 有，且写明真实技术栈版本号（见下） |

**结论**：`android/` 是当前维护的真实原生项目；`web/android/` 是 Capacitor `cap add` 命令的一次性生成产物，属于已废弃/可丢弃目录。本次及后续 UI 相关工作只涉及 `android/`，不应触碰 `web/android/`。

## 4. 各端技术栈

| 端 | 语言/框架 | UI 组件库 | 现有主题系统 |
|---|---|---|---|
| Windows | Electron + React 18（与 Web 共用源码） | 原生 JSX + CSS（无第三方组件库，class 命名体系为 `wc-*`/`gi-*`/`up-*`/`cl-*` 等前缀） | `web/src/design-tokens.css`（共享）+ `web/src/styles/windows/tokens.css`（`--vx-*`，`.electron-app` 专属） |
| Web | React 18 + Vite | 同上 | `web/src/design-tokens.css` |
| Android | Kotlin 1.9.22 + Jetpack Compose（BOM 2024.02），Hilt（DI）、Retrofit+OkHttp、Kotlinx Serialization、Navigation Compose、Coroutines/Flow（MVVM）；AGP 8.1.4 / Gradle 8.3 / JDK 17 | Material3（`androidx.compose.material3`） | `android/app/src/main/java/com/vxin/app/ui/theme/{Theme,Color,Dimens,TextSize}.kt` |
| iOS | Swift + SwiftUI（`Features/`/`Core/`/`UI/`/`Data/` 分层） | SwiftUI 原生组件 | `ios/Vxin/UI/Theme/{Theme,Dimens,FontSize}.swift` |

## 5. 现有 Design Tokens / Theme 文件位置

| 端 | 文件 | 覆盖范围 |
|---|---|---|
| Web（共享，含移动 Web） | `web/src/design-tokens.css` | 间距 `--sp-*`、圆角 `--radius-*`、字号 `--text-*`、色彩（`:root` + `body.dark-mode`）等，Web 与移动 Web 共用，是干净的单一来源 |
| Windows（Electron 专属） | `web/src/styles/windows/tokens.css` | `--vx-*` 前缀，作用域限定在 `.electron-app`（`html.electron-app:has(body.dark-mode)` 处理深色，虽然本阶段只做浅色） |
| Android | `android/app/src/main/java/com/vxin/app/ui/theme/Theme.kt`（M3 ColorScheme 构建 + 主题切换）、`Color.kt`（颜色常量）、`Dimens.kt`（`VxinRadius` 圆角刻度）、`TextSize.kt`（`VxinTextSize` 字号刻度） | 圆角/字号刻度数值已注释说明"对齐 Web design-tokens.css" |
| iOS | `ios/Vxin/UI/Theme/Theme.swift`（Color 扩展 + 渐变）、`Dimens.swift`（`VxinRadius` 圆角刻度）、`FontSize.swift`（`VxinFontSize` 字号刻度） | 圆角/字号刻度数值同样标注为跨平台单一来源，但**目前没有独立的间距刻度文件**（间距散落在各 View 文件的私有 `Tok` 枚举里，见 02 号文档） |

## 6. 品牌主绿色真实色值（已从源码逐一核对，非猜测）

**`#07C160`**，四端完全一致：

| 端 | 文件:行号 | 定义 |
|---|---|---|
| Web | `web/src/design-tokens.css:33` | `--brand-500: #07C160;   /* ← 主品牌色 v信绿 */` |
| Windows/Electron | `web/src/styles/windows/tokens.css:7` | `--vx-primary: #07C160;` |
| Android | `android/app/src/main/java/com/vxin/app/ui/theme/Color.kt:6` | `val VxinBrand = Color(0xFF07C160)          // 主品牌色 v信绿` |
| iOS | `ios/Vxin/UI/Theme/Theme.swift:5` | `static let vxinBrand = Color(red: 0x07/255, green: 0xC1/255, blue: 0x60/255) // #07C160` |

额外确认：圆角刻度在 Web（`--radius-*`）、Android（`VxinRadius`）、iOS（`VxinRadius`）三处的数值**已经完全对齐**（4/6/8/10/12/14/16/18/20/25），字号刻度数值也一致——说明四端在"数值定义"层面本来就没有分裂，真正的不一致在于"各页面是否老老实实引用这些已有 token"，而不是需要重新发明一套新数值。详见 `02-ui-audit.md`。
