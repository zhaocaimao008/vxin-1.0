# 待办收尾与发布验收（2026-09-16）

本轮接续 `FULL_REVIEW_20260916.md` 和 `FIX_NAVIGATION_20260916.md`，处理其中的代码、工具链、测试和发布待办。先前报告中的“未发布”“原生端未修复”等是当时状态，以本文为最新验收记录。测试均使用隔离数据；未向真实联系人发送测试消息。

## 完成的修复

- **Android/iOS 账号隔离**：草稿、待发箱、消息缓存按服务器和账号隔离；旧账号异步响应、登录结果和发送确认不能修改新会话。重发核对发送者与会话，退出清理对应存储，凭据按服务器保存。
- **原生构建**：补齐本地 Android JDK/SDK，修复云端过时 SDK 安装参数；Android 运行单测、模拟器安装启动和签名校验，iOS 运行 XCTest、模拟器构建与启动。恢复已失效的 iOS 发布签名，修正归档和 IPA 导出使用的描述文件。
- **桌面端**：显式选择 HTTP 服务器时功能请求正常，更新源仍要求 HTTPS。测试入口等待真实主窗口，实际启动 Electron 验证登录、发消息、刷新和导航。生成 Windows 安装包和 macOS 包。
- **Web 功能与界面**：保留并合入生产服务器上两个尚未推送的提交；进一步修复联系人旧缓存回填、成功登录误触发封禁、非默认端口跳转丢失端口。之前的页面恢复、草稿、私密图片缓存、搜索竞态、主题和文字对比度修复全部纳入回归。
- **通话**：新增双浏览器真实音频/视频传输验收，并强制经过独立 coturn；断言 RTP 字节、视频解码帧、静音与挂断释放，排除仅测试信令的假通过。
- **部署与回滚**：Docker 改为当前 backend-v2 + Redis + Nginx；实际构建并启动。生产发布先隔离构建，失败恢复源码、依赖与 Web；检查实际运行 commit，拒绝覆盖未合入的生产提交。修复 rsync 同大小同时间文件误跳过，补齐首次 Web Push 密钥初始化。
- **依赖与发布**：修复高危/严重依赖项，升级 Vitest，保留 Capacitor CLI 的 tar 兼容性并实际验证模板解压。各端版本递增；Android 下载目录、更新清单和安装包签名/哈希一致，Windows 更新清单和安装包一致。
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
| npm audit | Web 0 高危/严重，2 中危；后端 0 高危/严重，11 中危 | `web-audit-release.json`、`backend-audit-release.json`，没有将中危称为已消除 |

不同测试之间有重叠，上表不能相加成独立功能数量。本轮 Docker 生产模式下限速抽样 FCP 1.272 秒、登录框可见 2.831 秒、CLS 0、最大长任务 358 ms，仅为本地样本，不能外推真实设备或宣称所有性能问题已消失。

## 发布状态

发布验证正在执行，最终记录会在确认生产健康、更新清单和 TestFlight 上传结果后补入。目标版本：Web 8.0.15、Windows 8.0.12、Android 8.0.7 / code 60、iOS 8.0.3。

## 实际限制

- Windows/macOS 安装后的系统通知、摄像头、自动更新，以及 Android/iOS 双真机、后台推送和跨公网 NAT 的完整矩阵尚无实机验收；模拟器、Linux Electron 和浏览器 TURN 不能替代它们。macOS 产物未签名/公证。
- 生产已配置的 APNs、FCM、个推、TURN 凭据存在不代表实际送达；支付、短信、ASR、S3 外部服务没有完成真实交易或提供商验收，不伪造测试成功。
- 当前未接入消息 E2EE/Signal，也未实现多区域自动故障转移或真实收单支付。这些是独立能力开发，详见 CAPABILITIES，不属于修复即可兑现的现有功能。
- 无归属信息的旧格式草稿不能可靠自动迁移；新版避免串号，不能恢复缺失的归属数据。
- 仍有上述中危依赖通告、未覆盖代码和启动长任务；本轮修复没有将这些标为零风险。

本机完整日志、截图及构建产物：`/home/ubuntu/vxin-todos-20260916/`。源码分支：`fix/navigation-reliability-20260916`。
