#!/bin/bash
# orderSYS 中央備份主機：將各分店最新 pg_dump 還原成 branch_<id> 資料庫（供儀表板唯讀查詢）。
# 冪等：僅在 dump 檔案變更（mtime+size 改變）時才 DROP/CREATE/restore。
# 用法（root cron）：/backups/.scripts/restore.sh >> /backups/.logs/restore.log 2>&1
set -euo pipefail

BACKUP_ROOT="/backups"
MARKER_DIR="${BACKUP_ROOT}/.index"
PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-ordersys}"
export PGPASSWORD="${PGPASSWORD:-ordersys}"
# 分店 dump 為 PG17 格式 (1.16)，host 的 postgresql-client-16 無法讀取，
# 故 pg_restore 一律走容器內的 PG17 工具（透過 stdin 傳檔，避免掛載 /backups）。
CONTAINER="${PG_CONTAINER:-ordersys-pg17}"

mkdir -p "${MARKER_DIR}"

for dir in "${BACKUP_ROOT}"/*/; do
  branch="$(basename "$dir")"
  case "$branch" in .*) continue ;; esac

  latest="$(ls -1t "${dir}"ordersys_*.dump 2>/dev/null | head -1 || true)"
  [ -z "$latest" ] && continue

  db="branch_${branch}"
  stamp="$(stat -c '%Y %s' "$latest" 2>/dev/null || echo '0 0')"
  marker="${MARKER_DIR}/restore_${branch}.marker"

  if [ -f "$marker" ] && [ "$(cat "$marker" 2>/dev/null || true)" = "$stamp" ]; then
    continue
  fi

  psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres -t -A \
    -c "DROP DATABASE IF EXISTS \"${db}\" WITH (FORCE);" >/dev/null
  psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres -t -A \
    -c "CREATE DATABASE \"${db}\";" >/dev/null
  cat "$latest" | docker exec -i -e PGPASSWORD="${PGPASSWORD}" "${CONTAINER}" \
    pg_restore -h 127.0.0.1 -p 5432 -U "${PG_USER}" -d "${db}" --no-owner --no-privileges

  echo "$stamp" > "$marker"
  echo "$(date '+%F %T') restored ${branch} -> ${db} from $(basename "$latest")"
done

echo "$(date '+%F %T') restore scan done"
