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

## 下一批计划
- 继续设计令牌盘点：`ContactList.jsx`/`ScanQR.jsx`/`ElectronTitlebar.jsx` 里的散落硬编码颜色逐个核实是否也是真实遗漏（部分如 `ElectronTitlebar.jsx` 的黑金配色、`ErrorBoundary.jsx` 的独立硬编码可能是有意为之，需先判断而非一律改）
- iOS 原生代码仍受本机无 Xcode 限制，无法编译验证（沿用既往记忆中的环境限制结论）
