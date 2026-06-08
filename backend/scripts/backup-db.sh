#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_FILE="$SCRIPT_DIR/../wechat.db"
BACKUP_DIR="$SCRIPT_DIR/../backup"
KEEP=30

mkdir -p "$BACKUP_DIR"

if [[ ! -f "$DB_FILE" ]]; then
  echo "[backup] ERROR: $DB_FILE not found" >&2
  exit 1
fi

TIMESTAMP=$(date +"%Y-%m-%d-%H%M")
DEST="$BACKUP_DIR/wechat-$TIMESTAMP.db"

# 使用 SQLite .backup 命令，保证热备份一致性（WAL 模式安全）
sqlite3 "$DB_FILE" ".backup '$DEST'"

echo "[backup] Created: $DEST ($(du -h "$DEST" | cut -f1))"

# 保留最近 KEEP 份，删除旧备份
EXISTING=$(ls -t "$BACKUP_DIR"/wechat-*.db 2>/dev/null | wc -l)
if [[ $EXISTING -gt $KEEP ]]; then
  ls -t "$BACKUP_DIR"/wechat-*.db | tail -n +$((KEEP + 1)) | while read -r old; do
    rm -f "$old"
    echo "[backup] Deleted old: $old"
  done
fi

echo "[backup] Done. Total backups: $(ls "$BACKUP_DIR"/wechat-*.db 2>/dev/null | wc -l)/$KEEP"
