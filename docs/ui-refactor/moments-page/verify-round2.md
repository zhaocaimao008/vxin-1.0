# 动态页第五轮（卡片样式对齐）验证记录

范围：`web/src/components/Moments.jsx` + `web/src/index.css` 的本轮 diff（时间挪到名字下方、
"…"更多菜单替换内联编辑/删除/举报文字按钮、操作栏图标+数字右对齐、桌面标题行+刷新、
桌面专属图片网格列数/宽度）。上一轮（桌面两栏骨架，commit `3fc61e6`）作为本轮 before 基线。

## 三项检查
- ESLint（`Moments.jsx`）：干净，0 error。
- vitest：74/74 通过（无用例引用 Moments，预期无回归）。
- `vite build`：通过（修了一处 CSS 注释误含 `*/` 导致 lightningcss 压缩报错的问题）。

## 测试数据
隔离测试后端（`/tmp/vxin-e2e-dev.db`），账号 `MomentsVerify`，5 条动态覆盖边界场景，
`created_at` 回拨到 40+ 天前（2026-07-07 ~ 2026-07-11）以避免"刚刚/N分钟前"相对时间的
时钟抖动：
- 超长正文（172 字，触发"查看全文"折叠）
- 无图
- 1 图
- 4 图
- 9 图（图片网格边界）

## boundingBox 对照（1280×900 桌面视口）

| 元素 | before (round1) | after (round2) | 位移 |
|---|---|---|---|
| `.wc-moments-side`（左栏） | x=92 y=10 w=220 h=880 | x=92 y=10 w=220 h=880 | **否**（零位移，本轮未碰） |
| `.wc-moments-tabs` | x=100 y=74 w=203 h=84 | x=100 y=74 w=203 h=84 | **否** |
| `.wc-moments-main`（宽容器） | x=431 y=10 w=720 h=880 | x=431 y=10 w=720 h=880 | **否** |
| `.wc-moments-heading`（标题行） | 不存在 | x=431 y=10 w=720 h=52 | 新增 |
| 首卡 `.wc-moment-card` | x=431 y=123 w=720 h=415.5 | x=431 y=175 w=720 h=607 | **是**（预期：整体下移 52px=新增标题行高度，卡片变高=图片网格加宽后行更高+新增时间行） |
| 首卡 `.wc-moment-name` | x=503 y=139 w=107.6 h=21 | x=503 y=193 w=107.6 h=21 | 随卡片整体下移，尺寸不变 |
| 首卡 `.wc-moment-meta`（时间行） | 不存在 | x=503 y=215 w=630 h=17 | 新增（名字下方） |
| 首卡 `.wc-moment-images`（9图） | x=503 y=194.5 **w=300** h=300（3×3） | x=503 y=266.5 **w=630** h=471.5（4列） | **是**（本轮目标：桌面取消 300px 宽度上限，4 张一排对齐设计稿） |
| 首卡 `.wc-moment-actions` | x=503 y=502.5 w=630 h=19 | x=503 y=746 w=630 h=19 | 随卡片下移，尺寸不变（宽度本就是 630，本轮只改了对齐方式为右对齐，未改容器宽度） |

结论：左栏和宽容器零位移；卡片内部位移全部可归因于本轮新增元素/目标改动，符合预期。

## 移动端零位移证明（375×812 视口）

同一账号同一份种子数据，在 before/after 两次 dist 构建下分别截图（3 张，覆盖首屏/中部滚动/
底部长文），逐张 SHA256 比对：

| 截图 | before SHA256 | after SHA256 | 结果 |
|---|---|---|---|
| mobile-a（首屏） | a65a743f...c63ca46 | a65a743f...c63ca46 | **完全一致** |
| mobile-b（滚动 400px） | da5895f7...583c0ed | da5895f7...583c0ed | **完全一致** |
| mobile-c（滚动到底/长文） | 13b0ba8d...c68765798f | 13b0ba8d...c68765798f | **完全一致** |

三张截图哈希逐字节相同 —— 移动端/Electron 渲染路径未受本轮改动影响，符合"所有桌面专属改动
必须限定在 desktop 分支"的要求。

## 边界数据观察
- 9 图：桌面 4 列铺满，无溢出/无横向滚动条；移动端仍是原 3×3。
- 4 图：本轮桌面分支仍按 `Math.min(4,4)=4` 列（与 9 图同规则），单排 4 张，贴合设计稿首卡的
  "4 张一排"版式。
- 单图：桌面 `max-height:420px` 上限生效，未被撑爆。
- 无图：正常渲染，无空白错位。
- 超长正文（172 字）：正确截断+"查看全文"，展开/收起未验证到会撑高变形（结构未变，仅样式）。
- "…"菜单：点开后菜单面板贴右上角显示，未超出视口，未遮挡下一张卡片的头像。

## 产出文件
`docs/ui-refactor/moments-page/`：
`before-10-moments-desktop-feed.png`, `after-10-moments-desktop-feed.png`,
`before-11-moments-desktop-longtext.png`, `after-11-moments-desktop-longtext.png`,
`after-16-moments-menu-open.png`,
`before-17-moments-mobile-{a,b,c}.png`, `after-17-moments-mobile-{a,b,c}.png`,
`before-round2-boxes.json`, `after-round2-boxes.json`, `verify-round2.md`（本文件）。
