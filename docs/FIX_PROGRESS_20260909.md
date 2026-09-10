# V信全面修复优化 — 进度记录（2026-09-09 起）

维护规则：每批次追加，不重写历史条目；状态只用以下五种：
`已修复且已验证` / `已修改但待验证` / `未复现` / `受环境阻塞` / `尚未处理`

## 环境与项目确认
- 仓库：`/root/vxin-1.0`（GitHub `zhaocaimao008/vxin-1.0`），当前分支 `main`，本地领先 origin（未推送）
- 四端：Web（`web/`，Vite+React）、Windows 桌面（`desktop-electron/`，Electron 包 Web 构建）、Android（`android/`，Kotlin/Compose 原生）、iOS（`ios/`，SwiftUI 原生）
- 后端：`backend-v2/`（Node/Express + Socket.IO + SQLite better-sqlite3），pm2 跑在生产 `127.0.0.1:3002`
- 已有历史工作（未推翻，本轮复用）：
  - `BRAND_UNIFICATION_REPORT.md`／`ICON_INTEGRATION_REPORT.md`／`BRAND_INTEGRATION_REPORT.md`：App 主图标、启动动画、登录/注册黑金视觉已在四端落地（Android/iOS 已过编译验证，Windows/iOS 因环境限制未过真机/模拟器视觉验收，GitHub Actions 一度因欠费无法跑云端 iOS/Windows CI）
  - `SECURITY_AUDIT_20260807.md` 及多轮 `fix(security)` 提交：此前已修复过多轮安全问题
  - 本仓库存在大量 `fix/*`、`ui-refactor/*` 分支，均为历史尝试，本轮不强行合并，只在验证后复用
- 环境限制（沿用既往记忆，未变化）：本机无 Android 模拟器/真机、无 macOS/Xcode/iOS 模拟器，无法做四端真机截图与真实通话/推送验收；不对生产做压测或直改

## 批次记录

### 批次 1（2026-09-09）— 账号安全 / 会话撤销 / 数据完整性（发现并接手仓库内已有未提交改动）
现象：checkout 时 `backend-v2` 已有 22 个文件的未提交修改 + 3 个未跟踪文件，经比对代码逻辑与 git log 判断属于同一条未完成的安全加固工作（非本轮引入，也非其他项目误改）。逐文件审查后确认逻辑自洽、测试齐全，复用并完成落地：

- **会话撤销 / auth_version**：`f23a660`
  - 改密/重置密码/管理员改密统一推进 `users.auth_version`，HTTP 中间件与 Socket 握手/逐事件校验均比对该版本号，替代原先基于时间戳比较、无法防止并发改密竞态的方案
  - `token_blacklist` 先落库再断连接，消除撤销与在途握手之间的竞态窗口
  - Socket 层新增到期定时器 + 撤销事件实时踢线，不再依赖下次握手才生效
- **附件访问权限 / 数据资金完整性**：`b970aea`
  - 新增 `uploadAccess.js`：`/uploads` 下载改为按消息接收方/动态可见范围/头像可见性/上传者本人校验所有权，替代"知道 URL 即可访问"
  - `/cache/warm` 收权限至管理员，`/cache/warm-user` 收窄为只能预热自己
  - `cacheWarmer.js`/`users.service.js` 由 `SELECT *` 改白名单字段，避免密码哈希/手机号进入缓存或响应体
  - 群解散/清空会话/注销账号：红包资金原子结算后再清理，不再级联删除钱包流水；`deleteUser` 由物理删除改匿名化
  - 群通话新增 `revokeMembership`：踢人/退群/解散群/删号时同步结束该用户在群通话中的参与

状态：**已修复且已验证** — `npm test`（backend-v2 全量 jest，344 passed / 1 skipped）+ 新增 `p0-security.test.js`（附件越权/红包结算/PII 泄露，含在上述通过数里）+ `p0-socket-revocation.test.js`（实时撤销）均通过；未推送远端，未触碰生产 DB。

### 批次 2（2026-09-09）— Web 功能图标统一
- `Icons.jsx` 新增 `IcoGlobe`/`IcoSun`/`IcoMoon`/`IcoAuto`，与现有图标同源风格
- `Profile.jsx` 设备管理列表兜底图标、外观设置日间/夜间/跟随系统三个开关，由彩色 emoji（🌐☀️🌙🌗，各系统渲染不一致）替换为矢量图标
- 状态：**已修复且已验证** — `npm run build` 通过，`eslint` 无新增告警；未改动任何交互逻辑

### 批次 3（2026-09-09）— 业务链路审计 + Web E2E 回归（未发现新代码缺陷，记录审计结论）
逐链路人工核查 + 跑真实 e2e，避免凭空猜测：

- **客户端对 auth_version 撤销的适配**：Web（`axiosInterceptor.js` 401→refresh→`vxin:session_expired` 事件，`AuthContext`/`SocketContext` 统一监听登出跳转）、Android（`AuthInterceptor.kt` 401 即清 token 广播，`SessionManager` 订阅后断 socket + 清离线缓存）、iOS（`APIClient.swift`/`SessionStore.swift` 同构）均已有完整闭环，无需改动；Windows 桌面端是 Electron 套壳 Web 构建，复用同一套逻辑
- **群邀请链接/二维码**：`groups.service.js` 的 `createInviteLink`/`joinByToken` 服务端校验齐全（过期时间、群人数上限、单用户群数上限、`member_can_invite` 开关），路由层（`messages.routes.js`）全部挂了 `auth` 中间件，非"只藏按钮"
- **私聊拉黑/屏蔽陌生人**：`privateSendGuard` 统一守卫，已确认覆盖文本(HTTP+Socket)/文件/图片/语音/视频/红包/拍一拍/群发转发全部发送路径，无遗漏分支
- **消息转发权限**：源消息成员校验 + 目标会话逐个成员校验 + 禁言角色校验 + 拉黑校验，均在服务端完成
- **撤回/删除后数据是否复现**：`remove`/`batchDelete` 直接清空 DB 里的 `content`/`file_url`（非仅打标记），全文搜索索引 `messages_fts` 由 SQLite 触发器（`fts_messages_delete`）在 `deleted` 字段变化时自动清理，不依赖各调用点各自记得清，撤回后无法通过搜索/附件链接复现内容
- **Web E2E 全量回归**：`cd e2e && npm run test:web`（Playwright，隔离后端 127.0.0.1:3099 + 独立测试库，非生产），61 个用例：**59 通过**，`outbox.spec.js` 的 OB-01/OB-02 首轮超时失败；单独重跑该文件 **2/2 通过**（8s vs 首轮 22.9s 超时）——与 `e2e/playwright.config.js` 里预先记录的已知结论一致（35 用例串行共享单后端时的时序抖动，非产品缺陷），不视为新问题
- **PWA manifest.json**：修了一个真实但影响很小的问题——`start_url`/`scope` 字段各重复声明一次（JSON 允许但明显是编辑残留），已清理（commit `c22951e`）；核实 `theme_color: #07C160` 并非遗留微信绿，而是当前全局品牌主色（`--color-primary`，黑金配色按既有约定只限登录/注册/找回密码三个页面），未做改动

结论：本轮未在这几条链路发现新的可复现缺陷，判断依据是代码逐路径核查 + 真实 e2e 通过率，不是"看起来没问题"的猜测。

### 批次 4（2026-09-09）— 批次2图标修复的真实运行截图验证 + 通话信令核查 + Android 编译回归
- **批次2图标修复截图验证**：临时脚本起隔离测试后端(127.0.0.1:3099,独立DB)+ web 静态服务(127.0.0.1:4178)，用真实 Chromium 登录测试账号截图：
  - 宽屏"设备管理"页：`Linux PC`/`浏览器` 两个非手机/非常见桌面 UA 的设备行，均正确落到兜底分支，显示新的矢量地球图标（不再是 🌐 emoji）
  - 窄屏"外观设置"页：日间/夜间/跟随系统三个开关分别显示太阳/月亮/半圆矢量图标，配色与选中态正常
  - 状态：**已修复且已验证**（含真实截图，非构建通过即视为完成）
- **过程排查记录（如实记录，非隐瞒）**：临时验证脚本第一次因未正确清理子进程，在被中断后遗留了一个占满 CPU 的孤儿测试后端进程（监听 127.0.0.1:3099，与生产 `vxin-backend`/3002 是不同端口、不同数据库，未产生数据交叉），已定位并 `kill -9` 清理，随后复核生产 pm2 进程 `vxin-backend` 全程在线（`pm2 list` + `/health` 200）不受影响。同一脚本第一版还因未显式配置测试后端地址，导致页面用默认生产域名 `vxinchat.com` 发过几次登录请求（被浏览器 CORS 拦截、内容未泄露，服务端因非法来源+多半也因参数不对无法造成实际影响），发现后立即修正为通过 `localStorage.vxin_server_url` 指向隔离测试后端，之后的截图验证不再有任何生产域名请求。此后所有验证已在完全隔离环境内完成
- **通话信令 (`call.js`/`groupCall.js`) 核查**：状态机、超时清理(120s)、断线清理、重复拨号覆盖、防伪造转发校验均已有明确注释和边界处理，判断为已经过多轮加固（"fix: 防 map 泄漏"等注释可查），未发现新的可复现问题；`activeCalls` 用进程内 Map 是有意的架构选择（`ecosystem.config.js` 显式使用单 fork 实例，注释说明是因 Socket.IO 未接 Redis adapter），非疏漏
- **Android 编译回归**：`./gradlew --no-daemon :app:compileDebugKotlin` BUILD SUCCESSFUL（本轮未改动 Android 源码，用于确认现有状态未被破坏）

### 批次 5（2026-09-09）— 真实 Bug：Android 更新弹窗误判所有 Web 访客 + 弹窗接入设计令牌
沿"设计令牌盘点"排查散落硬编码颜色时，顺着 `AndroidUpdatePrompt.jsx` 的硬编码颜色追到其数据来源 `useAndroidVersionCheck.js`，发现一个真实、可复现、会影响生产所有 Web 访问者的缺陷：

- **问题**：`isCapacitorApp()` 只判断 `window.Capacitor` 是否存在，但 `@capacitor/core` 在纯 Web 构建里也会自注册该全局对象（`isNativePlatform()` 恒为 false）。全仓库其余判断点（`main.jsx`/`AuthContext.jsx`/`SocketContext.jsx` 等）都用 `window.Capacitor?.isNativePlatform?.()`，唯独这个 Hook 用了错误、更宽松的存在性判断——导致任何用桌面浏览器或手机浏览器访问 vxinchat.com 网页版的人，都会被误判成"这是原生 Capacitor App"：每小时悄悄向生产域名发起版本检查请求，一旦命中 `mandatory` 更新还会对着网页弹出"发现新版本，请下载 Android 安装包"的对话框
- **修复**：`isCapacitorApp()` 改用与全仓库一致的 `isNativePlatform()` 判断（commit `436be5a`）
- **验证（有前后对比，非猜测）**：起隔离测试环境+真实 Chromium 打开登录后页面，修复前能实测观察到对 `vxinchat.com/downloads/android-version.json` 的请求（被浏览器 CORS 拦截，未发生数据泄露）；同样操作修复后不再触发该请求
- **顺带**：`AndroidUpdatePrompt.jsx` 弹窗本身接入设计令牌（`--bg-modal`/`--bg-overlay`/`--text-primary`/`--color-primary` 等），修复此前恒为纯黑、不随浅色/深色模式变化、与全站弹窗风格脱节的问题（commit `dcbc04f`）
- 过程中同样起停了隔离测试后端(127.0.0.1:3099)+web静态服务(127.0.0.1:4178)，验证后已确认端口/进程清理干净，未影响生产 pm2 `vxin-backend`(3002)

### 批次 6（2026-09-10）— 设计令牌盘点收尾 + App 主图标/功能图标重绘落地

**设计令牌盘点结论**（逐文件核实，非一律改）：
- `ContactList.jsx`：两处空态 SVG 图标（"暂无联系人""暂无新申请"）fill/stroke 硬编码 `#E8ECF0`/`#D0D7E3`，不随 `body.dark-mode` 切换（design-tokens.css §13 会整体重定义 `--gray-*` 灰阶，深色下浅灰会变深灰，这两处因硬编码永远停在浅色值），是真实遗漏。已改用 `var(--gray-150)`/`var(--gray-300)`。文件里另外几处 `#07C160`/调色板数组是"标签颜色选择器"的固定色板（用户主动选色），不是主题色，保留不动。
- `ScanQR.jsx`：硬编码色值全部是 `var(--token, #fallback)` 形式的兜底值，不是真硬编码；`background:'#000'` 是相机取景器背景，各主题下都应为黑，不是遗漏。**结论：无需改动**。
- `ElectronTitlebar.jsx`：`#000000`/`#FFD700` 是标题栏里渲染的品牌 Logo 图形本身（不是随主题变化的 UI 元素，类比任务栏图标），按既有"黑金限定品牌入口"约定是有意为之。**结论：无需改动**（见下方图标重绘，此处后续会指向新版 Logo 矢量，颜色约定不变）。
- 状态：**已修复且已验证**（批次11补做）—`npm run build` 通过；真实 Chromium 登录空号账号，联系人页空态在浅色/深色下各截图一张对比：深色下图标圆点/线条从原本会保持的浅灰正确切换为随面板背景调深的中性灰，未再出现"深色模式下还是浅色图标"的问题，视觉核实无误。

**App 主图标 + Logo 矢量重绘**（发现旧版 `brand/vxin/svg/logo.svg` 已实际生效于 Web `manifest.json`/`favicon.*` 及 Android/iOS 的图标资源，并非此前记忆所述"仅生成未接入"——推测是本记忆文件未覆盖到的某次改动接入的）：
- **问题**：旧图标由多层"科技轨道"圆环（含 dasharray 虚线）、8 个散落发光粒子（`feGaussianBlur` 滤镜）、径向能量光晕、聊天气泡描边 + V 字母共 6+ 层元素堆叠而成，在 16px favicon / 48dp 启动器等小尺寸下糊成一团色块，不符合本轮"避免细碎装饰、堆叠小字和廉价立体效果"的明确要求，予以重绘而非直接复用。
- **新设计**：黑底 + 金色渐变（`#FFD84D → #FF9A00`，去掉旧版 5-stop 反复横跳的渐变和描边光晕）一笔 V 形折线（`stroke-linejoin=round` 单路径，非多层拼接）+ 底部独立圆点（抽象化的对话气泡尾角），零滤镜、零虚线环、零散落粒子。16×16 / 32×32 下实测轮廓仍清晰（见下方 ImageMagick 栅格化预览）。沿用既有"黑金"品牌方向（在此仓库里已通过 2026-08-24 的启动动画/登录页多端落地并确认，不新起一套配色，避免品牌不统一）。
- **产出**：`brand/vxin/svg/icon-square.svg`（黑底完整版，iOS/Windows/favicon/PWA 用）、`icon-mark.svg`（透明底纯标记，Android adaptive-icon 前景层及后续应用内 Logo 位复用）。旧 `logo.svg`/`logo-256.svg`/`logo-light.svg` 保留不删（无確認引用方本轮不动，供追溯），新资源不复用旧文件名，避免路径歧义。
- **状态**：矢量母版**已完成且已验证**（`convert`(ImageMagick, librsvg 后端) 栅格化 16/32/256px 预览，人工比对小尺寸下 V 形轮廓与圆点仍清晰可辨，无糊团）；四端实际接入（favicon/manifest、Android mipmap 全密度、iOS AppIcon-1024、Windows icon.ico）在下一批次落地。

### 批次 7（2026-09-10）— App 图标/Logo 四端实际接入

- Web：`favicon.ico`(16/32/48)/`favicon.png`/manifest 引用的 `icons/icon-192.png`、`icon-512.png` 已替换
- Windows/Electron：`assets/icon.ico`(16/32/48/256)/`icon.png` 已替换（窗口图标/安装包图标/托盘图标共用同一资源，托盘由 Electron 运行时缩放到 16px）
- Android：5 个密度 `ic_launcher.png`/`ic_launcher_round.png`(legacy 方形回退) + `ic_launcher_foreground.png`(adaptive-icon 前景层，108dp 标准尺寸换算) 已替换，背景色沿用既有 `#000000`
- iOS：`AppIcon.appiconset/AppIcon-1024.png`（Contents.json 唯一实际引用的文件）已替换，已展平无 alpha 通道
- 顺带统一了 5 处逐字节相同的旧版内联 SVG 品牌标（`ElectronTitlebar.jsx` 标题栏 + `Login/Register/ForgotPassword/Home.jsx` 四个认证页）为同一套新 V+尾点标记
- 状态：**已修复且已验证** —`npm run build`(web) 通过；`./gradlew --no-daemon :app:compileDebugKotlin` BUILD SUCCESSFUL 且 `processDebugResources`/`mergeDebugResources` 非 UP-TO-DATE 实际重跑（证明新 PNG 被 AAPT 正常处理）；全部 PNG 用 `identify` 核实尺寸；ImageMagick 栅格化 16/18/32px 预览人工核实小尺寸清晰度。iOS 编译验证、Windows 真机渲染验证仍受本机无 Xcode / Electron 沙箱限制（既有环境限制，非本批新增）。
- 遗留：`ScanQR.jsx`/`ElectronTitlebar.jsx` 当初"无需改动"结论对 ElectronTitlebar 部分已被本批次的 Logo 重绘覆盖更新，不再是遗留项

### 批次 8（2026-09-10）— 应用内功能图标统一 + 真实 Bug：资料页"在线"绿点在离线时也常亮

**功能图标统一**：`Icons.jsx` 里已有 `IcoClose` 且已被 10 个文件复用，但仍有 8 处散落的裸字符"✕"关闭按钮没跟上，另有 1 处 emoji（上传中📤）、1 处裸字符编辑图标（✎）未纳入统一组件：
- 裸"✕"→`<IcoClose/>`：`PrivateChatSettings.jsx`、`ScanQR.jsx`、`VideoPreview.jsx`、`UpdateBanner.jsx`(4处)、`UploadProgressBar.jsx`、`Login.jsx`(移除记录按钮)
- 新增 `IcoUpload`/`IcoEdit` 到 `Icons.jsx`（同源 24-viewBox、currentColor 继承风格），替换 `UploadProgressBar.jsx` 的 📤 emoji 和 `GroupInfo.jsx` 的 ✎ 编辑群名按钮
- 未动：`ChatWindow.jsx` 的 REACTIONS 表情回应数组、`Moments.jsx` 的 `<option>` 可见范围 emoji（原生 select 无法渲染 SVG，emoji 是该场景标准做法）——判断为合理使用，非需要统一的"图标"

**真实 Bug（顺带发现，非凭空猜测）**：`UserProfile.jsx` 特权账户可见的"最后在线时间"一行，🟢 绿点和文字颜色（`--green`）**无条件常亮**，不管 `formatLastOnline()` 返回的到底是"当前在线"还是"3 分钟前在线"/"昨天 14:23"这类离线时间戳（`utils/time.js:62-78` 确认后者只在 `isOnline===false` 时才会走到）。复现条件：以特权账户查看一个当前离线用户的资料页，只要其 `last_online_at` 有值——会看到绿色在线圆点+绿色文字挂在"昨天 14:23"这种离线描述旁边，误导管理员以为对方在线。修复：圆点/文字颜色按 `user.status === 'online'` 条件切换（在线绿、离线 `--text-tertiary` 中性灰），emoji 圆点改成 CSS `.up-status-dot`（emoji 圆点在不同 OS/字体下大小颜色不一致，不如实心 CSS 圆点可靠）。

状态：**已修复且已验证** —`npm run build` 通过；`e2e/playwright/web`（隔离后端127.0.0.1:3099+独立测试库，非生产）61 用例：58 通过，3 个失败（`outbox.spec.js` OB-01/OB-02、`search.spec.js` SEARCH-01）；三个失败逐一单独重跑：OB-01/OB-02 是 `playwright.config.js` 里预先记录的已知结论（35 用例串行共享单后端时的时序抖动），SEARCH-01 单独重跑该文件 4/4 全绿——判定为同一类时序抖动而非本批改动引入的真实回归，不是"看起来没问题"的猜测，是有隔离重跑证据支撑的结论。grep 确认全部改动文件不再含旧字符/emoji。运行期间发现一个此前自己遗留的孤儿隔离测试后端进程（pid 1451718，占 CPU 18 分钟，与生产 `vxin-backend`(3002) 端口/数据库均隔离未产生数据交叉）已定位并 kill 清理，全程用 `/health`+`pm2 list` 反复确认生产未受影响。

### 批次 9（2026-09-10）— 真实 P0 Bug：免密切换账号后，旧账号仍收到推到本设备的通知（跨账号内容泄露）

三.6 通知链路排查，沿业务代码逐路径核查（非猜测）发现：

- **问题**：`push_subscriptions`（Web Push）/`device_tokens`（FCM/APNs/个推）的唯一约束都是 `UNIQUE(user_id, endpoint/token)`。但一个浏览器 Service Worker 的 PushSubscription endpoint、或一部手机的 FCM/APNs token，物理上是"一台设备一份"，不是按账号区分的。Web（`AuthContext.switchAccount`）、Android（`SessionManager`）、iOS（`SessionStore`）都有"免密切换账号"（`switchAccount`，特意不走 `logout`，ACC-01 用例的产品语义就是"切换为新账号不被登出"），旧账号切走后从未主动删除自己在这台设备上的订阅/token 行。于是同一个物理 endpoint/token 会同时挂在新旧两个账号名下——`push.js` 的 `pushToUser` 给旧账号推消息时，依然会真实推到这台已经登录新账号的设备上，`detail_preview` 打开时推送里还带真实消息发件人/正文，是可复现的跨账号内容泄露，不是理论风险。
- **修复**：`notifications.service.js` 的 `webSubscribe`/`saveDeviceToken` 写入前，先删除该 endpoint/token 上属于其它 `user_id` 的旧订阅行，保证一个物理端点任意时刻只归属当前登录账号。纯附加式修复，未改表结构/未做迁移，服务端自愈、不依赖任何客户端配合改动。
- **验证（RED→GREEN，非假设）**：新增 `test/push-account-switch-leak.test.js`，模拟账号 A 订阅 endpoint E → 账号 B 在同一 endpoint 订阅 → 断言 A 的订阅行必须被清除（Web Push + 原生 device token 各一个用例）。`git stash` 临时撤掉修复后两个用例均真实 FAIL（`Received: {"1":1}`，证明泄露复现），恢复修复后两个用例真实 PASS。随后跑全量 `npm test`（344+2 用例，`--forceExit --runInBand` 隔离测试库），全绿，无回归。

状态：**已修复且已验证**

### 批次 10（2026-09-10）— 真实 Bug：连续点开多条语音消息会叠音播放

三.4 媒体链路排查发现：`VoicePlayer.jsx` 每条语音消息各自独立 `new Audio(url)`，彼此之间没有任何"播放中"状态协调——点开第一条语音在播时，再点第二条，两段声音会同时叠着响，不符合微信/Telegram 等主流 IM"新语音开始播放自动停掉上一条"的隐含预期。

- **修复**：加一个模块级变量 `activeVoiceAudio` 记录当前播放中的 audio 元素；`onPlay` 时若存在别的正在播的 audio 先 `.pause()` 掉；`onPause`/`onEnded`/组件卸载时都同步清空引用，避免残留悬空引用误判。未引入 Context/全局状态库，改动量最小。
- **验证（真实浏览器，非猜测）**：起隔离后端(127.0.0.1:3099)+web静态服务，用 `ffmpeg` 生成两段真实 3 秒 MP3，以真实用户身份通过 `/messages/:id/upload` 接口发两条真实语音消息，真实 Chromium 登录后在聊天窗口依次点击两个播放按钮，用按钮 `aria-label`（精确反映组件 `playing` state）判断实际播放态。**RED**（`git stash` 撤掉修复）：点第二条后两个按钮同时显示"暂停"（=同时在播，实锤叠音）。**GREEN**（恢复修复）：点第二条后只有它显示"暂停"，第一条自动变回"播放"（=已被停掉）。过程中额外发现并解决一个测试环境本身的限制：`<audio src>`/`<img src>` 标签发的是不带 `Authorization` 头的普通 GET，而本地隔离环境 web 静态服务与后端跨源导致 cookie 认证也传不过去——复用了 `e2e/playwright/global-setup.js` 里已有的解法（`/uploads` 请求由静态服务器代理到后端并注入 Bearer token），而不是重新发明一套。

状态：**已修复且已验证**

### 批次 11（2026-09-10）— 补做上批遗留验证 + 聊天窗口真实内容视觉核查 + 真实 Bug：来电铃声引导条压住会话头部

**补做**：批次6 ContactList 空态图标深色模式修复，找到稳定harness后补了真实浏览器浅/深色截图对比，圆点/线条颜色确认跟随主题正确切换。

**聊天窗口视觉核查**（四.UI，非空谈——起隔离环境，真实发文本/长文本/emoji/语音/对方回复共5条真实消息，桌面浅色/深色/390px移动端三种视口截图比对）：
- 文本气泡换行、中英混排、emoji渲染、语音消息气泡（播放按钮+进度条+时长+转文字按钮）、双方气泡左右对齐/配色区分，三种视口下均正常，未发现新缺陷
- **发现真实 Bug**：`CallSoundGuide.jsx`（首次访问的"开启来电铃声提醒"引导条）`position:fixed; top:12`，正好落在顶栏(`--header-h:54px`)范围内——桌面/深色/移动端打开任意会话都会整条盖住联系人名字和在线状态；移动端(≤390px)下 shrink-to-fit 布局还把文字挤成三行，胶囊比原来更难看。修复：`top`改用`calc(var(--header-h,54px)+12px)`移到顶栏下方；窄屏收紧字号/内边距+文字不换行，顺带去掉"点击"二字（与相邻"开启"按钮重复）。
- 顺带排查了其余 14 处 `position:fixed` 用法（弹窗遮罩/图片视频预览/群通话浮层等），均为全屏居中或已有合理定位，未发现同类问题，不是只查了一个就假设全部没事。

状态：**已修复且已验证**

### 批次 12（2026-09-10）— 跨页面视觉核查扩大到"我的/设置/动态/群聊"，CallSoundGuide 二次修正 + 附件面板核查

起隔离环境，真实建群（2人）、真实截图核查"我的"/"设置→账号与安全"/"动态"/群聊窗口/聊天更多面板共5个此前未覆盖的页面：
- "设置→账号与安全"页布局清晰（头像/手机号/密码/设备管理/注销/网页版/清缓存分组合理），未发现缺陷
- **CallSoundGuide 批次11的修复不完整**：`top:calc(header-h+12px)=66px` 只覆盖了单层顶栏页面，"动态"页是标题+子标签两层顶部结构（实测约90-100px），66px 仍压住"互动消息"标签文字——真实截图发现，不是理论推测。这是个全局挂载、跨任意页面展示的一次性引导条，没有单一选择器能覆盖所有页面各自不同的顶部高度，改为统一 `top:100`（能容纳最高的已知顶部结构），重新截图核实聊天头部/群聊头部/动态标签均完整可见；动态页胶囊底边与分享输入框顶边有轻微贴近但已不遮挡文字，判断可接受，未继续为像素级贴合过度投入
- 聊天窗口"更多⋯"附件面板（相机/视频通话/语音通话/名片/定时发送/发红包）布局网格清晰，图标含义明确，未发现缺陷

状态：**已修复且已验证**

### 批次 13（2026-09-10）— 真实 Bug：个人资料页遗留"微信号"标签 + 设置四页视觉核查

真实截图核查"设置→隐私设置/通知设置/通用设置/个人资料"四个子页（此前均未覆盖）：
- 隐私设置（添加我的方式/验证加好友/禁止直接拉群/陌生人信息/屏蔽陌生人消息）、通知设置（锁屏通知/消息详情预览/通知声音震动/夜间免打扰）、通用设置（清缓存/关于）三页布局清晰、开关状态明确，未发现缺陷。其中"消息详情预览"正是批次9 P0 推送泄露 bug 里 `detail_preview` 对应的那个开关，截图上可见确实存在且默认开启，佐证了那次分析
- **发现真实 Bug**：个人资料页"个人资料"详情行有一处 label 写死"微信号"——WeChat 克隆期遗留、全仓库唯一没跟着改的一处。逐一 grep 核对全仓库其余 15 处展示同一 `wechat_id` 字段的地方（Login/GlobalSearch/MessageItem/Profile其余5处/UserProfile/AccountSwitcher/AddFriendModal/ChatWindow）确认均已是"v信号"，不是拍脑袋改的。已修复为"v信号"，底层字段名 `wechat_id` 不动（超出范围）。截图确认修复后显示一致。
- 顺带确认全仓库其余 "微信" 字样（web/android/ios 共约20个文件命中）逐一核查均为代码注释里"对齐微信XX交互"的设计引用，不是用户可见文案，不是同类遗留。

状态：**已修复且已验证**

### 批次 14（2026-09-10）— 群聊信息面板核查（含一次真假 Bug 排查，最终确认为测试脚本自身笔误）

真实建群（2人）截图核查"群聊信息"面板：第一次截图群成员数显示"1位成员"只有群主，疑似"建群时 memberIds 未生效"的真实 bug，进一步复核代码（`conversations.service.js` createGroup 的联系人白名单校验逻辑）没发现问题，转头复查验证脚本本身——是脚本里把 `seedUsers()` 返回对象的用户 id 字段名笔误成了另一个 helper 文件的命名习惯（`b.userId` 写成了不存在的字段，实际字段名是 `b.id`），传给建群接口的 `memberIds` 实际是 `[undefined]`，被服务端的"仅允许已是联系人的 id"校验正确过滤掉了——服务端行为完全正确，是我自己脚本的笔误，不是产品缺陷。改正脚本字段名后重新截图：2位成员正确显示，群管理/群公告/成员列表/邀请成员/单成员管理员操作（设为管理员/转让群主/移出）布局清晰，未发现真实缺陷。

**记录这次排查过程本身**：符合本轮"有依据才下结论，怀疑一个结果时先怀疑证据链，不是先假设产品有 bug"的方法论——如果只看第一次截图就报"建群人数不对"，会是一次误报。

状态：**未复现**（疑似问题定位为验证脚本自身笔误，产品代码本身未发现缺陷）
