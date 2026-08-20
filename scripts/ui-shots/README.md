# UI 改版截图/回归工具（ui-refactor/web-phase2）

本目录是 `web/src` UI token 改版验证时用到的本地截图/回归脚本，从阶段二 QA
过程中固化下来，方便下一轮改动前后对照，不是项目运行时依赖。

## 依赖

- 复用仓库里已经装好的 `e2e/node_modules/@playwright/test`（Chromium），本目录
  不单独 vendor 依赖。
- `diff-image.py` 需要本机 `python3` + `Pillow`（`pip install Pillow`），只在
  生成像素级 diff 高亮图时用，非必需步骤。

## 1. Mock 截图（不连真实后端，不需要账号）

原理：拦截 `config.json` 逼远程配置走内置默认值（`api:''` 同源相对路径），
拦截 `/api/**` 用 `mock-data.js` 里的假数据 fulfill。

```bash
# 1. 起 dev server
cd web && npx vite --port 4175 --strictPort &

# 2. 跑截图（--dataset normal 是默认值，也可以传 edge 跑边界值数据集）
cd ../scripts/ui-shots
node capture.js --port 4175 --prefix after --out /tmp/shots
node capture.js --port 4175 --prefix after-edge --dataset edge --out /tmp/shots
# 边界值数据集下想单独看空态/单人群，再加 --empty-conversations / --empty-contacts / --single-member
# 想单独看某会话消息列表为空的聊天详情页，再加 --empty-messages
```

## 2. Before/After 对照（结构位移比对）

```bash
# before：用 git worktree 检出改动前的 commit（阶段二起点是 c3bdb9c，
# 之后每轮改动请换成对应轮次开始前的 commit）
git worktree add /tmp/vxin-before c3bdb9c
ln -s "$(pwd)/../../web/node_modules" /tmp/vxin-before/web/node_modules
cd /tmp/vxin-before/web && npx vite --port 4176 --strictPort &

cd /path/to/vxin-1.0/scripts/ui-shots
node capture.js --port 4176 --prefix before --out /tmp/shots --boxes
node capture.js --port 4175 --prefix after  --out /tmp/shots --boxes

# 结构化位移比对表（"我的" WebSettingsShell 双栏 + 单栏卡片列表两屏）
node compare-boxes.js /tmp/shots/before-boxes.json /tmp/shots/after-boxes.json

# 像素级 diff 高亮图（可选）
python3 diff-image.py /tmp/shots/before-06-me-singlecolumn.png /tmp/shots/after-06-me-singlecolumn.png /tmp/shots/diff-06.png

# 用完记得清理
git worktree remove /tmp/vxin-before --force
```

## 3. 真实环境只读验证（需要真实账号，务必按下面的方式传参）

`real-env-check.js` 会登录 `https://vxinchat.com`（生产），走一遍"消息→聊天详情
→群信息→通讯录→好友资料→我的（双栏+单栏）"的只读浏览路径截图，**不做任何写
操作**（不发消息/不改资料/不退群/不删好友/不提交任何表单）。

**账号密码只能通过环境变量传入，禁止写进任何文件（包括本 README、任何脚本、
commit message、日志）：**

```bash
E2E_ACCOUNT=你的手机号 E2E_PASSWORD=你的密码 node scripts/ui-shots/real-env-check.js
```

- 输出截图在 `shots/real/`，脚本会在截图前把画面里形如手机号的文本做 DOM 级
  打码替换（`1**********`），但仍建议人工过一遍确认没有遗漏。
- 登录失败（密码错/风控/验证码）脚本会直接停止并非 0 退出，不会重试或换账号。
- 这个脚本会真实连接生产环境，不要在 CI 或未经确认的场景里自动跑。

## 文件说明

| 文件 | 作用 |
|---|---|
| `mock-data.js` | `NORMAL`（正常示例）+ `EDGE`（超长文本/空态/缺字段边界值）两套 mock 数据 |
| `capture.js` | mock 截图主脚本，见上面用法 |
| `compare-boxes.js` | 比对两份 `--boxes` 产出的 JSON，生成逐元素位移表 |
| `diff-image.py` | 生成像素级 diff 高亮图（需要 Pillow） |
| `real-env-check.js` | 真实生产环境只读端到端验证，账号密码只走环境变量 |
