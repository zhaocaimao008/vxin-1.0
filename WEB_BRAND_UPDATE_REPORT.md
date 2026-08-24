# V信 Web Brand Update Report

审核人：Claude Code（Principal Engineer 角色）
日期：2026-08-24
Commit：`2d53d99`（本地未 push；favicon 相关 `051beb2`/`2ab0ee5` 为同日更早的关联改动）

## 1. 问题定位

登录页左侧品牌区域用的旧 Logo **不是图片文件**，是手写死在 JSX 里的内联 SVG（绿色双聊天气泡，微信同款配色 `#07C160`），且是同一段代码被复制粘贴了 5 处：

| 文件 | 位置 | 尺寸 |
|---|---|---|
| `web/src/pages/Login.jsx` | 页面顶部左上角小角标（`.auth-top-logo-icon`） | 26px |
| `web/src/pages/Login.jsx` | 左侧品牌大面板（`.auth-brand-logo`，截图里那个） | 100px |
| `web/src/pages/Register.jsx` | 左侧品牌大面板 | 100px |
| `web/src/pages/Home.jsx` | Electron 桌面端侧边栏顶部（`isElectron` 分支） | 大图标 |
| `web/src/components/ElectronTitlebar.jsx` | Electron 自绘无边框标题栏图标 | 18px |

这 5 处会一起过时，是因为它们本来就是同一套矢量图手动复制的（ElectronTitlebar.jsx 里原有注释写着"与 EXE/Login/侧栏 Logo 同一套矢量图"）——之前的品牌接入只换了 App 图标文件和 Lottie 启动动画，没碰这段内联 SVG，所以网页端登录页看起来还是老样子。

## 2. 替换方案

没有直接照搬 `brand/vxin/svg/logo.svg`（512×512，用了渐变 + 高斯模糊滤镜 + 多层虚线圆环），原因：
1. 5 处里有小到 18px/26px 的用法，滤镜和细虚线圆环在这个尺寸下基本糊成一团，不可读；
2. Login.jsx 同一个页面里有 2 处同时渲染，若直接照搬会带 2 份重复的 `<linearGradient id="goldGradient">`，重复 id 在 DOM 里是无效 HTML。

改为手绘一版扁平化简版标记：黑色圆角方形气泡 + 金色圆环 + 金色 V。V 字形的坐标是从 `brand/vxin/svg/logo.svg` 里那个 V 的路径按 512→100 的比例精确换算过来的（不是重新设计的形状，是同一个 V 的等比缩小版），保证和主视觉资产是同一个字形。纯色块 + stroke，无渐变无滤镜，各尺寸下都清晰，也不存在 id 冲突问题。

`.auth-brand-logo`/`.auth-brand-icon` 的 `drop-shadow` 光晕颜色也从绿色 `rgba(7,193,96,*)` 改成了金色 `rgba(255,183,0,*)`，配合新 Logo。

## 3. 修改文件

| 文件 | 改动 |
|---|---|
| `web/src/pages/Login.jsx` | 2 处 Logo SVG 替换；标语 "连接世界 · 沟通无限" → "连接 · 沟通 · 未来" |
| `web/src/pages/Register.jsx` | 1 处 Logo SVG 替换；标语同上替换 |
| `web/src/pages/Home.jsx` | Electron 侧边栏 Logo SVG 替换 |
| `web/src/components/ElectronTitlebar.jsx` | 标题栏 Logo SVG 替换，顺带更新了描述该图标的过时注释 |
| `web/src/styles/login.css` | 2 处 Logo 阴影色 绿→金 |

**未改动**：登录/注册表单结构、校验逻辑、API 调用、路由、权限判断——只动了 `<svg>` 内部内容、CSS 阴影颜色值、和两处纯文案字符串。

favicon 等图标文件（`favicon.ico/png`、`icon-192/512.png`）是同一轮任务更早时候已经处理并部署验证过的（commit `051beb2`），本次不重复列入"新替换"，但仍在下面的检查清单里核对了一遍现状。

## 4. 检查清单

| 项 | 状态 | 验证方式 |
|---|---|---|
| Web 登录页左侧品牌区域 | ✅ | 真实 Playwright 截图（见下） |
| Web 注册页 | ✅ | 真实 Playwright 截图（见下） |
| Web 首页（Electron 侧边栏 Logo） | 🟡 代码已改 | 该分支只在 `isElectron` 且已登录状态渲染，未做真机截图（不打算用假账号硬登录去截这张图，没有真实登录态就不出"验证过"的结论） |
| Electron 标题栏图标 | 🟡 代码已改 | 同上，需要跑起来的 Electron 客户端才能截图，本环境没有桌面 GUI 环境 |
| 浏览器标签图标 favicon | ✅（此前已完成） | 上一轮任务已用 md5 核对线上文件与构建产物一致 |

## 5. 截图验证

用 `npx playwright screenshot` 直接打真实线上地址（不是本地/mock），验证部署后的实际效果：

- 登录页：`https://vxinchat.com/app/login` — 已附件发送
- 注册页：`https://vxinchat.com/app/register` — 已附件发送

两张截图都能看到：左侧品牌区域黑金 V 字 Logo（含右上角小角标）+ "连接 · 沟通 · 未来" 标语；右侧登录/注册表单本身外观、文案、交互控件均未改变。

## 6. 部署

`npm run build` → `rsync` 到 `/var/www/vxin-web/app/`。因为改的是 React 组件源码（Vite 构建产物文件名按内容 hash 命名），构建后资源文件名自动变化，Service Worker 会当作全新 URL 请求，**不需要**像上次改 favicon.png 那样手动 bump `SW_VERSION`。
