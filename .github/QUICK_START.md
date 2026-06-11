# 自动部署快速配置（5 分钟上手）

## 📋 需要做的事（3 个步骤）

### 步骤 1️⃣：生成 SSH 密钥（本地机器）

```bash
ssh-keygen -t ed25519 -f ~/.ssh/vxin-deploy -C "vxin-backend-deploy"
# 全部按 Enter（不要设置密码）
```

### 步骤 2️⃣：添加公钥到服务器

```bash
ssh root@<你的服务器IP>
cat << 'EOF' >> ~/.ssh/authorized_keys
<粘贴 ~/.ssh/vxin-deploy.pub 的内容>
EOF
chmod 600 ~/.ssh/authorized_keys
exit
```

### 步骤 3️⃣：在 GitHub 配置 3 个 Secrets

进入：**GitHub 仓库 → Settings → Secrets and variables → Actions**

**添加第 1 个 Secret：**
- 名称：`DEPLOY_SSH_KEY`
- 值：执行 `cat ~/.ssh/vxin-deploy` 的完整输出

**添加第 2 个 Secret：**
- 名称：`DEPLOY_SERVER_HOST`
- 值：你的服务器 IP（例如 `123.45.67.89`）

**添加第 3 个 Secret：**
- 名称：`DEPLOY_USER`
- 值：`root`（或其他用户）

---

## ✅ 验证配置

```bash
# 测试 SSH
ssh -i ~/.ssh/vxin-deploy root@<你的服务器IP>

# 触发自动部署
cd /root/v信
git add .
git commit -m "trigger: test deployment"
git push origin main

# 查看部署日志
# GitHub 仓库 → Actions → 最新工作流
```

---

## 🎉 完成！

现在每次推送到 `main` 都会自动：
- ✅ 运行测试
- ✅ 构建应用
- ✅ 部署到服务器
- ✅ 验证应用启动

有问题？查看详细指南：[DEPLOYMENT_SETUP.md](./DEPLOYMENT_SETUP.md)
