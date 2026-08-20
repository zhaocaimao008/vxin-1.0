# v信项目 Design Tokens 统一方案提案（03 / 3）

> 这是**提案文档**，不接入任何实际组件/代码文件。目标：让四端在"数值定义"和"页面实际引用"两个层面都统一，而不只是定义层面（现状已发现圆角/字号数值在三端已经一致，真正缺的是统一的间距刻度 + 各页面老实引用，而不是发明一套全新数值体系）。第一阶段仅浅色模式，深色留空/占位即可，不展开。

## 0. 设计原则

1. **延续现有数值，不重新发明**：圆角、字号刻度四端已对齐（见 `01-repo-scan.md` 第 6 节），本方案直接采纳现状数值作为正式规范，只补齐缺失部分（iOS 间距刻度）和跨端命名映射表。
2. **品牌绿保持 `#07C160` 不变**，不引入新主色，只做语义色扩展（成功/警告/错误/信息/链接等）。
3. **不复制微信素材**：本文档给出的是数值/规范，不含任何微信官方 Logo、图标描边路径、专有插画等版权内容；图标规范一节只约定尺寸/线宽/风格参数，具体图标沿用 v信 现有的 `ui/VxinIcons.kt`（Android）/系统 SF Symbols（iOS）/`components/TabIcons.jsx`（Web）体系自行绘制或用中性图标库替换，不描摹微信图标。
4. **Windows/Web 视觉统一，Android/iOS 保留原生交互**：数值刻度四端共享，但导航栏形态、列表滑动手势、返回手势、原生控件（Switch/Alert/ActionSheet 样式）遵循各自平台惯例，见第 8 节。

---

## 1. 色彩

延续品牌绿 `#07C160`（三端已一致，见 01 号文档第 6 节），浅色模式语义色在现有基础上做扩展和补齐命名（本阶段不做深色，深色变量留空占位供未来阶段填）：

| 语义 | 用途 | 建议值（浅色） | 现状对应 |
|---|---|---|---|
| `primary` | 品牌绿主色 | `#07C160` | 三端已有 |
| `primary-hover` | 主色悬浮/按下态 | `#06A652` | Web `--vx-primary-hover` 已有，Android/iOS 需补 |
| `primary-muted` | 主色浅底（选中态背景等） | `#E6F9EF` | Android `VxinBrandMuted` 已有，Web/iOS 需统一命名对齐 |
| `success` | 成功态 | 复用 `primary` | 三端已如此 |
| `warning` | 警告态 | `#FAAD14` | Web 已有，Android/iOS 需补齐正式 token（而非临时字面量） |
| `error` | 错误/危险态（如"解散群聊"按钮） | `#FF4D4F` | 三端已有对应值，命名不统一（`VxinError`/`vxinError`/`--vx-danger`），建议统一叫 `error` |
| `info` | 信息提示 | 复用 `primary` | 现状 |
| `text-primary` | 主文字 | `#1F2329` | 三端已有 |
| `text-secondary` | 次要文字 | `#8A8F98` | 三端已有 |
| `text-tertiary` | 三级/占位文字 | `#B0B4BB` | Web 已有，需在 Android/iOS 补齐命名 |
| `bg-page` | 页面底色 | `#F7F8FA`（消息类页面）/ `#F5F5F7`（"我的"类页面，现状两套背景色并存，见下方"待决策项"） | — |
| `divider` | 分割线 | `#E9E9EC` | 见第 6 节单独展开 |
| `bubble-mine` | 我方消息气泡 | `#CFF3D9`（三端已对齐，Android 是 `#CFF3D9`，Web/iOS 数值需在实施阶段逐一核对是否完全一致） | — |

**待决策项（不在本文档内替用户拍板，实施阶段需确认）**：现状扫描发现"我的/设置"类页面用的是 `#F5F5F7` 系背景（Android `VxinPageBg`），而消息类页面用的是 `#F7F8FA`（Web `design-tokens.css` 根变量），两者非常接近但不是同一个值——建议统一成一个，具体选哪个留给实施阶段和视觉细节一起定，本文档不擅自二选一。

---

## 2. 字体

字号阶梯三端数值已一致（见 01 号文档），本方案固定为正式规范：

| Token | 数值 | 用途参考 |
|---|---|---|
| `text-xs2` | 10 | 极小标签 |
| `text-xs` | 11 | 次要说明文字 |
| `text-sm` | 12 | 辅助文字 |
| `text-sm2` | 13 | 时间戳/计数 |
| `text-base` | 14 | 正文默认 |
| `text-md` | 15 | 列表主文字 |
| `text-lg` | 16 | 强调文字/输入框 |
| `text-xl` | 18 | 小标题 |
| `text-xxl` | 20 | 页面大标题 |
| `display-*` | 22/26/30/40 | 数字展示（钱包余额等） |

**四端字体栈映射**（不改字号数值，只补齐"用什么字体渲染"的平台映射，因为这四个数值目前是跨端共享的抽象刻度，还没有对应的 font-family 规范）：

| 端 | 建议字体栈 |
|---|---|
| Windows/Web | `-apple-system, "Segoe UI", "Microsoft YaHei UI", "PingFang SC", sans-serif`（沿用系统默认，不强制内嵌字体，保证 v信 不与微信共用任何自定义字体文件） |
| Android | Compose 默认 `Typography()`（系统字体，当前 `Theme.kt` 已是如此，维持不变） |
| iOS | SwiftUI 默认系统字体（San Francisco），维持不变 |

即：本方案**不引入自定义字体文件**，只统一"数值刻度"这一层，字体渲染继续用各平台系统默认字体，这样天然规避任何字体授权/相似度风险。

---

## 3. 间距规范

Web 已有完整刻度 `--sp-*`（1/4/6/8/10/12/14/16/20/24/32/40/48/64px），Android `Dimens.kt` 目前**没有**独立间距刻度（页面级私有 `Tok` 各自维护近似值：4/8/12/16/20/24），iOS `Dimens.swift` 同样**没有**独立间距刻度（同样是页面私有 `Tok`，数值上和 Web/Android 已经在实际使用中趋同，只是没有正式收编）。

**统一建议刻度**（对齐 Web 现状，Android/iOS 补建正式 token 文件收编现有私有 `Tok`，数值不变）：

| Token | 数值(px/pt/dp) |
|---|---|
| `sp-1` | 4 |
| `sp-2` | 8 |
| `sp-3` | 12 |
| `sp-4` | 16 |
| `sp-5` | 20 |
| `sp-6` | 24 |
| `sp-8` | 32 |
| `sp-10` | 40 |
| `sp-12` | 48 |
| `sp-16` | 64 |

Android 建议新增 `Dimens.kt` 内的 `object VxinSpacing`；iOS 建议在 `Dimens.swift` 内新增 `enum VxinSpacing`。两者数值与上表一致，命名与已有的 `VxinRadius`/`VxinTextSize` 保持同一风格。

---

## 4. 列表规范

| 项 | 建议值 | 现状 |
|---|---|---|
| 联系人/会话列表行高 | 62px（Web `.wc-contact-item` 已是 `contain-intrinsic-size: auto 62px`，作为跨端基准） | Android/iOS 未见明确固定行高 token，靠 padding 撑开，建议实施阶段测量后对齐到 62 附近的最近整数 |
| 会话行头像尺寸 | 48px/pt/dp（iOS 会话行已是 48pt，作为基准） | Android/Web 未见显式统一到 48 的 token，各处直接传入数值 |
| 通讯录行头像尺寸 | 44px/pt/dp（iOS 联系人行已是 44pt） | 同上，建议收编为 `avatar-md`（列表用）与 `avatar-lg`（详情页头图用，建议 64px，对应 Web `.wc-me-header` 现状 64px） |
| 群成员宫格头像 | 40px/pt/dp（iOS `GroupInfoView` 成员行已是 40pt） | — |

建议新增头像尺寸 token 集合：`avatar-sm`(36) / `avatar-md`(44) / `avatar-lg`(64) / `avatar-xl`(80，用于个人资料大头像)，具体数值以现状最常见值为准，实施阶段逐页核对后微调。

---

## 5. 圆角规范

三端已完全一致（见 01 号文档），直接固定为正式规范，不改动：

| Token | 数值 |
|---|---|
| `radius-tag` | 4 |
| `radius-sm` | 6 |
| `radius-thumb` | 8 |
| `radius-badge` | 10 |
| `radius-md` | 12 |
| `radius-avatar` | 14 |
| `radius-card` | 16 |
| `radius-lg` | 18 |
| `radius-xl` | 20 |
| `radius-pill` | 25 |
| `radius-full` | 50%（圆形） |

Windows/Electron 现状 `--vx-*` 圆角刻度偏小（`--vx-r-xs:4, --vx-r-sm:6, --vx-r-md:8, --vx-r-lg:12`，只覆盖到共享刻度的中段），建议 Electron 桌面端逐步过渡到与共享刻度完全一致，而不是维持一套更扁平的独立刻度——这样"Windows/Web 视觉统一"这条要求才有 token 层面的保证，不只是页面视觉上凑巧接近。

---

## 6. 分割线规范

| 项 | 建议值 |
|---|---|
| 颜色 | `divider` token（浅色 `#E9E9EC`，对齐 Android `VxinDivider` 现状值） |
| 粗细 | 1px（物理像素，各平台用 hairline 处理：Web `1px solid`，Android `Divider(thickness = 0.5.dp)` 或按屏幕密度用 hairline，iOS 用系统 `Divider()` 默认厚度） |
| 使用场景 | 列表行之间、卡片分组之间、设置区块之间；卡片内部同组行之间用分割线，不同组之间用留白（`sp-4`~`sp-6`）+ 分组标题，不叠加分割线，避免"线套线"视觉噪音（现状部分页面存在这个问题，如 Android/iOS 设置页卡片内既有分割线又有较大留白，实施阶段建议二选一） |

---

## 7. 图标规范

| 项 | 建议值 |
|---|---|
| 列表行图标 | 20×20（容器 36×36 圆角矩形背景，对齐上一轮 Windows More Panel 改版里已经验证过的桌面紧凑尺寸） |
| 顶部导航栏图标 | 24×24 |
| Tab Bar 图标 | 24×24（选中/未选中两态，选中态用 `primary` 着色） |
| 线宽 | 统一 1.5–1.75（Stroke-based 图标风格，避免和微信的填充式双色图标撞风格） |
| 风格 | 简洁线性图标为主，功能入口的"图标底色圆角矩形"沿用现有 Android/Web 已经在用的"彩色圆角图标底"模式（如 Web `--icon-bg-wallet`/`--icon-bg-invite` 等），颜色从语义色扩展，不新增和微信撞色的组合 |
| 来源 | 复用/扩展各端现有图标资产（Android `ui/VxinIcons.kt` 现有 ~28 个手绘 ImageVector、iOS 系统 SF Symbols、Web 现有 icon 组件），不引入微信图标描边路径 |

---

## 8. 导航栏规范

**Windows/Web（统一视觉）**：
- 顶部栏高度：沿用 Web 现状 `--header-h`（实施阶段取现值固定为正式 token）。
- 桌面端左侧一级导航（消息/联系人/动态/我的图标栏）宽度：沿用 Electron 现状 `--vx-nav-width: 72px`，作为 Windows/Web 桌面视觉统一的基准值不变动。
- 会话列表栏宽度：沿用 `--vx-list-width: 330px`。
- 两端后续实施时应通过共享组件/共享 CSS class 落地，不允许 Windows 和 Web 分别硬编码两套不同数值。

**Android（遵循 Material）**：
- 底部导航：`NavigationBar`/`BottomNavigation`（Material3 组件），保留系统涟漪反馈、图标+文字两态。
- 顶部：`TopAppBar`（Material3），保留系统返回箭头（非 iOS 风格"‹"）、系统级下拉菜单/ActionSheet。
- 列表滑动：保留 Android 系统滑动删除/操作手势与长按上下文菜单（`DropdownMenu`），不引入 iOS 风格的滑动手势。

**iOS（遵循 HIG）**：
- 底部：`TabView`，图标+文字，选中态用系统高亮逻辑。
- 顶部：`NavigationStack` 原生导航栏，保留系统返回手势（边缘右滑）、`.navigationTitle`。
- 列表交互：保留 `swipeActions`、系统 `contextMenu`（长按弹出）、`Form`/`List` 原生分组样式（这本身已经是 iOS 惯用的"insetGrouped"外观，不需要改造成自定义卡片，只需让颜色/间距/圆角对齐第 1–6 节的共享 token）。

**保持品牌一致同时允许原生差异的原则**：色彩（品牌绿+语义色）、字号刻度、间距刻度、圆角刻度、图标线宽风格这五项在四端强制一致；导航栏具体控件形态（TabBar vs NavigationBar、返回手势、列表滑动手势、系统菜单样式）遵循各平台原生惯例，不强行让 Android/iOS 模仿 Windows/Web 的自定义布局，也不让 Windows/Web 模仿某一移动端手势。

---

## 9. Token 文件草案示例（仅示例，不接入实际组件）

### CSS 变量（Web/Windows 共享层新增示例，实际实施时合并进 `design-tokens.css`，不新建独立文件）

```css
:root {
  /* 间距（Web 已有，示例保留作对照） */
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px;
  --sp-5: 20px; --sp-6: 24px; --sp-8: 32px;

  /* 新增语义色补齐 */
  --color-primary-hover: #06A652;
  --color-primary-muted: #E6F9EF;
  --color-text-tertiary: #B0B4BB;

  /* 头像尺寸（新增） */
  --avatar-sm: 36px;
  --avatar-md: 44px;
  --avatar-lg: 64px;
  --avatar-xl: 80px;
}
```

### Kotlin（Android，示例，实际实施时新增 `ui/theme/Spacing.kt`）

```kotlin
object VxinSpacing {
    val sp1 = 4.dp
    val sp2 = 8.dp
    val sp3 = 12.dp
    val sp4 = 16.dp
    val sp5 = 20.dp
    val sp6 = 24.dp
}
```

### Swift（iOS，示例，实际实施时并入 `Dimens.swift`）

```swift
enum VxinSpacing {
    static let sp1: CGFloat = 4
    static let sp2: CGFloat = 8
    static let sp3: CGFloat = 12
    static let sp4: CGFloat = 16
    static let sp5: CGFloat = 20
    static let sp6: CGFloat = 24
}
```

### JSON（跨端参考用，非任何一端直接消费）

```json
{
  "color": { "primary": "#07C160", "primaryHover": "#06A652", "primaryMuted": "#E6F9EF" },
  "spacing": { "sp1": 4, "sp2": 8, "sp3": 12, "sp4": 16, "sp5": 20, "sp6": 24 },
  "radius": { "sm": 6, "md": 12, "card": 16, "pill": 25 },
  "avatar": { "sm": 36, "md": 44, "lg": 64, "xl": 80 }
}
```

以上三段代码仅为草案示例，用于本文档说明数值如何落地成各端token 文件的写法，**未创建/未修改任何实际源码文件**。

---

## 10. 与 02 号审计文档的对应关系

本方案第 4 节直接回应审计发现的"列表行组件重复实现"问题（统一头像/行高 token 后，才有条件把 Android 的 `SettingsRow`/`HubRow`/`EditRow`/`QuickEntryRow`、iOS 的对应四份、Web 的 `CRow` 收敛成一个共享组件，但组件收敛本身属于实施阶段的代码改动，不在本文档范围内）；第 3 节直接回应 iOS 缺间距刻度文件的问题；第 8 节直接回应"iOS 通讯录缺 A-Z 索引"和"Android/iOS 缺好友资料页"这两处平台功能差异——本方案的立场是：A-Z 索引数值/交互规范可以统一（属于"整理已有 Android/Web 实现，iOS 补齐同等交互"），但好友资料页在 Android/iOS 是否要新建，属于"是否新增业务功能"的判断，不在本 UI 审计/token 方案阶段处理,留待用户后续决策。
