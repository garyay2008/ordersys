#!/bin/bash
# 分店端每日備份腳本：pg_dump 本機 PostgreSQL → rsync 到中央 VPS（走 SSH/rsync，無需 VPN）
# 用法：BRANCH_ID=hifi360 SSH_KEY=/home/gary/.ssh/backup ./branch-backup.sh
set -euo pipefail

BRANCH_ID="${BRANCH_ID:-${1:-}}"
if [ -z "$BRANCH_ID" ]; then
  echo "用法: BRANCH_ID=<分店ID> $0" >&2
  exit 1
fi

export PGPASSWORD="${PGPASSWORD:-ordersys}"
PGHOST="${PGHOST:-127.0.0.1}"
PGUSER="${PGUSER:-ordersys}"
PGDATABASE="${PGDATABASE:-ordersys}"

BACKUP_DIR="${BACKUP_DIR:-$HOME/orderSYS-backups}"
REMOTE_USER="${REMOTE_USER:-posbackup}"
REMOTE_HOST="${REMOTE_HOST:-129.150.36.178}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -i $SSH_KEY"
KEEP_DAYS="${KEEP_DAYS:-7}"

TS="$(date +%Y%m%d_%H%M%S)"
FILE="ordersys_${TS}.dump"
mkdir -p "$BACKUP_DIR"

pg_dump -Fc -h "$PGHOST" -U "$PGUSER" "$PGDATABASE" -f "$BACKUP_DIR/$FILE"

# rrsync 已用 forced-command 限制在 /backups/<BRANCH_ID>，故遠端路徑留空（host:）
rsync -az -e "ssh $SSH_OPTS" "$BACKUP_DIR/$FILE" "${REMOTE_USER}@${REMOTE_HOST}:"

find "$BACKUP_DIR" -name "ordersys_*.dump" -mtime +"$KEEP_DAYS" -delete 2>/dev/null || true

echo "$(date '+%F %T') backup ok: $FILE -> ${REMOTE_HOST}:${BRANCH_ID}/"
