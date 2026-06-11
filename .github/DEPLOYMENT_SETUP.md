# 自动部署配置指南

## 概述

这个项目已经配置了 **GitHub Actions 自动部署工作流**。每当你推送代码到 `main` 分支时，自动进行以下操作：

1. ✅ **运行测试** - 确保代码质量
2. 📦 **安装依赖** - 使用 `npm ci` 保证版本一致性
3. 🚀 **自动部署** - 通过 SSH 部署到香港服务器
4. ✔️ **健康检查** - 验证应用是否正常启动

---

## 配置步骤

### 1️⃣ 生成 SSH 部署密钥（在你的本地机器上）

如果还没有专门的部署密钥，生成一个：

```bash
ssh-keygen -t ed25519 -f ~/.ssh/vxin-deploy -C "vxin-backend-deploy"
# 直接按 Enter（不设置密码，方便自动化）
```

这会生成两个文件：
- `~/.ssh/vxin-deploy` - **私钥**（保密）
- `~/.ssh/vxin-deploy.pub` - 公钥（添加到服务器）

### 2️⃣ 将公钥添加到香港服务器

```bash
# 登录到香港服务器
ssh root@<你的服务器IP>

# 将公钥追加到 authorized_keys
cat << 'EOF' >> ~/.ssh/authorized_keys
<你的公钥内容：vxin-deploy.pub 的内容>
EOF

chmod 600 ~/.ssh/authorized_keys
exit
```

### 3️⃣ 在 GitHub 上配置 Secrets

在你的 GitHub 仓库页面：

**路径**：Settings → Secrets and variables → Actions

点击 **"New repository secret"**，添加以下三个密钥：

#### 密钥 1: `DEPLOY_SSH_KEY`

- **名称**：`DEPLOY_SSH_KEY`
- **值**：从你的本地机器复制私钥内容
  ```bash
  cat ~/.ssh/vxin-deploy
  ```
  把整个内容（包括 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`）粘贴进去

#### 密钥 2: `DEPLOY_SERVER_HOST`

- **名称**：`DEPLOY_SERVER_HOST`
- **值**：你的服务器 IP 或域名（例如：`123.45.67.89` 或 `vxin.example.com`）

#### 密钥 3: `DEPLOY_USER`

- **名称**：`DEPLOY_USER`
- **值**：SSH 用户名（通常是 `root`）

---

## 验证配置

### ✅ 测试 SSH 连接

在你的本地机器上测试 SSH 连接：

```bash
ssh -i ~/.ssh/vxin-deploy root@<你的服务器IP>
```

如果能成功登录，说明配置正确。

### ✅ 测试自动部署

推送一个小改动到 `main` 分支：

```bash
cd /root/v信
git add .
git commit -m "test: trigger deployment"
git push origin main
```

然后：

1. 进入 GitHub 仓库的 **Actions** 标签
2. 查看最新的工作流运行状态
3. 点击查看详细日志

如果看到绿色的 ✅，说明部署成功！

---

## 工作流详解

### 文件位置

`.github/workflows/deploy.yml`

### 触发条件

```yaml
on:
  push:
    branches: [main]
    paths: ['backend-v2/**']
  workflow_dispatch:  # 可手动触发
```

- 当推送到 `main` 分支 **且** 修改了 `backend-v2/` 下的文件时自动触发
- 也可以在 GitHub Actions 页面手动点击运行

### 工作流步骤

1. **Checkout** - 检出代码
2. **Setup Node.js** - 安装 Node.js
3. **Install dependencies** - 安装 npm 依赖
4. **Run tests** - 执行 `npm test`
5. **Deploy to server** - SSH 连接到服务器并部署
6. **Health check** - 验证应用 `/health` 端点

---

## 常见问题

### Q1: 部署失败，显示 "Permission denied"

**原因**：SSH 公钥未正确添加到服务器

**解决**：
```bash
ssh root@<服务器IP> 'cat ~/.ssh/authorized_keys'
# 确认你的 vxin-deploy.pub 内容在这里
```

### Q2: 部署成功但应用无法访问

**原因**：可能是防火墙或应用启动失败

**解决**：
```bash
ssh root@<服务器IP>
tail -f /tmp/vxin-backend.log
```

查看应用日志，找出错误原因。

### Q3: 想暂时禁用自动部署

**方法**：禁用工作流文件即可

GitHub 仓库 → Actions → 左侧找到 "自动部署 V信后端" → 点击 "Disable workflow"

### Q4: 想手动触发部署

**方法**：
1. 进入 GitHub 仓库的 Actions 标签
2. 左侧选择 "自动部署 V信后端"
3. 点击 "Run workflow" → "Run workflow"

---

## 高级配置

### 修改部署命令

编辑 `.github/workflows/deploy.yml` 的 `DEPLOY_SCRIPT` 部分，修改部署逻辑。

例如，如果想用 PM2 而不是 nohup：

```bash
echo "🚀 步骤 4: 启动新应用（使用 PM2）"
pm2 start ecosystem.config.js --env production
pm2 save
```

### 添加部署前检查

```bash
echo "🔍 步骤 3.5: 部署前检查"
npm run lint        # 代码风格检查
npm run typecheck   # TypeScript 类型检查
```

### 添加部署通知

部署完成后可以发送通知（Slack、钉钉、邮件等）：

```yaml
- name: 发送部署成功通知
  if: success()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 安全最佳实践

✅ **已做好的事**：
- 私钥存储在 GitHub Secrets 中（加密）
- 部署密钥与个人账户分离
- SSH 连接使用密钥认证而非密码

✅ **建议做的事**：
- 定期轮换部署密钥（每 3-6 个月）
- 限制服务器上部署用户的权限（使用单独的用户账户）
- 监控 GitHub Actions 日志，及时发现异常

---

## 回滚方案

如果部署出现问题，可以快速回滚：

```bash
ssh root@<服务器IP>
cd /root/v信/backend-v2
git revert HEAD
git push origin main
```

这会自动触发新的部署，恢复到上一个版本。

---

## 下一步

1. ✅ 配置好 3 个 Secrets（`DEPLOY_SSH_KEY`, `DEPLOY_SERVER_HOST`, `DEPLOY_USER`）
2. ✅ 在服务器上添加公钥到 `~/.ssh/authorized_keys`
3. ✅ 推送测试提交到 `main` 分支
4. ✅ 在 GitHub Actions 中查看部署日志
5. ✅ 访问应用验证部署成功

有任何问题，查看 GitHub Actions 的详细日志或服务器上的应用日志：

```bash
ssh root@<服务器IP>
tail -100 /tmp/vxin-backend.log
```

祝部署顺利！🚀
