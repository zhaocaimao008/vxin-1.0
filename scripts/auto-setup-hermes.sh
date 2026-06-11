#!/bin/bash
# V信后端一键自动部署配置 - Hermes 专用

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 清屏
clear

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     V信后端 Hermes 一键自动部署配置工具                    ║"
echo "║     GitHub Actions + SSH 自动化部署                       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# 检查环境
echo -e "${BLUE}[初始化] 检查环境...${NC}"
if ! command -v ssh-keygen &> /dev/null; then
    echo -e "${RED}❌ 错误：ssh-keygen 不可用${NC}"
    exit 1
fi
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ 错误：git 不可用${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 环境检查通过${NC}"
echo ""

# 配置目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_DIR="$REPO_ROOT/.deploy-config"
KEYS_DIR="$DEPLOY_DIR/keys"

mkdir -p "$KEYS_DIR"

echo -e "${BLUE}[第 1 步] 生成 SSH 部署密钥...${NC}"

DEPLOY_KEY="$KEYS_DIR/vxin-deploy"

if [ -f "$DEPLOY_KEY" ]; then
    echo -e "${YELLOW}⚠️  部署密钥已存在${NC}"
    read -p "是否使用现有密钥？(y/n) " -n 1 -r use_existing
    echo ""
    if [[ ! $use_existing =~ ^[Yy]$ ]]; then
        rm -f "$DEPLOY_KEY" "$DEPLOY_KEY.pub"
        ssh-keygen -t ed25519 -f "$DEPLOY_KEY" -C "vxin-backend-deploy-$(date +%s)" -N "" > /dev/null 2>&1
        echo -e "${GREEN}✅ 新密钥已生成${NC}"
    else
        echo -e "${GREEN}✅ 使用现有密钥${NC}"
    fi
else
    ssh-keygen -t ed25519 -f "$DEPLOY_KEY" -C "vxin-backend-deploy-$(date +%s)" -N "" > /dev/null 2>&1
    echo -e "${GREEN}✅ SSH 部署密钥已生成${NC}"
fi

echo ""
echo -e "${BLUE}[第 2 步] 生成配置文件...${NC}"

# 读取密钥
PRIVATE_KEY=$(cat "$DEPLOY_KEY")
PUBLIC_KEY=$(cat "$DEPLOY_KEY.pub")
KEY_FINGERPRINT=$(ssh-keygen -l -f "$DEPLOY_KEY" | awk '{print $2}')

# 生成 GitHub Secrets 配置文件
cat > "$DEPLOY_DIR/github-secrets.txt" << 'SECRETS_EOF'
==========================================
GitHub Secrets 配置
==========================================

进入: GitHub 仓库 → Settings → Secrets and variables → Actions

点击: New repository secret

---

Secret 1 of 3: DEPLOY_SSH_KEY
类型: 私钥（二进制数据）
说明: 用于 SSH 认证的私钥

START_DEPLOY_SSH_KEY
SECRETS_EOF

echo "$PRIVATE_KEY" >> "$DEPLOY_DIR/github-secrets.txt"

cat >> "$DEPLOY_DIR/github-secrets.txt" << 'SECRETS_EOF'
END_DEPLOY_SSH_KEY

---

Secret 2 of 3: DEPLOY_SERVER_HOST
类型: 文本
说明: 香港服务器的 IP 地址或域名
例如: 123.45.67.89 或 server.example.com

值: 将在下面的"服务器配置"部分看到

---

Secret 3 of 3: DEPLOY_USER
类型: 文本
说明: SSH 登录用户名
默认值: root

值: root

==========================================
SECRETS_EOF

# 生成服务器配置脚本
cat > "$DEPLOY_DIR/server-setup.sh" << 'SERVER_SETUP_EOF'
#!/bin/bash
# V信后端服务器部署前配置脚本
# 在香港服务器上运行此脚本

set -e

echo "=========================================="
echo "V信后端服务器配置"
echo "=========================================="
echo ""

# 1. 创建目录结构
echo "[1/4] 创建目录结构..."
mkdir -p ~/.ssh
mkdir -p /root/v信/backend-v2
mkdir -p /var/lib/vxin/logs
mkdir -p /var/lib/vxin/uploads
mkdir -p /var/lib/vxin/db

echo "✅ 目录已创建"
echo ""

# 2. 配置 SSH
echo "[2/4] 配置 SSH..."

# 创建 authorized_keys（如果不存在）
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

echo "✅ SSH 配置完成"
echo ""

# 3. 检查必要工具
echo "[3/4] 检查必要工具..."

if ! command -v git &> /dev/null; then
    echo "❌ Git 未安装"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装"
    exit 1
fi

echo "✅ 所有必要工具已安装"
echo ""

# 4. 克隆或更新代码
echo "[4/4] 准备应用代码..."

if [ ! -d "/root/v信" ]; then
    echo "克隆仓库..."
    git clone https://github.com/zhaocaimao008/vxin-1.0.git /root/v信
else
    echo "更新仓库..."
    cd /root/v信
    git fetch origin
fi

echo "✅ 应用代码已准备"
echo ""

echo "=========================================="
echo "✅ 服务器配置完成！"
echo "=========================================="
echo ""
echo "后续步骤:"
echo "1. 添加公钥到 ~/.ssh/authorized_keys"
echo "2. 在 GitHub 添加 3 个 Secrets"
echo "3. 推送代码到 main 分支"
echo ""

SERVER_SETUP_EOF

chmod +x "$DEPLOY_DIR/server-setup.sh"

echo -e "${GREEN}✅ 配置文件已生成${NC}"
echo ""

# 生成公钥安装脚本
cat > "$DEPLOY_DIR/install-pubkey.sh" << 'PUBKEY_EOF'
#!/bin/bash
# 在服务器上运行此脚本来安装公钥

PUBLIC_KEY_CONTENT='PUBKEY_PLACEHOLDER'

if grep -q "$PUBLIC_KEY_CONTENT" ~/.ssh/authorized_keys 2>/dev/null; then
    echo "✅ 公钥已存在"
else
    echo "Adding public key..."
    echo "$PUBLIC_KEY_CONTENT" >> ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
    echo "✅ 公钥已添加"
fi

PUBKEY_EOF

# 替换占位符
sed -i "s|PUBKEY_PLACEHOLDER|$PUBLIC_KEY|g" "$DEPLOY_DIR/install-pubkey.sh"
chmod +x "$DEPLOY_DIR/install-pubkey.sh"

echo -e "${BLUE}[第 3 步] 生成部署配置总结...${NC}"

# 生成总结报告
cat > "$DEPLOY_DIR/SETUP_SUMMARY.md" << 'SUMMARY_EOF'
# V信后端自动部署配置总结

## ✅ 已完成

- ✅ SSH 部署密钥已生成
- ✅ GitHub Actions 工作流已配置
- ✅ 服务器配置脚本已生成

## 📋 后续步骤（4 个）

### 第 1 步：在服务器上运行初始配置

```bash
# 在香港服务器上执行
bash install-pubkey.sh
bash server-setup.sh
```

**或者手动执行：**

```bash
ssh root@<你的服务器IP>

# 创建必要目录
mkdir -p ~/.ssh /root/v信 /var/lib/vxin/{logs,uploads,db}

# 添加公钥
echo "PUBKEY_CONTENT" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 第 2 步：在 GitHub 添加 Secrets

进入：**GitHub 仓库 → Settings → Secrets and variables → Actions**

添加 3 个 Secrets（参考 `github-secrets.txt`）：

1. `DEPLOY_SSH_KEY` - 私钥内容
2. `DEPLOY_SERVER_HOST` - 服务器 IP
3. `DEPLOY_USER` - 登录用户（通常 `root`）

### 第 3 步：推送代码到 GitHub

```bash
git push origin main
```

### 第 4 步：验证自动部署

1. 进入 GitHub 仓库 → Actions
2. 查看工作流运行状态
3. 等待 ✅ 测试 + ✅ 部署 通过

## 🔑 密钥信息

| 项目 | 值 |
|------|-----|
| 密钥类型 | ED25519 |
| 密钥指纹 | FINGERPRINT_PLACEHOLDER |
| 私钥位置 | `.deploy-config/keys/vxin-deploy` |
| 公钥位置 | `.deploy-config/keys/vxin-deploy.pub` |

## 📁 生成的文件

- `github-secrets.txt` - GitHub Secrets 配置说明
- `server-setup.sh` - 服务器初始化脚本
- `install-pubkey.sh` - 公钥安装脚本
- `SETUP_SUMMARY.md` - 本文件

## 🚀 工作流

```
git push origin main
         ↓
GitHub Actions 自动触发
         ↓
测试通过 → 自动部署到服务器
         ↓
应用启动 + 健康检查
         ↓
✅ 完成！
```

## ⚠️ 注意

- 私钥保存在 `.deploy-config/keys/` 中（不要提交到 Git）
- 公钥需要添加到服务器的 `~/.ssh/authorized_keys`
- GitHub Secrets 中的敏感信息是加密的

## 🆘 故障排查

**无法连接到服务器**
```bash
# 检查 SSH
ssh -i .deploy-config/keys/vxin-deploy root@<服务器IP>

# 检查公钥是否添加
ssh root@<服务器IP> cat ~/.ssh/authorized_keys
```

**部署失败**
- 查看 GitHub Actions 的详细日志
- 查看服务器上的应用日志：`tail -f /tmp/vxin-backend.log`

SUMMARY_EOF

# 替换占位符
sed -i "s|PUBKEY_CONTENT|$PUBLIC_KEY|g" "$DEPLOY_DIR/SETUP_SUMMARY.md"
sed -i "s|FINGERPRINT_PLACEHOLDER|$KEY_FINGERPRINT|g" "$DEPLOY_DIR/SETUP_SUMMARY.md"

echo -e "${GREEN}✅ 配置总结已生成${NC}"
echo ""

# 显示生成的文件位置
echo -e "${BLUE}[第 4 步] 生成的文件${NC}"
echo ""
echo -e "${CYAN}配置目录：${NC} $DEPLOY_DIR"
echo ""
ls -lh "$DEPLOY_DIR"
echo ""

# 显示下一步说明
echo -e "${BLUE}[第 5 步] 后续步骤${NC}"
echo ""

echo "1️⃣  查看配置总结："
echo -e "   ${CYAN}cat $DEPLOY_DIR/SETUP_SUMMARY.md${NC}"
echo ""

echo "2️⃣  获取公钥（用于服务器）："
echo -e "   ${CYAN}cat $DEPLOY_DIR/keys/vxin-deploy.pub${NC}"
echo ""

echo "3️⃣  在服务器上运行配置脚本："
echo -e "   ${CYAN}bash install-pubkey.sh${NC}"
echo -e "   ${CYAN}bash server-setup.sh${NC}"
echo ""

echo "4️⃣  查看 GitHub Secrets 配置："
echo -e "   ${CYAN}cat $DEPLOY_DIR/github-secrets.txt${NC}"
echo ""

echo "5️⃣  复制私钥到 GitHub（DEPLOY_SSH_KEY）："
echo -e "   ${CYAN}cat $DEPLOY_DIR/keys/vxin-deploy${NC}"
echo ""

echo "6️⃣  推送到 GitHub："
echo -e "   ${CYAN}cd $REPO_ROOT && git push origin main${NC}"
echo ""

echo -e "${GREEN}=========================================="
echo "✅ 自动部署配置完成！"
echo "=========================================${NC}"
echo ""

echo -e "${YELLOW}⚠️  重要：${NC}"
echo "1. .deploy-config 目录包含密钥，不要提交到 Git"
echo "2. 确保 .gitignore 中有 .deploy-config 条目"
echo "3. 在服务器上安装公钥后才能使用自动部署"
echo ""

# 自动添加到 .gitignore
if ! grep -q ".deploy-config" "$REPO_ROOT/.gitignore" 2>/dev/null; then
    echo ".deploy-config/" >> "$REPO_ROOT/.gitignore"
    echo -e "${GREEN}✅ 已更新 .gitignore${NC}"
fi

echo ""
echo -e "${CYAN}所有文件已生成到: $DEPLOY_DIR${NC}"
echo ""
