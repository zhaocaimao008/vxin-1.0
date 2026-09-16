# 待办收尾与发布验收（2026-09-16）

后续复查及更新版本见 [再次全量复查](RECHECK_20260916.md)。本文保留上一轮的实际验收记录。

本轮接续 `FULL_REVIEW_20260916.md` 和 `FIX_NAVIGATION_20260916.md`，处理其中的代码、工具链、测试和发布待办。先前报告中的“未发布”“原生端未修复”等是当时状态，本文记录该轮完成时的验收结果；后续更新见页首链接。测试均使用隔离数据；未向真实联系人发送测试消息。

## 完成的修复

- **Android/iOS 账号隔离**：草稿、待发箱、消息缓存按服务器和账号隔离；旧账号异步响应、登录结果和发送确认不能修改新会话。重发核对发送者与会话，退出清理对应存储，凭据按服务器保存。
- **原生构建**：补齐本地 Android JDK/SDK，修复云端过时 SDK 安装参数；Android 运行单测、模拟器安装启动和签名校验，iOS 运行 XCTest、模拟器构建与启动。恢复已失效的 iOS 发布签名，修正归档和 IPA 导出使用的描述文件。
- **桌面端**：显式选择 HTTP 服务器时功能请求正常，更新源仍要求 HTTPS。测试入口等待真实主窗口，实际启动 Electron 验证登录、发消息、刷新和导航。生成 Windows 安装包和 macOS 包。
- **Web 功能与界面**：保留并合入生产服务器上两个尚未推送的提交；进一步修复联系人旧缓存回填、成功登录误触发封禁、非默认端口跳转丢失端口。之前的页面恢复、草稿、私密图片缓存、搜索竞态、主题和文字对比度修复全部纳入回归。
- **通话**：新增双浏览器真实音频/视频传输验收，并强制经过独立 coturn；断言 RTP 字节、视频解码帧、静音与挂断释放，排除仅测试信令的假通过。
- **部署与回滚**：Docker 改为当前 backend-v2 + Redis + Nginx；实际构建并启动。生产发布先隔离构建，失败恢复源码、依赖与 Web；检查实际运行 commit，拒绝覆盖未合入的生产提交。修复 rsync 同大小同时间文件误跳过，补齐首次 Web Push 密钥初始化。
- **依赖与发布**：修复高危/严重依赖项，升级 Vitest，保留 Capacitor CLI 的 tar 兼容性并实际验证模板解压。各端版本递增；Android 下载目录、更新清单和安装包签名/哈希一致，Windows 更新清单和安装包一致。
- **官网和生产附件路由**：官网更新 Android/Windows 下载和动态二维码，修复浅色区块文字不可读、下载卡片排列以及无效页脚入口。官网发布迁移至现有 runner，保留 app/config 和旧哈希资源。生产 Nginx 原直接暴露上传目录并缓存 30 天，现改为经后端鉴权转发、禁止缓存；只修改 vxinchat.com 对应区块，保持其它站点配置。发布机残留旧 Windows 安装包被完整性检查拦截，改为每次独立目录并按清单精确选包。
- **文档与测试真实性**：更新 BUILD、VERSIONING、CAPABILITIES；将两项未实现的基础设施恒真测试改为明确待实现，历史报告不再作为真实能力证明。

## 已完成的自验证

| 项目 | 结果 | 证据/范围 |
| --- | --- | --- |
| Web 单元测试 | 96/96，11 套 | `web-unit-release.log` |
| Web E2E | 70/70 | 含双端音视频与强制 TURN；[云端运行](https://github.com/zhaocaimao008/vxin-1.0/actions/runs/35075238045) |
| 页面导航 | 77/77 | 手机与桌面、资源加载失败恢复；`navigation/baseline-pages.json` |
| UI | 50/50，0 页面 JS 异常 | 5 尺寸 × 2 主题 × 5 视图；`ui-final/closure-inspection.json` |
| 联系人缓存 | 通过 | 接受好友后刷新仍存在，换账号不串联系人；真实浏览器 HTTP 缓存开启 |
| 私密媒体与草稿 | 通过 | 登录可读图片，退出后浏览器与匿名请求均 401；切页/刷新草稿恢复 |
| 后端 | 53 套，348 通过、1 跳过、2 待实现 | 覆盖率门槛通过：语句 43.38%、分支 31.52%、函数 35.73%、行 46.20% |
| 后端语法 | 151/151 | 已加入测试前置检查 |
| 发布与桌面网络单测 | 11/11 | 安装失败、重启失败、错误健康状态/版本均回滚；HTTP 请求边界 |
| Electron 实际运行 | 4/4 | Linux/Xvfb，实际主窗口；`electron-e2e.log` |
| Android | 13/13 单测，模拟器安装启动、签名 APK 构建通过 | [模拟器运行](https://github.com/zhaocaimao008/vxin-1.0/actions/runs/35075030990)、[签名构建](https://github.com/zhaocaimao008/vxin-1.0/actions/runs/35075042116) |
| iOS | 18/18 XCTest，模拟器构建/启动通过 | [运行](https://github.com/zhaocaimao008/vxin-1.0/actions/runs/35075034548) |
| Windows / macOS | 安装包构建通过 | [运行](https://github.com/zhaocaimao008/vxin-1.0/actions/runs/35075038071)，macOS 未签名 |
| Docker 最终镜像 | 构建、服务健康、页面 200、匿名媒体 401 | `docker-final-rebuild.log`；非默认端口 18400 跳转保持端口 |
| Lint / 安装 / 构建 | 通过 | 干净 npm ci、Web/Electron production 构建、Capacitor 模板解压 |
| Nginx 路由 | 3/3 单测、真实 Nginx 配置检查通过 | 验证仅修改目标站点、重复执行不变、异常配置拒绝；生产失败自动还原，最终匿名请求 401 / no-store |
| 官网 | 16 个区块/尺寸组合通过，生产手机/桌面通过 | 无溢出/JS 异常，下载指向当前版本，隐私页 200 |
| npm audit | Web 0 高危/严重，2 中危；后端 0 高危/严重，11 中危 | `web-audit-release.json`、`backend-audit-release.json`，没有将中危称为已消除 |

不同测试之间有重叠，上表不能相加成独立功能数量。本轮 Docker 生产模式下限速抽样 FCP 1.272 秒、登录框可见 2.831 秒、CLS 0、最大长任务 358 ms，仅为本地样本，不能外推真实设备或宣称所有性能问题已消失。

## 发布状态

代码已推送远程 `main`，保留生产原有未推送修复。所有下列结果均为实际运行检查，不是计划。

| 发布项 | 最终结果 |
| --- | --- |
| Web 8.0.15 / 后端 | [生产发布成功](https://github.com/zhaocaimao008/vxin-1.0/actions/runs/35077233428)。公网 `/health` 的 `revision` 和 `/app/release.json` 均为 `b6989878b656607dab403dbf4dd127c67e58a002`，数据库健康；手机/桌面真实浏览器登录页 200、0 JS 异常。 |
| 官网 | [发布成功](https://github.com/zhaocaimao008/vxin-1.0/actions/runs/35078526577)。`/landing-release.json` 为 `f1cb871ac609e998dcae24b7fb4ef17833af143b`；新版链接、配色、布局均在公网核对。 |
| Android 8.0.7 / code 60 | [签名构建和发布成功](https://github.com/zhaocaimao008/vxin-1.0/actions/runs/35077306451)。[下载 APK](https://vxinchat.com/downloads/vxin-android-8.0.7.apk)，重新从公网下载后验证 v2/v3 签名和版本；SHA256 为 `4601dc085456a87e1f7e0720b764d5cd96b4e4fb0ae3e84682928fecf100e5e3`，与更新清单一致。 |
| Windows 8.0.12 | [重试发布成功](https://github.com/zhaocaimao008/vxin-1.0/actions/runs/35078230924)。[下载安装包](https://vxinchat.com/downloads/vxin-8.0.12-setup.exe)，公网下载后校验文件大小和 SHA512 与 `downloads/updates/latest.yml` 一致，blockmap 可访问。 |
| iOS 8.0.3 / build 1789549378 | [签名、校验及 TestFlight 上传成功](https://github.com/zhaocaimao008/vxin-1.0/actions/runs/35076989604)。[Apple API 精确核对该 build 为 VALID](https://github.com/zhaocaimao008/vxin-1.0/actions/runs/35078393051)。本次未提交外部 Beta 审核，不将旧公开测试链接称为新版本已经对外开放。 |
| macOS 8.0.12 | DMG/ZIP 已构建，保存在本机 `macos-release/` 和云端 artifact；未签名、公证或对外更新发布。 |
| 生产附件鉴权 | [配置修改和验证成功](https://github.com/zhaocaimao008/vxin-1.0/actions/runs/35078567939)。修改前 Nginx 使用 static alias，修改后新匿名请求为 401，`Cache-Control: private, no-store`，Cloudflare 为 DYNAMIC。确认后端与 Nginx 指向同一现有上传目录，未迁移/删除用户文件。 |
| Web Push | 缺失 VAPID 密钥已初始化，公网公钥接口返回 200；已有环境文件先按 0600 权限备份。 |
| 最终 CI | [全部门禁通过](https://github.com/zhaocaimao008/vxin-1.0/actions/runs/35078526539)；main 的 [70 项 E2E](https://github.com/zhaocaimao008/vxin-1.0/actions/runs/35077233356)、[Android](https://github.com/zhaocaimao008/vxin-1.0/actions/runs/35077233427)、[iOS](https://github.com/zhaocaimao008/vxin-1.0/actions/runs/35077233483) 也全部通过。 |

后续提交仅修改官网/发布工具和验收文档，因此 Web/API 的生产运行 commit 与官网发布 commit 不同，这是分别发布的实际记录。Android/desktop 版本 tag 保留首次构建来源；Windows tag 运行因旧 artifact 污染被拦截，修正发布流程后从 main 发布同一应用版本，没有强制重写 tag。

## 实际限制

- Windows/macOS 安装后的系统通知、摄像头、自动更新，以及 Android/iOS 双真机、后台推送和跨公网 NAT 的完整矩阵尚无实机验收；模拟器、Linux Electron 和浏览器 TURN 不能替代它们。macOS 产物未签名/公证。
- 生产已配置的 APNs、FCM、个推、TURN 凭据存在不代表实际送达；支付、短信、ASR、S3 外部服务没有完成真实交易或提供商验收，不伪造测试成功。
- 当前未接入消息 E2EE/Signal，也未实现多区域自动故障转移或真实收单支付。这些是独立能力开发，详见 CAPABILITIES，不属于修复即可兑现的现有功能。
- 无归属信息的旧格式草稿不能可靠自动迁移；新版避免串号，不能恢复缺失的归属数据。
- 历史已经缓存或下载的媒体副本无法由此次源站鉴权修复追回；没有 CDN 账户级清缓存凭据，本轮不宣称已清除所有历史边缘缓存。新的鉴权请求和响应缓存策略已在公网验证。
- 仍有上述中危依赖通告、未覆盖代码和启动长任务；本轮修复没有将这些标为零风险。

本机完整日志、截图及构建产物：`/home/ubuntu/vxin-todos-20260916/`。源码分支：`fix/navigation-reliability-20260916`。
