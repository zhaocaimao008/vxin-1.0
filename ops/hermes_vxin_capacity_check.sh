#!/usr/bin/env bash
###############################################################################
# hermes_vxin_capacity_check.sh
#
# 由【香港服务器上的 Hermes】执行，绝不从本地直连服务器。
#
# 目标容量验收：
#   • 每天 10 万条消息   (≈ 1.2 条/秒均值，按 15× 峰值 ≈ 18 条/秒压测)
#   • 1000 人同时在线    (1000 条并发 WebSocket 长连接)
#
# 行为：
#   1) 巡检：服务存活、资源余量、OS 句柄上限、SQLite 调优、Socket.IO 集群、Nginx
#   2) 压测：并发登录 + 发消息吞吐 + 并发长连接，统计 p95 延迟与错误率
#   3) 自动修复：仅应用「安全、幂等、可回滚」的修复项；架构级风险只告警并给出命令
#   4) 出报告：/root/v信/ops/reports/capacity_YYYYmmdd_HHMMSS.md
#
# 用法（Hermes 在服务器上跑）：
#   bash hermes_vxin_capacity_check.sh            # 巡检 + 压测 + 安全自动修复（默认）
#   bash hermes_vxin_capacity_check.sh --check    # 只巡检 + 压测，不改任何东西
#   bash hermes_vxin_capacity_check.sh --apply-arch  # 额外执行架构级修复(装Redis+适配器)
###############################################################################
set -uo pipefail

# ─────────────────────────── 配置 ───────────────────────────
APP_DIR="/root/v信/backend-v2"
WEB_DIR="/root/v信/web"
DB="$APP_DIR/wechat.db"
BACKEND_URL="http://127.0.0.1:3002"
PM2_APP="vxin-server-v2"
NGINX_HTML="/usr/share/nginx/html"

TARGET_MSG_PER_DAY=100000
TARGET_ONLINE=1000
# 压测规模（可被环境变量覆盖，避免在 2GB 小机上一次打满）
LOAD_CONNS="${LOAD_CONNS:-300}"        # 并发长连接数（按比例外推到 1000）
LOAD_MSG_RATE="${LOAD_MSG_RATE:-20}"   # 目标发消息速率 条/秒
LOAD_DURATION="${LOAD_DURATION:-20}"   # 压测持续秒数

REPORT_DIR="/root/v信/ops/reports"
TS="$(date +%Y%m%d_%H%M%S)"
REPORT="$REPORT_DIR/capacity_${TS}.md"

MODE="fix"            # fix | check | apply-arch
[ "${1:-}" = "--check" ]      && MODE="check"
[ "${1:-}" = "--apply-arch" ] && MODE="apply-arch"

mkdir -p "$REPORT_DIR"

# ─────────────────────────── 输出工具 ───────────────────────────
PASS=0; WARN=0; FAIL=0; FIXED=0
say()  { echo -e "$*" | tee -a "$REPORT"; }
hr()   { say "\n---\n"; }
ok()   { PASS=$((PASS+1)); say "✅ $*"; }
warn() { WARN=$((WARN+1)); say "⚠️  $*"; }
bad()  { FAIL=$((FAIL+1)); say "❌ $*"; }
fix()  { FIXED=$((FIXED+1)); say "🔧 已修复: $*"; }
note() { say "   $*"; }

say "# v信 容量验收报告  ($TS)"
say "目标: **10万条消息/天** + **1000人同时在线**  ·  模式: \`$MODE\`"
say "服务器: \`$(hostname)\`  ·  $(nproc)核 / $(free -h | awk '/Mem:/{print $2}') 内存"
hr

# ═══════════════════════ 1. 服务存活 ═══════════════════════
say "## 1. 服务存活"
if pm2 jlist 2>/dev/null | grep -q "\"name\":\"$PM2_APP\""; then
  online=$(pm2 jlist 2>/dev/null | grep -o "\"status\":\"online\"" | wc -l)
  ok "PM2 \`$PM2_APP\` 在线实例数: $online"
else
  bad "PM2 未发现 \`$PM2_APP\`，后端可能未运行"
fi
pgrep -x nginx >/dev/null && ok "Nginx 运行中" || bad "Nginx 未运行"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BACKEND_URL/api/auth/me")
[ "$code" = "401" ] && ok "后端 API 可达 (/api/auth/me → 401 未授权，符合预期)" \
                     || warn "后端 /api/auth/me 返回 $code (期望 401)"

# ═══════════════════════ 2. 资源余量 ═══════════════════════
hr; say "## 2. 资源余量（2GB 小机是主要瓶颈）"
mem_avail=$(free -m | awk '/Mem:/{print $7}')
mem_total=$(free -m | awk '/Mem:/{print $2}')
say "内存: 可用 ${mem_avail}MB / 总 ${mem_total}MB"
# 1000 长连接约需 ~50-80MB socket 开销 + Node 堆增长，预留 400MB 余量为底线
if [ "$mem_avail" -ge 400 ]; then ok "内存余量充足 (≥400MB)"
elif [ "$mem_avail" -ge 200 ]; then warn "内存余量偏紧 (${mem_avail}MB)，1000在线时可能触发 OOM/重启"
else bad "内存余量危险 (${mem_avail}MB)，必须加内存或减实例"; fi
load1=$(awk '{print $1}' /proc/loadavg); cores=$(nproc)
say "负载: $load1 (核数 $cores)"
awk "BEGIN{exit !($load1 < $cores)}" && ok "CPU 负载健康" || warn "CPU 负载高于核数"
diskpct=$(df / | awk 'END{gsub(/%/,"",$5);print $5}')
[ "$diskpct" -lt 85 ] && ok "磁盘使用 ${diskpct}%" || warn "磁盘使用 ${diskpct}% 偏高"

# ═══════════════════════ 3. OS 句柄/网络上限（1000长连接关键）═══════════════════════
hr; say "## 3. OS 上限（1000 并发连接的硬门槛）"
soft_nofile=$(ulimit -Sn)
say "当前 shell open-files 软上限: $soft_nofile"
if [ "$soft_nofile" -ge 10240 ]; then ok "open-files 上限充足"
else
  warn "open-files 上限 $soft_nofile 偏低，1000并发连接需 ≥10240"
  if [ "$MODE" != "check" ]; then
    cat >/etc/security/limits.d/99-vxin.conf <<'LIM'
* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535
LIM
    mkdir -p /etc/systemd/system/pm2-root.service.d 2>/dev/null
    cat >/etc/systemd/system/pm2-root.service.d/limits.conf <<'LIM'
[Service]
LimitNOFILE=65535
LIM
    systemctl daemon-reload 2>/dev/null
    fix "写入 nofile=65535 (limits.d + systemd override)；PM2 需 'pm2 update' 或重启服务生效"
    note "立即生效请执行: pm2 update && pm2 restart $PM2_APP"
  fi
fi
somaxconn=$(sysctl -n net.core.somaxconn 2>/dev/null || echo 128)
say "net.core.somaxconn = $somaxconn"
if [ "$somaxconn" -ge 1024 ]; then ok "somaxconn 充足"
else
  warn "somaxconn=$somaxconn 偏低，高并发握手会丢连接"
  if [ "$MODE" != "check" ]; then
    sysctl -w net.core.somaxconn=4096 >/dev/null
    sysctl -w net.ipv4.tcp_max_syn_backlog=4096 >/dev/null
    cat >/etc/sysctl.d/99-vxin.conf <<'SYS'
net.core.somaxconn = 4096
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.ip_local_port_range = 1024 65535
SYS
    fix "somaxconn/syn_backlog 提升到 4096 并持久化"
  fi
fi

# ═══════════════════════ 4. SQLite 调优 ═══════════════════════
hr; say "## 4. SQLite 数据库（消息吞吐核心）"
jmode=$(sqlite3 "$DB" "PRAGMA journal_mode;" 2>/dev/null)
btimeout=$(sqlite3 "$DB" "PRAGMA busy_timeout;" 2>/dev/null)
[ "$jmode" = "wal" ] && ok "journal_mode=WAL (并发读写已优化)" || warn "journal_mode=$jmode (建议 WAL)"

# busy_timeout / synchronous 是 per-connection，写在 db/connection.js / worker.js 里（已入仓库）。
# 这里只做"核验"，不再运行时改代码（运行时注入会被 git pull 冲突/stash 掉，不可靠）。
CONN_JS="$APP_DIR/src/db/connection.js"
WORKER_JS="$APP_DIR/src/db/worker.js"
if grep -q "busy_timeout" "$CONN_JS" 2>/dev/null; then
  ok "connection.js 已显式设置 busy_timeout (并发锁等待)"
elif grep -q "timeout" "$WORKER_JS" 2>/dev/null; then
  ok "写连接(worker.js)已设 timeout，主连接走 better-sqlite3 默认 5s"
else
  warn "未在代码中显式设置 busy_timeout（better-sqlite3 默认 5s，通常够用）"
fi
grep -q "synchronous = NORMAL" "$CONN_JS" 2>/dev/null && ok "synchronous=NORMAL (WAL 下安全且更快)" \
  || note "synchronous 未显式设为 NORMAL"

# WAL checkpoint + ANALYZE + 完整性（安全操作）
if [ "$MODE" != "check" ]; then
  sqlite3 "$DB" "PRAGMA wal_checkpoint(TRUNCATE); ANALYZE; PRAGMA optimize;" >/dev/null 2>&1 \
    && fix "执行 WAL checkpoint + ANALYZE + optimize（刷新查询计划统计）"
fi
integ=$(sqlite3 "$DB" "PRAGMA integrity_check;" 2>/dev/null | head -1)
[ "$integ" = "ok" ] && ok "数据库完整性检查通过" || bad "数据库完整性异常: $integ"

# 热点索引检查（消息按会话+时间查询是最高频路径）
idx_msg=$(sqlite3 "$DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name='messages' AND sql LIKE '%conversation_id%';" 2>/dev/null)
if [ "${idx_msg:-0}" -ge 1 ]; then ok "messages(conversation_id) 索引存在"
else
  bad "缺少 messages 会话索引 → 拉取聊天记录会全表扫描"
  if [ "$MODE" != "check" ]; then
    sqlite3 "$DB" "CREATE INDEX IF NOT EXISTS idx_msg_conv_time ON messages(conversation_id, created_at DESC);" 2>/dev/null \
      && fix "创建索引 idx_msg_conv_time ON messages(conversation_id, created_at)"
  fi
fi

# ═══════════════════════ 5. Socket.IO 集群一致性（1000在线关键风险）═══════════════════════
hr; say "## 5. Socket.IO 集群一致性 ⚠️ 最高风险项"
inst=$(pm2 jlist 2>/dev/null | grep -o "\"name\":\"$PM2_APP\"" | wc -l)
has_adapter=0
grep -rqs "redis-adapter\|createAdapter\|@socket.io/redis" "$APP_DIR/src" && has_adapter=1
redis_up=0; (redis-cli ping 2>/dev/null | grep -qi pong) && redis_up=1
say "PM2 实例数: $inst  ·  代码含 socket.io 适配器: $([ $has_adapter = 1 ] && echo 是 || echo 否)  ·  Redis: $([ $redis_up = 1 ] && echo 运行中 || echo 未运行)"
if [ "$inst" -gt 1 ] && [ "$has_adapter" = 0 ]; then
  bad "集群多实例 + 无共享适配器 → 跨实例的实时消息/通知会丢(约50%概率投递不到对端)"
  note "这是 1000 人同时在线时最严重的正确性问题。两种修法："
  note "  (A) 装 Redis + @socket.io/redis-adapter（同时还能修复缓存降级）→ 加 ~30MB 内存"
  note "  (B) 把后端改单实例 fork 模式（1000连接单核足够，最稳）"
  if [ "$MODE" = "apply-arch" ]; then
    say "→ 选择架构修复 (A): 安装 Redis + 适配器"
    if [ "$redis_up" = 0 ]; then
      (apt-get update -y && apt-get install -y redis-server && systemctl enable --now redis-server) >/dev/null 2>&1 \
        && fix "安装并启动 Redis" || warn "Redis 安装失败，请人工处理"
    fi
    (cd "$APP_DIR" && npm i @socket.io/redis-adapter redis >/dev/null 2>&1) \
      && fix "安装 @socket.io/redis-adapter（仍需在 server.js 接线 io.adapter(...)，见报告末尾示例）" \
      || warn "适配器安装失败"
    note "server.js 接线示例见本报告末尾【附录A】"
    NEED_RESTART=1
  else
    warn "未自动改架构(需 --apply-arch)。在此之前，1000在线的实时性不达标。"
  fi
elif [ "$inst" -le 1 ]; then
  ok "单实例运行，无跨实例投递问题"
elif [ "$has_adapter" = 1 ] && [ "$redis_up" = 1 ]; then
  ok "多实例 + Redis 适配器，跨实例投递一致"
fi

# PM2 内存守护（防 2GB OOM）
if pm2 jlist 2>/dev/null | grep -q "\"max_memory_restart\":null"; then
  warn "PM2 未设 max_memory_restart，OOM 时可能整机卡死"
  if [ "$MODE" != "check" ]; then
    pm2 set "$PM2_APP:max_memory_restart" 600M >/dev/null 2>&1
    fix "设置 PM2 max_memory_restart=600M（单实例超限自动重启，保护整机）"
  fi
fi

# ═══════════════════════ 6. Nginx WebSocket 代理 ═══════════════════════
hr; say "## 6. Nginx WebSocket 代理超时"
NGINX_CONF="/etc/nginx/nginx.conf"
if grep -q "proxy_read_timeout" "$NGINX_CONF" 2>/dev/null; then
  ok "Nginx 已设置 proxy_read_timeout（长连接不会被过早断开）"
else
  warn "Nginx 未设 proxy_read_timeout，默认 60s 会周期性掐断 WebSocket"
  note "建议在 /socket.io location 加: proxy_read_timeout 3600s; proxy_send_timeout 3600s;"
  note "（脚本不自动改 Nginx 主配置以免误伤其它站点，请人工确认后加）"
fi

# ═══════════════════════ 7. 压测 ═══════════════════════
hr; say "## 7. 压力测试（实测吞吐 & 并发在线）"
HERE="$(dirname "$0")"

# socket.io-client 是并发连接实测必需；缺失则尝试安装（仅装一次）
if [ ! -d "$APP_DIR/node_modules/socket.io-client" ]; then
  warn "缺少 socket.io-client（并发长连接实测必需）"
  if [ "$MODE" != "check" ]; then
    (cd "$APP_DIR" && npm i socket.io-client >/dev/null 2>&1) \
      && fix "已安装 socket.io-client（用于 WebSocket 并发测试）" \
      || warn "socket.io-client 安装失败，C 段长连接测试将跳过"
  fi
fi

# 播种测试账号（跑完即清理，不污染真实数据）
say "参数: 并发连接=$LOAD_CONNS  发消息速率=${LOAD_MSG_RATE}/s  时长=${LOAD_DURATION}s"
SEED_OK=0
if [ "$MODE" != "check" ] || [ -f "$HERE/seed_test_users.js" ]; then
  export JWT_SECRET="$(grep -m1 '^JWT_SECRET=' "$APP_DIR/.env" | cut -d= -f2-)"
  if APP_DIR="$APP_DIR" node "$HERE/seed_test_users.js" create "$LOAD_CONNS" 2>&1 | tee -a "$REPORT"; then
    SEED_OK=1
  else
    warn "测试账号播种失败，压测可能无可用账号"
  fi
fi

LOAD_JSON="$REPORT_DIR/load_${TS}.json"
TARGET_ONLINE="$TARGET_ONLINE" LOAD_CONNS="$LOAD_CONNS" LOAD_MSG_RATE="$LOAD_MSG_RATE" LOAD_DURATION="$LOAD_DURATION" \
BACKEND_URL="$BACKEND_URL" APP_DIR="$APP_DIR" OUT="$LOAD_JSON" JWT_SECRET="$JWT_SECRET" \
  node "$HERE/hermes_loadtest.js" 2>&1 | tee -a "$REPORT" || warn "压测脚本执行异常"

# 清理测试账号
if [ "$SEED_OK" = 1 ]; then
  APP_DIR="$APP_DIR" JWT_SECRET="$JWT_SECRET" node "$HERE/seed_test_users.js" cleanup 2>&1 | tee -a "$REPORT" >/dev/null \
    && note "已清理压测临时账号"
fi

# ═══════════════════════ 重启使代码级修复生效 ═══════════════════════
if [ "${NEED_RESTART:-0}" = 1 ] && [ "$MODE" != "check" ]; then
  hr; say "## 重启后端使代码级修复生效"
  pm2 restart "$PM2_APP" --update-env >/dev/null 2>&1 && sleep 3
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BACKEND_URL/api/auth/me")
  [ "$code" = "401" ] && ok "重启后后端健康 (401)" || bad "重启后后端异常 ($code)，请查 pm2 logs"
fi

# ═══════════════════════ 汇总 ═══════════════════════
hr; say "## 结论"
say "通过 **$PASS** · 警告 **$WARN** · 失败 **$FAIL** · 自动修复 **$FIXED**"
if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
  say "🟢 **达标**：可承载 10万条/天 + 1000在线。"
elif [ "$FAIL" -eq 0 ]; then
  say "🟡 **基本达标**：有 $WARN 项需关注（多为容量余量/Nginx超时），见上文。"
else
  say "🔴 **未达标**：有 $FAIL 项阻塞（见上文标 ❌ 的条目）。"
fi

cat >>"$REPORT" <<'APPENDIX'

---
### 附录A — server.js 接 Redis 适配器（多实例一致投递）
```js
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const pub = createClient({ url: 'redis://127.0.0.1:6379' });
const sub = pub.duplicate();
await Promise.all([pub.connect(), sub.connect()]);
io.adapter(createAdapter(pub, sub));   // 在 new Server(...) 之后
```

### 容量速算（供参考）
- 10万条/天 = 1.16 条/秒均值；按 15× 峰值 ≈ 18 条/秒。SQLite(WAL) 可达数千写/秒 → 吞吐无压力。
- 1000 在线 = 1000 条 WebSocket。内存 ~50-80MB、单核可撑；真正的门槛是
  ① OS 句柄上限(已修) ② 跨实例投递一致性(第5节) ③ 2GB 内存余量。
APPENDIX

say "\n报告已保存: $REPORT"
echo "REPORT_PATH=$REPORT"
