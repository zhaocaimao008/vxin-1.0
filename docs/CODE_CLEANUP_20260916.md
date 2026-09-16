# 冗余代码清理与上传（2026-09-16）

清理基线为 `62c7035`。先核对 Git 远程、构建入口、AST 引用关系、字符串路径、测试引用和部署脚本，再删除确认没有使用者的文件。清理可从 Git 历史恢复。

## 清理结果

| 范围 | 清理内容 |
| --- | --- |
| Web 源码 | 12 个未使用组件、Hook、工具文件；现有页面与动态 import 路由不变 |
| 后端源码 | 37 个未加载模块：未挂载的 P14 路由及实验实现、13 个 P10 实验模块、旧通知路由、重复指标/缓存/限流等工具 |
| 旧配置与备份 | 未使用的 `web/vite.config.enhanced.js`、`web/.index.html.bak1` |
| 桌面重复 manifest | 删除 `desktop-electron/src/package.json`；版本和构建统一读取 `desktop-electron/package.json`，同步去除文档中的重复版本数字 |
| 依赖 | 删除 `esbuild`、`timeago.js`、`vite-plugin-singlefile`、`workbox-webpack-plugin`、`workbox-window` 五项无调用的直接依赖；清除未使用的 timeago 分包规则 |
| 构建压缩器 | 原先由废弃依赖间接带入的 Terser 改为显式开发依赖，固定原版本 `5.50.0`，避免干净安装后构建失败 |
| 防止回流 | `.gitignore` 补充编号备份文件规则 |

合计删除 **52 个文件、6335 行源码/配置/备份内容**。锁文件依赖记录净减少 **214 项**，剩余依赖没有版本升级。删除项的静态导入者均不存在，或也在本次删除的封闭模块组中。

运行时 `worker_threads` 动态加载的数据库 Worker、被现有测试使用的辅助模块、原生客户端、独立部署服务和仍有 npm 构建入口的实现均保留。静态扫描不把“没有普通 import”直接等同于无用，也不删测试以减少测试数量。

## 本地验证

| 检查 | 结果 |
| --- | --- |
| 干净依赖安装 | `npm ci --legacy-peer-deps` 成功，已验证新的锁文件 |
| Web 构建一致性 | 清理前后 70 个 JS/CSS/HTML/JSON 构建文件逐个 SHA256 比较，文件集合和内容完全相同 |
| Web | 121/121 单测通过；ESLint 零警告；Capacitor 版本和模板检查通过 |
| 后端 | 114/114 源码语法检查；53 套测试通过，350 passed、1 skipped、2 todo；覆盖率门槛通过 |
| 桌面与回滚 | 12/12 网络及发布回滚测试通过 |
| Electron 44 | 7/7 实际运行测试通过，覆盖服务器检测、文档、登录、发消息、刷新和导航 |
| 桌面构建 | desktop 模式 Web 构建及 Linux unpacked 打包成功 |
| 引用复查 | 清理后 AST 扫描无解析错误；剩余静态不可达项已逐项确认为动态入口或测试依赖 |

测试使用隔离数据库、账号和端口。后端覆盖率比例因删除未使用文件改变，不能将分母变小写成新增测试覆盖。原有 Web 中危依赖和跳过/待实现测试仍保留实际记录，详情见 [上一轮复查](RECHECK_20260916.md)。

本地证据位于 `/home/ubuntu/vxin-cleanup-20260916/`。云端验证结果见本提交触发的 CI、端到端测试和自动部署运行。

## 删除文件清单

- `web/src/components/AuthImage.jsx`
- `web/src/components/ConvListSkeleton.jsx`
- `web/src/components/IconButton.jsx`
- `web/src/hooks/useChatScroll.js`
- `web/src/hooks/useConversationList.js`
- `web/src/hooks/useGroupData.js`
- `web/src/hooks/useOverlayManager.js`
- `web/src/hooks/useProfileData.js`
- `web/src/utils/dataManipulation.js`
- `web/src/utils/highlight.jsx`
- `web/src/utils/requestOptimizer.js`
- `web/src/utils/sanitize.js`
- `backend-v2/src/middleware/metrics.js`
- `backend-v2/src/modules/notifications/notificationRoutes.js`
- `backend-v2/src/modules/notifications/notificationTemplate.js`
- `backend-v2/src/routes/p14-deep-optimization.routes.js`
- `backend-v2/src/utils/collaborationEngine.js`
- `backend-v2/src/utils/contentModerator.js`
- `backend-v2/src/utils/dataMask.js`
- `backend-v2/src/utils/encryptionManager.js`
- `backend-v2/src/utils/inputValidator.js`
- `backend-v2/src/utils/offlineFirstSync.js`
- `backend-v2/src/utils/optimization-p10/alertingSystem.js`
- `backend-v2/src/utils/optimization-p10/authenticationEnhanced.js`
- `backend-v2/src/utils/optimization-p10/backupRecoveryAutomation.js`
- `backend-v2/src/utils/optimization-p10/chaosEngineeringKit.js`
- `backend-v2/src/utils/optimization-p10/concurrencyControl.js`
- `backend-v2/src/utils/optimization-p10/errorHandlingGlobal.js`
- `backend-v2/src/utils/optimization-p10/healthCheckFramework.js`
- `backend-v2/src/utils/optimization-p10/indexRecommendationSystem.js`
- `backend-v2/src/utils/optimization-p10/loadTestingFramework.js`
- `backend-v2/src/utils/optimization-p10/metricsEnhanced.js`
- `backend-v2/src/utils/optimization-p10/networkOptimization.js`
- `backend-v2/src/utils/optimization-p10/raceConditionAnalyzer.js`
- `backend-v2/src/utils/optimization-p10/structuredLogging.js`
- `backend-v2/src/utils/optimization-p14/async/asyncOrchestrator.js`
- `backend-v2/src/utils/optimization-p14/caching/multiLayerCache.js`
- `backend-v2/src/utils/optimization-p14/cost/costOptimizer.js`
- `backend-v2/src/utils/optimization-p14/disaster/disasterRecovery.js`
- `backend-v2/src/utils/optimization-p14/frontend/offlinePWA.js`
- `backend-v2/src/utils/optimization-p14/monitoring/finegrainedMetrics.js`
- `backend-v2/src/utils/optimization-p14/observability/distributedTracing.js`
- `backend-v2/src/utils/optimization-p14/security/securityHardening.js`
- `backend-v2/src/utils/ossUpload.js`
- `backend-v2/src/utils/performanceMonitor.js`
- `backend-v2/src/utils/postgresqlMigrationManager.js`
- `backend-v2/src/utils/rateLimiter.js`
- `backend-v2/src/utils/recommendationEngine.js`
- `backend-v2/src/utils/redisCache.js`
- `web/.index.html.bak1`
- `web/vite.config.enhanced.js`
- `desktop-electron/src/package.json`
