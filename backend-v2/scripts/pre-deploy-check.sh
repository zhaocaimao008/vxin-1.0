#!/bin/bash
# 部署前自动检查脚本 - Hermes 可直接调用

set -e

echo "🔍 V信后端 P3 部署前检查"
echo "================================"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0
warn_count=0

# 检查函数
check_pass() {
    echo -e "${GREEN}✅${NC} $1"
    ((pass_count++))
}

check_fail() {
    echo -e "${RED}❌${NC} $1"
    ((fail_count++))
}

check_warn() {
    echo -e "${YELLOW}⚠️${NC} $1"
    ((warn_count++))
}

echo ""
echo "1️⃣  Node.js 环境检查"
echo "---"

# 检查 Node.js 版本
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    check_pass "Node.js 已安装: $NODE_VERSION"
else
    check_fail "Node.js 未安装"
fi

# 检查 npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    check_pass "npm 已安装: $NPM_VERSION"
else
    check_fail "npm 未安装"
fi

echo ""
echo "2️⃣  依赖检查"
echo "---"

# 检查 node_modules
if [ -d "node_modules" ]; then
    check_pass "node_modules 目录存在"
else
    check_warn "node_modules 不存在，需要运行 npm ci"
fi

# 检查关键包
CRITICAL_PACKAGES=("express" "socket.io" "sqlite3" "redis")
for pkg in "${CRITICAL_PACKAGES[@]}"; do
    if npm list "$pkg" &>/dev/null; then
        check_pass "依赖包已安装: $pkg"
    else
        check_fail "缺少依赖包: $pkg"
    fi
done

echo ""
echo "3️⃣  环境变量检查"
echo "---"

# 检查 .env 文件
if [ -f ".env" ] || [ -f ".env.production" ]; then
    check_pass ".env 配置文件存在"

    # 检查必要的环境变量
    REQUIRED_VARS=("NODE_ENV" "PORT" "DATABASE_PATH" "REDIS_URL")
    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^${var}=" .env* 2>/dev/null; then
            check_pass "环境变量已配置: $var"
        else
            check_warn "环境变量未配置: $var"
        fi
    done
else
    check_fail ".env 配置文件不存在"
fi

# 检查 JWT 密钥
if grep -q "JWT_SECRET=" .env* 2>/dev/null; then
    JWT_SECRET=$(grep "JWT_SECRET=" .env* | cut -d= -f2)
    if [ ${#JWT_SECRET} -ge 32 ]; then
        check_pass "JWT_SECRET 已配置且长度足够"
    else
        check_fail "JWT_SECRET 长度不足（需要 >= 32 字符）"
    fi
else
    check_fail "JWT_SECRET 未配置"
fi

echo ""
echo "4️⃣  数据库检查"
echo "---"

# 获取数据库路径
DB_PATH=$(grep "DATABASE_PATH=" .env* 2>/dev/null | cut -d= -f2 | head -1)

if [ -n "$DB_PATH" ]; then
    if [ -f "$DB_PATH" ]; then
        check_pass "数据库文件存在: $DB_PATH"
        # 检查权限
        if [ -r "$DB_PATH" ] && [ -w "$DB_PATH" ]; then
            check_pass "数据库文件权限正确"
        else
            check_fail "数据库文件权限不足"
        fi
    else
        check_warn "数据库文件不存在: $DB_PATH (首次部署时会自动创建)"
    fi
else
    check_fail "DATABASE_PATH 未配置"
fi

# 验证数据库结构
if command -v sqlite3 &> /dev/null && [ -f "$DB_PATH" ]; then
    TABLES=$(sqlite3 "$DB_PATH" ".tables" 2>/dev/null | wc -w)
    if [ "$TABLES" -gt 0 ]; then
        check_pass "数据库表结构完整 ($TABLES 个表)"
    else
        check_warn "数据库可能未初始化"
    fi
fi

echo ""
echo "5️⃣  Redis 检查"
echo "---"

# 获取 Redis URL
REDIS_URL=$(grep "REDIS_URL=" .env* 2>/dev/null | cut -d= -f2 | head -1)

if [ -n "$REDIS_URL" ]; then
    check_pass "REDIS_URL 已配置: $REDIS_URL"

    # 尝试连接 Redis
    if command -v redis-cli &> /dev/null; then
        # 解析 Redis 连接信息
        REDIS_HOST=$(echo $REDIS_URL | sed 's/.*:\/\/\([^:]*\).*/\1/')
        REDIS_PORT=$(echo $REDIS_URL | sed 's/.*:\([0-9]*\).*/\1/')

        if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping &>/dev/null; then
            check_pass "Redis 连接成功"
        else
            check_fail "Redis 连接失败 ($REDIS_HOST:$REDIS_PORT)"
        fi
    else
        check_warn "redis-cli 未安装，无法验证 Redis 连接"
    fi
else
    check_fail "REDIS_URL 未配置"
fi

echo ""
echo "6️⃣  文件系统检查"
echo "---"

# 检查 logs 目录
if [ -d "logs" ]; then
    check_pass "logs 目录存在"
    # 检查权限
    if [ -w "logs" ]; then
        check_pass "logs 目录可写"
    else
        check_fail "logs 目录不可写"
    fi
else
    check_warn "logs 目录不存在，应用启动时会创建"
fi

# 检查 uploads 目录
UPLOAD_PATH=$(grep "UPLOADS_ROOT=" .env* 2>/dev/null | cut -d= -f2 | head -1)
if [ -n "$UPLOAD_PATH" ]; then
    if [ -d "$UPLOAD_PATH" ]; then
        check_pass "uploads 目录存在: $UPLOAD_PATH"
    else
        check_warn "uploads 目录不存在: $UPLOAD_PATH (需要手动创建)"
    fi
fi

echo ""
echo "7️⃣  端口检查"
echo "---"

PORT=$(grep "^PORT=" .env* 2>/dev/null | cut -d= -f2 | head -1)
PORT=${PORT:-3002}

if command -v netstat &> /dev/null || command -v ss &> /dev/null; then
    if netstat -tulpn 2>/dev/null | grep -q ":$PORT " || \
       ss -tulpn 2>/dev/null | grep -q ":$PORT "; then
        check_warn "端口 $PORT 已被占用"
    else
        check_pass "端口 $PORT 可用"
    fi
else
    check_warn "netstat/ss 不可用，无法检查端口"
fi

echo ""
echo "8️⃣  系统资源检查"
echo "---"

# 检查可用内存
if command -v free &> /dev/null; then
    MEM_AVAILABLE=$(free -h | awk '/^Mem:/ {print $7}')
    check_pass "可用内存: $MEM_AVAILABLE"
else
    check_warn "无法检查可用内存"
fi

# 检查磁盘空间
if command -v df &> /dev/null; then
    DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}')
    check_pass "磁盘使用率: $DISK_USAGE"
else
    check_warn "无法检查磁盘空间"
fi

# 检查 CPU 核心数
if command -v nproc &> /dev/null; then
    CPU_CORES=$(nproc)
    check_pass "CPU 核心数: $CPU_CORES"
fi

echo ""
echo "9️⃣  安全检查"
echo "---"

# 检查是否使用默认密钥
if grep -q "JWT_SECRET=your-secret-key" .env* 2>/dev/null; then
    check_fail "⚠️  警告：使用了默认 JWT 密钥，必须修改！"
fi

if grep -q "REFRESH_TOKEN_SECRET=your-secret" .env* 2>/dev/null; then
    check_fail "⚠️  警告：使用了默认 REFRESH_TOKEN_SECRET，必须修改！"
fi

# 检查 .gitignore 是否包含 .env
if [ -f ".gitignore" ]; then
    if grep -q "\.env" .gitignore; then
        check_pass ".env 已添加到 .gitignore"
    else
        check_warn ".env 未添加到 .gitignore"
    fi
fi

echo ""
echo "================================"
echo "检查结果统计"
echo "================================"
echo -e "${GREEN}✅ 通过: $pass_count${NC}"
echo -e "${YELLOW}⚠️  警告: $warn_count${NC}"
echo -e "${RED}❌ 失败: $fail_count${NC}"

echo ""

if [ $fail_count -gt 0 ]; then
    echo -e "${RED}❌ 检查失败！${NC}"
    echo "请修复上述问题后再进行部署"
    exit 1
elif [ $warn_count -gt 0 ]; then
    echo -e "${YELLOW}⚠️  有警告，请确认后再部署${NC}"
    exit 0
else
    echo -e "${GREEN}✅ 所有检查通过！${NC}"
    echo "可以继续部署"
    exit 0
fi
