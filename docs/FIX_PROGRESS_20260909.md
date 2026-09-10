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
- 状态：**已修改但待验证** —`npm run build` 通过；真实浏览器点前后对比因本轮 e2e 隔离环境反复启动失败（未知原因卡死在登录流程，非产品代码问题，已定位到是本次臨時脚本自身的 harness 问题而非后端/前端 bug，多次重试后放弃在本批次内解决，避免在一个纯 CSS 变量替换上过度消耗）而未能截图闭环；改动本身是把两个失效硬编码色值换成同文件同类兜底样式已在用的既有 token，改动风险低，且 `--gray-150`/`--gray-300` 在 light/dark 两个作用域均有定义，机制上不会出现未定义变量。留待下一次真实浏览器验证批次一并截图确认。

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

## 下一批计划
- 批次6"已修改但待验证"项（ContactList 空态图标深色模式）+ 本批次图标视觉效果，一并找一次能跑通的真实浏览器 e2e 环境截图确认（此前两次隔离环境脚本因未知原因卡在登录流程，已放弃在单次任务上过度重试，留给下次批次一起处理，会先排查是不是隔离后端/前端启动时序本身的问题而不是重复相同命令）
- 应用内功能图标（导航/发送/语音/更多等）统一梳理与图标组件化——本轮"App 主图标"已完成，"应用内功能图标统一"（五.2）尚未开始
- 继续账号安全/消息/好友群聊/媒体/通话六大类的逐链路 Bug 排查（三.4 媒体、三.5 通话、三.6 通知与生命周期尚未系统过一遍，批次3只覆盖了三.1-三.3 部分）
- iOS 原生代码仍受本机无 Xcode 限制，无法编译验证（沿用既往记忆中的环境限制结论）
