#!/bin/bash
# V信后端自动部署配置辅助脚本

set -e

echo "=========================================="
echo "🚀 V信后端自动部署配置向导"
echo "=========================================="
echo ""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. 检查必要的工具
echo -e "${BLUE}[步骤 1] 检查环境${NC}"
echo ""

if ! command -v ssh &> /dev/null; then
    echo -e "${RED}❌ SSH 未安装${NC}"
    exit 1
fi
echo -e "${GREEN}✅ SSH 已安装${NC}"

if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git 未安装${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Git 已安装${NC}"

# 2. 生成或检查 SSH 密钥
echo ""
echo -e "${BLUE}[步骤 2] 配置 SSH 密钥${NC}"
echo ""

DEPLOY_KEY="$HOME/.ssh/vxin-deploy"

if [ -f "$DEPLOY_KEY" ]; then
    echo -e "${YELLOW}⚠️  部署密钥已存在：$DEPLOY_KEY${NC}"
    read -p "是否使用现有密钥？(y/n) " -n 1 -r use_existing
    echo ""
    if [[ ! $use_existing =~ ^[Yy]$ ]]; then
        echo "生成新密钥..."
        rm -f "$DEPLOY_KEY" "$DEPLOY_KEY.pub"
        ssh-keygen -t ed25519 -f "$DEPLOY_KEY" -C "vxin-backend-deploy" -N ""
    fi
else
    echo "生成新的 SSH 部署密钥..."
    ssh-keygen -t ed25519 -f "$DEPLOY_KEY" -C "vxin-backend-deploy" -N ""
fi

echo -e "${GREEN}✅ SSH 密钥已准备${NC}"
echo ""

# 3. 读取密钥信息
echo -e "${BLUE}[步骤 3] 密钥信息${NC}"
echo ""

PRIVATE_KEY=$(cat "$DEPLOY_KEY")
PUBLIC_KEY=$(cat "$DEPLOY_KEY.pub")

echo -e "${YELLOW}📋 私钥（用于 GitHub Secret）：${NC}"
echo "=================================================="
echo "$PRIVATE_KEY"
echo "=================================================="
echo ""

echo -e "${YELLOW}📋 公钥（需要添加到服务器）：${NC}"
echo "=================================================="
echo "$PUBLIC_KEY"
echo "=================================================="
echo ""

# 4. 测试服务器连接
echo ""
echo -e "${BLUE}[步骤 4] 测试服务器连接${NC}"
echo ""

read -p "请输入服务器 IP 或域名：" SERVER_HOST

if [ -z "$SERVER_HOST" ]; then
    echo -e "${YELLOW}⚠️  跳过服务器连接测试${NC}"
else
    read -p "请输入 SSH 用户名（默认: root）：" SERVER_USER
    SERVER_USER=${SERVER_USER:-root}

    echo "测试连接到 $SERVER_USER@$SERVER_HOST..."

    if timeout 5 ssh -i "$DEPLOY_KEY" -o StrictHostKeyChecking=no \
        -o ConnectTimeout=3 \
        "$SERVER_USER@$SERVER_HOST" "echo '✅ SSH 连接成功'" 2>/dev/null; then
        echo -e "${GREEN}✅ 服务器连接成功${NC}"
        TEST_PASS=1
    else
        echo -e "${RED}❌ 无法连接到服务器${NC}"
        echo ""
        echo "请确保："
        echo "1. 服务器 IP/域名 正确"
        echo "2. 防火墙已开放 22 端口"
        echo "3. 公钥已添加到 ~/.ssh/authorized_keys"
        echo ""
        echo "在服务器上运行以下命令添加公钥："
        echo "echo '$PUBLIC_KEY' >> ~/.ssh/authorized_keys"
        echo ""
        TEST_PASS=0
    fi
fi

# 5. 生成配置总结
echo ""
echo -e "${BLUE}[步骤 5] GitHub Secrets 配置${NC}"
echo ""

echo "请在 GitHub 仓库中添加以下 3 个 Secrets："
echo ""
echo "Settings → Secrets and variables → Actions → New repository secret"
echo ""
echo -e "${YELLOW}Secret 1 - DEPLOY_SSH_KEY${NC}"
echo "—————————————————————————————————————————"
cat "$DEPLOY_KEY"
echo ""
echo ""
echo -e "${YELLOW}Secret 2 - DEPLOY_SERVER_HOST${NC}"
echo "—————————————————————————————————————————"
echo "$SERVER_HOST"
echo ""
echo ""
echo -e "${YELLOW}Secret 3 - DEPLOY_USER${NC}"
echo "—————————————————————————————————————————"
echo "${SERVER_USER:-root}"
echo ""
echo ""

# 6. 总结
echo -e "${BLUE}[步骤 6] 检查清单${NC}"
echo ""

echo "📋 配置完成检查清单："
echo ""
echo "  [ ] 生成了 SSH 密钥（$DEPLOY_KEY）"
echo "  [ ] 在服务器上添加了公钥到 ~/.ssh/authorized_keys"
echo "  [ ] 添加了 DEPLOY_SSH_KEY 到 GitHub Secrets"
echo "  [ ] 添加了 DEPLOY_SERVER_HOST 到 GitHub Secrets"
echo "  [ ] 添加了 DEPLOY_USER 到 GitHub Secrets"

if [ "$TEST_PASS" = "1" ]; then
    echo "  [ ] ✅ 测试了 SSH 连接（通过）"
else
    echo "  [ ] ❌ 测试了 SSH 连接（待完成）"
fi

echo ""
echo -e "${GREEN}🎉 配置完成！${NC}"
echo ""
echo "后续步骤："
echo "1. 复制上面的 Secrets 值到 GitHub"
echo "2. 推送代码到 main 分支：git push origin main"
echo "3. 在 GitHub Actions 中查看自动部署日志"
echo ""
echo "有问题？查看详细文档：.github/DEPLOYMENT_SETUP.md"
echo ""

# 7. 提供快速命令
echo -e "${BLUE}[可选] 快速命令参考${NC}"
echo ""
echo "查看部署密钥（私钥）："
echo "  cat $DEPLOY_KEY"
echo ""
echo "查看部署密钥（公钥）："
echo "  cat $DEPLOY_KEY.pub"
echo ""
echo "测试 SSH 连接："
echo "  ssh -i $DEPLOY_KEY $SERVER_USER@$SERVER_HOST"
echo ""
echo "手动部署（如需要）："
echo "  ssh -i $DEPLOY_KEY root@$SERVER_HOST 'cd /root/v信/backend-v2 && git pull && npm install && npm start'"
echo ""
