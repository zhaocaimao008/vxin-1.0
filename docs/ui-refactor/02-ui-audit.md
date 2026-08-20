# v信项目 UI 审计（02 / 3）

> 只读审计，只描述现状，不出改造方案（方案见 `03-design-tokens-proposal.md`）。每个模块列出四端实现文件、四端不一致点、明显过时点。

---

## 1. 消息列表（会话列表）

| 端 | 实现文件 |
|---|---|
| Web/Windows | `web/src/components/ChatList.jsx`（列表本体）+ `web/src/components/ChatWindow.jsx`（进入聊天页逻辑） |
| Android | `android/app/src/main/java/com/vxin/app/feature/chat/ConversationListScreen.kt`（`ConversationListScreen`，行内 `ConversationRow`） |
| iOS | `ios/Vxin/Features/Chat/ConversationListView.swift`（`ConversationListView`，私有 `ConversationRow`） |

**四端不一致点**：
- 筛选 Tab：Android/iOS 都有"全部/未读/联系人/群聊"筛选 pill 行（`ConvFilterTabs`），Web/Windows 版本未确认是否有对应 UI（本轮未重新扫描 ChatList.jsx 细节，按此前经验其筛选能力弱于原生两端，需在方案阶段核实）。
- 头像尺寸：Android/iOS 均用 `InitialAvatar`（Android 未指定统一调用尺寸，iOS 会话行固定 48pt）；Web 端头像尺寸走 CSS class，未与原生两端的具体像素值做过对齐检查。
- 未读角标：Android/iOS 都是"红色圆点 + 免打扰时显示铃铛静音图标"的组合；Web/Windows 现状未在本轮核实是否有同等的"免打扰"视觉区分。
- 置顶样式：Android/iOS 都是"左侧绿色竖条 + 行背景轻微着色"；Web 端具体实现未在本轮复核。

**明显过时点**：
- Android/iOS 两端的会话行组件（`ConversationRow`）都是各文件内私有实现，没有复用任何跨模块共享的"列表行"组件（详见"我的/设置"模块里提到的 `Tok`/行组件碎片化问题，消息列表是这个碎片化问题里尚未被同一份报告覆盖的又一处实例）。

---

## 2. 聊天页面（聊天详情）

| 端 | 实现文件 |
|---|---|
| Web/Windows | `web/src/components/ChatWindow.jsx`（约 2500+ 行，含顶部栏、消息气泡、输入区、More 面板逻辑） |
| Android | `android/app/src/main/java/com/vxin/app/feature/chat/ChatScreen.kt`（`ChatScreen`，约 2060 行） |
| iOS | `ios/Vxin/Features/Chat/ChatView.swift`（`ChatView`，约 1568 行） |

**四端不一致点**：
- 输入区"更多/+"面板：Web/Windows 此前一轮已修过桌面端的裁切问题（`.electron-app .wc-more-panel`，见 `web/src/styles/windows/base.css`），改为紧凑单行 flex 布局；Android 是 `FunctionPanel`（`ChatScreen.kt` 内，图片/文件/截屏/红包/转账/定时发送）；iOS 是"+"面板（相册/文件/截屏/红包/转账仅私聊/定时发送）。三端功能项基本对应，但视觉风格（图标网格密度、圆角、间距）各自独立实现，未对齐同一套 token。
- 顶部栏操作按钮：三端都有电话/视频通话按钮 + 更多菜单，但菜单项呈现方式不同（Android 是下拉 dropdown，iOS 是 toolbar menu，Web 是弹出面板），图标风格未统一。
- 消息气泡：三端均支持文本/图片/语音(含转文字)/文件/视频/红包/转账/名片/表情/拍一拍，但气泡圆角、间距、已读回执样式（Android/iOS 有 `MsgTickView`/已读勾选逻辑，Web 端具体呈现未在本轮复核）未做跨端比对。

**明显过时点**：
- Android `ChatScreen.kt`、iOS `ChatView.swift` 都是单文件 1500~2000+ 行的巨型 Composable/View，UI 元素（气泡、面板、顶部栏）与业务逻辑耦合在同一文件里，不利于后续做纯 UI 层改造时精确定位视觉代码而不误碰逻辑——这是审计发现的一个结构性风险点，不是"过时"但会显著增加后续 UI 改造的操作面。

---

## 3. 通讯录

| 端 | 实现文件 |
|---|---|
| Web/Windows | `web/src/components/ContactList.jsx`（单文件 ~940 行，含新的朋友/群聊/黑名单/标签四个 tab，均为内部 `tab` state 切换，非独立路由） |
| Android | `android/app/src/main/java/com/vxin/app/feature/contacts/ContactsScreen.kt`（主列表 + `ContactsIndexedList`）+ `FriendRequestsScreen.kt` + `AddFriendScreen.kt` + `BlockedScreen.kt` + `CreateGroupScreen.kt` + `feature/labels/FriendLabelsScreen.kt` |
| iOS | `ios/Vxin/Features/Contacts/ContactsView.swift` + `AddFriendView.swift` + `FriendRequestsView.swift` + `BlockedView.swift` + `FriendLabelsView.swift` + `CreateGroupView.swift` |

**四端不一致点（最显著的一处平台差异）**：
- **右侧 A-Z 字母索引**：Web（`.wc-alpha-index`/`.wc-alpha-char`/`.wc-alpha-bubble`，`ContactList.jsx`）**已实现**；Android（`ContactsIndexedList`，`ContactsScreen.kt` 内私有 composable，含 `stickyHeader` + 右侧竖排字母 + 点击滚动定位）**已实现**；**iOS 未实现**——`ContactsView.swift` 只是普通 SwiftUI `List` + `Section`（按 `sectionLetter(of:)` 分组），没有任何侧边字母导航条组件（repo 内 grep `SectionIndex`/`字母索引`/`azIndex` 均无命中）。这是四端里唯一一处"某一端完全没有对应 UI 元素、而非只是样式不同"的情况。
- 功能入口行：Web 顶部是 6 个入口行（新的朋友/群聊/添加好友/黑名单/好友标签/文件传输助手）；Android/iOS 是 4 个（新的朋友/群聊/好友标签/黑名单，添加好友走独立的 + 号图标而非列表行）。三端入口数量和排布不完全一致。
- 联系人行头像：Android/iOS 均有"在线状态绿点"叠加在头像右下角；Web 端是否有同等在线状态视觉未在本轮复核确认。

**明显过时点**：
- 桌面端（`.electron-app`）目前**没有** A-Z 索引的专属样式覆盖（`web/src/styles/windows/*.css` 内 grep 不到 `.wc-alpha-*`），Electron 环境下这块渲染出来是套用移动端共享样式，不是桌面定制视觉。

---

## 4. 我的（Profile 首页 / Me Tab）

| 端 | 实现文件 |
|---|---|
| Web/Windows | `web/src/components/Profile.jsx`（同一文件承载"我的"首页与全部设置子页，靠内部 `subPage` state 切换；移动端/Electron 走单栏卡片列表，纯浏览器桌面 Web 走 `WebSettingsShell` 双栏布局） |
| Android | `android/app/src/main/java/com/vxin/app/feature/profile/ProfileScreen.kt` |
| iOS | `ios/Vxin/Features/Profile/ProfileView.swift` |

**当前实际存在的分区/行（三端基本一致，供后续方案阶段核对"不新增业务功能"边界）**：
1. 头部身份卡：头像 + 用户名 + "v信号：xxx" + 二维码入口，点击进个人资料编辑页。
2. 账户与服务：手机号、我的钱包、收藏（**功能开关控制，非恒定显示**）、通话记录、登录设备管理。
3. 独立一行：设置入口。
4. 其他：邀请好友、切换账号。
5. 退出登录按钮。
6. 版本号页脚。

**确认不存在、不应在改版中新增的行**：朋友圈/动态入口（是独立底部 Tab，不在"我的"页面内）、卡包（独立于"我的钱包"之外的卡包功能不存在）、扫一扫/表情商店/帮助与反馈等常见微信 8.x 元素，三端均未实现。

**四端不一致点**：
- Android/iOS 各自在本文件内声明了**私有的 `Tok`/颜色字面量**（间距、部分颜色），未引用共享 `Color.kt`/`Theme.swift` 里已有的对应 token（如 Android `Color.kt` 里已定义 `VxinGreen34`/`VxinGreenBg`/`VxinPageBg`/`VxinDivider`/`VxinIconGray`，但 `ProfileScreen.kt` 没有直接用，而是自己重复声明了一份等价的 `Tok`）。
- Web 端存在"移动端/Electron 单栏卡片列表" vs "纯浏览器桌面双栏 `WebSettingsShell`"两套不同布局逻辑共存于同一组件，这是 Web 内部的不一致，不是跨端不一致，但会影响改版时的改动范围判断。

**明显过时点**：
- 三端的"设置行"组件（Android 的 `SettingsRow`/`HubRow`/`EditRow`/`QuickEntryRow`，iOS 的 `SettingsRow`/`HubRow`/`QuickEntryRow`/`ContactRowView`，Web 的 `CRow`）都是几乎相同的"图标+标题+说明+右侧值+chevron"结构，但在各自代码里独立重复实现了 3–4 遍，没有抽成一个共享组件。

---

## 5. 设置

| 端 | 实现文件 |
|---|---|
| Web/Windows | 与"我的"同文件 `web/src/components/Profile.jsx`（`subPage` 值如 `appearance`/`notifications`/`privacy`/`general` 对应的子函数），另有独立的 `WebSettingsShell`（纯浏览器桌面双栏布局专属） |
| Android | `android/app/src/main/java/com/vxin/app/feature/settings/SettingsHomeScreen.kt` + `SettingsScreens.kt`（`PrivacySettingsScreen`/`NotificationSettingsScreen`/`AppearanceSettingsScreen`） |
| iOS | `ios/Vxin/Features/Profile/SettingsHomeView.swift` + `SettingsViews.swift`（`AppearanceSettingsView`/`NotificationSettingsView`/`PrivacySecurityView`/`ChangePhoneView`/`QuietSettingsView`） |

**当前实际存在的设置项（三端基本对应）**：消息通知（含勿扰模式时间段设置）、隐私与安全（加好友方式、好友与群相关开关）、外观（日间/夜间/跟随系统，iOS 额外有字体大小选项：小/标准/大/特大）、登录设备管理、清除缓存（显示实时计算的缓存大小）、关于 v信（版本号）。Windows/Electron 额外有：服务器地址、快捷键设置（这两项是桌面独有，Android/iOS 没有对应项，属于平台差异而非需要补齐的缺口）。

**四端不一致点**：
- 分组视觉：Android `SettingsHomeScreen` 用两张卡片（卡片1：消息通知/隐私与安全/外观/登录设备管理；卡片2：清除缓存/关于v信）；iOS `SettingsHomeView` 结构相同但用了完全独立的私有组件 `HubCard`/`HubRow`/`HubDivider`（与同为 iOS 的 `ProfileView` 所用的 `VxCard`/`SettingsRow` 不是同一套实现）；Web 端桌面浏览器走 `WebSettingsShell` 左侧分类导航栏，Electron/移动端走单栏卡片——四种呈现方式并存。
- 字体大小选项：iOS 独有"字体大小：小/标准/大/特大"设置，Android/Web 未见对应项。

**明显过时点**：
- 同上节所述的行组件重复实现问题，在设置模块同样存在（iOS 甚至同一端内部 `ProfileView` 和 `SettingsHomeView` 就用了两套不同名字的行组件）。

---

## 6. 个人资料 / 好友资料

| 端 | 实现文件 |
|---|---|
| Web/Windows | 个人资料（自己）：`Profile.jsx` 内 `ProfileDetail` 函数；好友资料（他人）：独立组件 `web/src/components/UserProfile.jsx`（弹出卡片，`up-*` class 前缀） |
| Android | 个人资料：`android/app/src/main/java/com/vxin/app/feature/profile/ProfileEditScreen.kt`；好友资料：**不存在独立页面**，唯一近似 UI 是 `AddFriendScreen.kt` 内加好友扫码后弹出的资料卡（私有 composable） |
| iOS | 个人资料：`ios/Vxin/Features/Profile/ProfileEditView.swift`；好友资料：**不存在独立页面**，唯一近似 UI 是 `AddFriendView.swift` 内的 `ScannedUserProfileSheet`（私有 struct） |

**四端不一致点（第二处显著平台差异）**：
- **Web 端有独立的"好友资料"卡片/弹层组件（`UserProfile.jsx`）**，点击联系人列表里的联系人会打开这个资料卡；**Android/iOS 均没有对应页面**，点击联系人会直接进入聊天，唯一能看到"他人资料"的场景是加好友流程中扫码之后的一次性确认卡片。这意味着 Web 端存在一个 Android/iOS 都没有的完整交互路径，而不仅仅是视觉差异。
- 个人资料页字段：三端目前一致，均只有头像/昵称/v信号(只读)/个性签名/手机号/我的二维码，**均不包含**性别/生日/邮箱/职业/公司/所在地等字段——Android/iOS 代码里均有明确注释说明这些字段在当前数据模型里不存在，不是遗漏。

**明显过时点**：
- 无（该模块三端"缺什么"比"哪里旧"更值得注意，已如上标注）。

---

## 7. 群聊设置（聊天详情/群管理）

| 端 | 实现文件 |
|---|---|
| Web/Windows | `web/src/components/GroupInfo.jsx`（42KB，右侧滑入面板，`gi-*` class 前缀）；私聊对应面板是 `PrivateChatSettings.jsx` |
| Android | `android/app/src/main/java/com/vxin/app/feature/group/GroupInfoScreen.kt` |
| iOS | `ios/Vxin/Features/Group/GroupInfoView.swift` |

**当前实际存在的功能（三端一致）**：群头像/群名称（可改，需管理权限）、群公告、我的群昵称、群二维码、群成员宫格/列表（含邀请成员、设管理/取消管理/转让/移除）、群管理开关（全员禁言、禁止成员间私聊、禁止成员互加好友——Web 端额外有"允许普通成员邀请"这一项，Android/iOS 未在本轮扫描材料中确认是否有此项，需在方案阶段复核）、消息免打扰、置顶聊天、聊天文件、导出聊天记录、清空聊天记录、解散/退出群聊。

**四端不一致点**：
- 呈现形态：Web/Windows 是"从聊天页右侧滑入的面板"（非独立页面，`gi-panel` 固定 286px 宽）；Android/iOS 是"独立的群信息页面"（`GroupInfoScreen`/`GroupInfoView`，有自己的导航层级）。这是布局形态的平台差异，符合"Android 遵循 Material、iOS 遵循 HIG"的预期差异范畴，但 Web 桌面端的"滑入面板宽度/间距是否与 Windows 视觉统一目标一致"需要在方案阶段确认。
- Web 端群管理区域代码注释标注"钉钉对标设计"，说明该区域此前是参照钉钉而非微信做的视觉，与本次"参考微信 8.x"的目标方向不一致，是本模块里最明显的过时点。

**明显过时点**：
- 上述"钉钉对标设计"注释是唯一一处代码里明确自认"不是照着微信做的"的地方，其余模块的"过时"更多是碎片化/未对齐 token，而非明确的风格错位。

---

## 附：跨模块共性问题小结（供 03 号方案文档参考，不在此处展开方案）

1. **Token 碎片化**：Android（`ProfileScreen`/`ProfileEditScreen`/`SettingsHomeScreen`）、iOS（`ProfileView`/`ProfileEditView`/`SettingsHomeView`）都存在"页面级私有 `Tok`/颜色字面量，未引用共享 Theme 文件"的问题，且 iOS 的 `Dimens.swift` 目前只有圆角刻度、**没有间距刻度**（间距靠各文件私有 `Tok` 各自维护）。
2. **列表行组件重复实现**：三端都存在 3–4 份几乎相同的"图标+文字+chevron"行组件分别写在不同文件里，没有抽成共享组件。
3. **两处真实的平台功能缺口**（非样式问题）：iOS 通讯录缺 A-Z 侧索引；Android/iOS 均缺独立"好友资料"页（Web 有）。
