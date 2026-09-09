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

## 下一批计划
- 转向 UI/UX 逐页梳理与统一设计变量整理（当前 `ui-refresh.css` 是唯一全局样式来源，尚未系统盘点是否有遗漏页面/组件）
- 视频/语音通话状态机（重复事件、乱序事件、迟到回调）细读 `call.js`/`groupCall.js`
- Android/iOS 原生代码层面的编译验证（复用既有 `./gradlew` 路径，iOS 仍受本机无 Xcode 限制）
