#!/bin/bash
#
# orderSYS 中央備份主機 (VPS) 初始化腳本
# ---------------------------------------------------------------------------
# 用途：
#   * 安裝備份接收所需套件 (postgresql-client；rsync/sqlite3 若缺)
#   * 建立 /backups 目錄結構與專用推檔帳號 (posbackup)
#   * 建立 SQLite 索引資料庫，記錄各分店備份 (Menu/License/營業數/POS 設定)
#   * 安裝索引 / 監控 / 加店 / OpenVPN 用戶端產生 等輔助腳本
#   * 設定 cron：定期索引 + 每日監控 (磁碟 / 備份新鮮度)
#   * 複用既有 OpenVPN (10.8.0.0/24)，並將推檔帳號限制為僅 VPN 網段可登入
#
# 用法：
#   sudo ./vps-central-init.sh
#
# 可覆寫的環境變數（選擇性）：
#   RESTRICT_PUSH_USER_TO_VPN=0   # 0 表示不把 posbackup 限制在 VPN 網段
#   DISK_ALERT_PCT=85             # 磁碟使用率警戒門檻
#   STALE_DAYS=3                  # 分店備份超過 N 天未更新即告警
#
# 安全：腳本為冪等 (可重複執行)、非破壞性，不會動到既有 Docker / 1Panel / OpenVPN。
# ---------------------------------------------------------------------------

set -euo pipefail

BACKUP_ROOT="/backups"
INDEX_DIR="${BACKUP_ROOT}/.index"
SCRIPTS_DIR="${BACKUP_ROOT}/.scripts"
LOGS_DIR="${BACKUP_ROOT}/.logs"
INDEX_DB="${INDEX_DIR}/index.sqlite3"
PUSH_USER="posbackup"
VPN_NET="10.8.0.0/24"
DISK_ALERT_PCT="${DISK_ALERT_PCT:-85}"
STALE_DAYS="${STALE_DAYS:-3}"
RESTRICT_PUSH_USER_TO_VPN="${RESTRICT_PUSH_USER_TO_VPN:-1}"
SSHD_MARKER="# orderSYS central backup push user"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()  { printf '    \033[0;32m✓ %s\033[0m\n' "$*"; }
warn(){ printf '    \033[0;33m⚠ %s\033[0m\n' "$*"; }

# --- 以 root 執行 ---------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    exec sudo bash "$0" "$@"
  fi
  echo "錯誤：請以 root 執行，或授予 sudo 免密權限：sudo $0" >&2
  exit 1
fi

log "[1/8] 安裝套件 (postgresql-client / rsync / sqlite3)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null
apt-get install -y --no-install-recommends postgresql-client rsync sqlite3 >/dev/null
ok "postgresql-client: $(psql --version 2>/dev/null || echo ok)"
ok "rsync: $(rsync --version 2>/dev/null | head -1)"
ok "sqlite3: $(sqlite3 --version)"

log "[2/8] 建立 /backups 目錄結構"
mkdir -p "${BACKUP_ROOT}"
# 專用推檔帳號：home 指向 /backups（帳號已存在則略過建立）
if ! id -u "${PUSH_USER}" >/dev/null 2>&1; then
  useradd -r -m -d "${BACKUP_ROOT}" -s /bin/bash -c "orderSYS branch backup push" "${PUSH_USER}"
  ok "建立帳號 ${PUSH_USER}"
else
  ok "帳號 ${PUSH_USER} 已存在，略過建立"
fi
chown "${PUSH_USER}:${PUSH_USER}" "${BACKUP_ROOT}"
mkdir -p "${INDEX_DIR}" "${SCRIPTS_DIR}" "${LOGS_DIR}"
# .ssh 供分店公鑰授權登入
install -d -o "${PUSH_USER}" -g "${PUSH_USER}" -m 700 "${BACKUP_ROOT}/.ssh"
touch "${BACKUP_ROOT}/.ssh/authorized_keys"
chown "${PUSH_USER}:${PUSH_USER}" "${BACKUP_ROOT}/.ssh/authorized_keys"
chmod 600 "${BACKUP_ROOT}/.ssh/authorized_keys"
ok "備份根目錄: ${BACKUP_ROOT}"
ok "索引目錄:   ${INDEX_DIR}"
ok "腳本目錄:   ${SCRIPTS_DIR}"
ok "日誌目錄:   ${LOGS_DIR}"

log "[3/8] 建立 SQLite 索引資料庫"
sqlite3 "${INDEX_DB}" <<'SQL'
CREATE TABLE IF NOT EXISTS branches (
  branch_id  TEXT PRIMARY KEY,
  name       TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_seen  TEXT
);
CREATE TABLE IF NOT EXISTS backups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id   TEXT NOT NULL,
  filename    TEXT NOT NULL,
  filepath    TEXT NOT NULL,
  size_bytes  INTEGER,
  sha256      TEXT,
  backup_type TEXT,
  mtime       TEXT,
  indexed_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(branch_id, filename)
);
CREATE INDEX IF NOT EXISTS idx_backups_branch ON backups(branch_id);
CREATE INDEX IF NOT EXISTS idx_backups_mtime  ON backups(mtime);
SQL
chown root:root "${INDEX_DB}"
ok "索引資料庫: ${INDEX_DB}"

log "[4/8] 安裝輔助腳本"

cat > "${SCRIPTS_DIR}/index.sh" <<'EOF'
#!/bin/bash
# 掃描 /backups/*/ 下的備份檔，更新 SQLite 索引。
set -euo pipefail
BACKUP_ROOT="/backups"
INDEX_DB="/backups/.index/index.sqlite3"
COMPUTE_SHA256="${COMPUTE_SHA256:-0}"   # 大檔 (>10GB) 預設不計算 sha256

find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 2 -type f \
  -not -path "${BACKUP_ROOT}/.*" \
  -not -path "${BACKUP_ROOT}/.*/*" \
  -print0 | while IFS= read -r -d '' f; do
    rel="${f#${BACKUP_ROOT}/}"
    branch="${rel%%/*}"
    [ "$branch" = "$rel" ] && continue          # 根目錄下的散檔略過
    case "$branch" in .*) continue;; esac        # 略過隱藏目錄 (.index/.scripts/.cache 等)
    filename="$(basename "$f")"
    size="$(stat -c %s "$f" 2>/dev/null || echo 0)"
    mtime="$(date -r "$f" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date '+%Y-%m-%d %H:%M:%S')"

    old_size="$(sqlite3 "${INDEX_DB}" "SELECT size_bytes FROM backups WHERE branch_id='${branch}' AND filename='${filename}';")"
    sha=""
    if [ "${COMPUTE_SHA256}" = "1" ] && [ "${old_size}" != "${size}" ]; then
      sha="$(sha256sum "$f" | awk '{print $1}')"
    fi

    sqlite3 "${INDEX_DB}" <<SQL
INSERT INTO backups (branch_id, filename, filepath, size_bytes, sha256, mtime)
VALUES ('${branch}', '${filename}', '${f}', ${size}, '${sha}', '${mtime}')
ON CONFLICT(branch_id, filename) DO UPDATE SET
  size_bytes=${size},
  sha256=CASE WHEN '${sha}'='' THEN backups.sha256 ELSE '${sha}' END,
  mtime='${mtime}',
  indexed_at=datetime('now');
SQL
  done

# 更新各分店最後更新時間
sqlite3 "${INDEX_DB}" <<'SQL'
UPDATE branches
SET last_seen = (SELECT MAX(mtime) FROM backups WHERE backups.branch_id = branches.branch_id)
WHERE EXISTS (SELECT 1 FROM backups WHERE backups.branch_id = branches.branch_id);
SQL
echo "$(date '+%F %T') index done"
EOF

cat > "${SCRIPTS_DIR}/monitor.sh" <<'EOF'
#!/bin/bash
# 監控：磁碟使用率 + 各分店備份新鮮度。
set -euo pipefail
BACKUP_ROOT="/backups"
INDEX_DB="/backups/.index/index.sqlite3"
DISK_ALERT_PCT="${DISK_ALERT_PCT:-85}"
STALE_DAYS="${STALE_DAYS:-3}"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"

alerts=""
pct="$(df "${BACKUP_ROOT}" | awk 'NR==2{gsub(/%/,"",$5); print $5}')"
if [ -n "${pct}" ] && [ "${pct}" -ge "${DISK_ALERT_PCT}" ]; then
  alerts="${alerts}[磁碟] 使用率 ${pct}% >= ${DISK_ALERT_PCT}%\n"
fi

while IFS='|' read -r branch last_seen; do
  [ -z "$branch" ] && continue
  if [ -z "$last_seen" ]; then
    alerts="${alerts}[備份] 分店 ${branch} 尚無備份記錄\n"
  else
    age_days=$(( ($(date +%s) - $(date -d "$last_seen" +%s)) / 86400 ))
    if [ "$age_days" -ge "${STALE_DAYS}" ]; then
      alerts="${alerts}[備份] 分店 ${branch} 已 ${age_days} 天未更新 (最後: ${last_seen})\n"
    fi
  fi
done < <(sqlite3 "${INDEX_DB}" "SELECT branch_id, COALESCE(last_seen,'') FROM branches;")

ts="$(date '+%F %T')"
if [ -n "$alerts" ]; then
  echo -e "${ts} WARN\n${alerts}"
  if [ -n "${ALERT_WEBHOOK}" ]; then
    curl -fsS -X POST -H 'Content-Type: application/json' \
      -d "{\"text\":\"orderSYS central backup alert\n${alerts}\"}" \
      "${ALERT_WEBHOOK}" >/dev/null 2>&1 || true
  fi
else
  echo "${ts} OK disk=${pct}%"
fi
EOF

cat > "${SCRIPTS_DIR}/add-branch.sh" <<'EOF'
#!/bin/bash
# 新增分店：建立推檔目錄並授權一把 SSH 公鑰。
# 用法：add-branch.sh <branch_id> [公鑰或公鑰檔案路徑]
set -euo pipefail
BACKUP_ROOT="/backups"
PUSH_USER="posbackup"
BRANCH="${1:?用法: add-branch.sh <branch_id> [公鑰]}"
KEY="${2:-}"

install -d -o "${PUSH_USER}" -g "${PUSH_USER}" -m 750 "${BACKUP_ROOT}/${BRANCH}"
sqlite3 "${BACKUP_ROOT}/.index/index.sqlite3" \
  "INSERT INTO branches(branch_id) VALUES('${BRANCH}') ON CONFLICT(branch_id) DO NOTHING;"

if [ -n "$KEY" ]; then
  if [ -f "$KEY" ]; then
    KEY="$(cat "$KEY")"
  fi
  grep -qxF "$KEY" "${BACKUP_ROOT}/.ssh/authorized_keys" 2>/dev/null \
    || echo "$KEY" >> "${BACKUP_ROOT}/.ssh/authorized_keys"
  chown "${PUSH_USER}:${PUSH_USER}" "${BACKUP_ROOT}/.ssh/authorized_keys"
  chmod 600 "${BACKUP_ROOT}/.ssh/authorized_keys"
  echo "已授權公鑰"
fi
echo "分店目錄就緒: ${BACKUP_ROOT}/${BRANCH}"
echo "推檔範例 (於分店機):"
echo "  rsync -avz --remove-source-files /local/backup/ordersys.dump ${PUSH_USER}@10.8.0.1:${BRANCH}/"
EOF

cat > "${SCRIPTS_DIR}/gen-openvpn-client.sh" <<'EOF'
#!/bin/bash
# 產生 OpenVPN 用戶端 .ovpn（供分店連入 VPN，推送備份）。
# 用法：gen-openvpn-client.sh <client-name>
set -euo pipefail
EASYRSA_DIR="/etc/openvpn/server/easy-rsa"
SERVER_DIR="/etc/openvpn/server"
OUT_DIR="/backups/.vpnclients"
NAME="${1:?用法: gen-openvpn-client.sh <client-name>}"

mkdir -p "${OUT_DIR}"
cd "${EASYRSA_DIR}"
[ -f "pki/issued/${NAME}.crt" ] || {
  EASYRSA_BATCH=1 EASYRSA_REQ_CN="${NAME}" ./easyrsa gen-req "${NAME}" nopass
  EASYRSA_BATCH=1 ./easyrsa sign-req client "${NAME}"
}

{
  cat "${SERVER_DIR}/client-common.txt"
  echo "<ca>";  cat "${SERVER_DIR}/ca.crt";   echo "</ca>"
  echo "<cert>"; cat "${EASYRSA_DIR}/pki/issued/${NAME}.crt"; echo "</cert>"
  echo "<key>";  cat "${EASYRSA_DIR}/pki/private/${NAME}.key"; echo "</key>"
  echo "<tls-crypt>"; cat "${SERVER_DIR}/tc.key"; echo "</tls-crypt>"
} > "${OUT_DIR}/${NAME}.ovpn"
chmod 600 "${OUT_DIR}/${NAME}.ovpn"
echo "已產生: ${OUT_DIR}/${NAME}.ovpn"
EOF

cat > "${SCRIPTS_DIR}/restore.sh" <<'EOF'
#!/bin/bash
# 將各分店最新 pg_dump 還原成 branch_<id> 資料庫（供儀表板唯讀查詢）。
# 冪等：僅在 dump 檔案變更（mtime+size 改變）時才 DROP/CREATE/restore。
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
EOF

chmod 755 "${SCRIPTS_DIR}"/*.sh
chown -R root:root "${SCRIPTS_DIR}"
ok "已安裝: $(ls "${SCRIPTS_DIR}" | tr '\n' ' ')"

log "[5/8] 設定 cron（索引每 30 分鐘、還原每 30 分鐘、監控每日 07:00）"
if ! crontab -l 2>/dev/null | grep -q 'orderSYS-central-backup'; then
  ( crontab -l 2>/dev/null || true
    echo '# orderSYS-central-backup'
    echo "*/30 * * * * ${SCRIPTS_DIR}/index.sh >> ${LOGS_DIR}/index.log 2>&1"
    echo "*/30 * * * * ${SCRIPTS_DIR}/restore.sh >> ${LOGS_DIR}/restore.log 2>&1"
    echo "0 7 * * * ${SCRIPTS_DIR}/monitor.sh >> ${LOGS_DIR}/monitor.log 2>&1"
  ) | crontab -
  ok "cron 已安裝"
else
  ok "cron 已存在，略過"
fi

log "[6/8] 限制推檔帳號 ${PUSH_USER} 僅能由 VPN 網段登入"
if [ "${RESTRICT_PUSH_USER_TO_VPN}" = "1" ]; then
  if ! grep -qF "${SSHD_MARKER}" /etc/ssh/sshd_config; then
    cat >> /etc/ssh/sshd_config <<EOF

${SSHD_MARKER}
Match User ${PUSH_USER} Address ${VPN_NET}
    PasswordAuthentication no
    PubkeyAuthentication yes
    X11Forwarding no
    AllowTcpForwarding no
EOF
    if sshd -t; then
      systemctl reload ssh
      ok "已限制 ${PUSH_USER} 僅限 ${VPN_NET}"
    else
      warn "sshd 設定驗證失敗，已略過 reload（請檢查 /etc/ssh/sshd_config）"
    fi
  else
    ok "sshd 限制已存在"
  fi
else
  warn "RESTRICT_PUSH_USER_TO_VPN=0，未限制登入網段"
fi

log "[7/8] OpenVPN 現況"
if ip -4 addr show tun0 >/dev/null 2>&1; then
  vpn_ip="$(ip -4 addr show tun0 | awk '/inet /{print $2}')"
  ok "OpenVPN 已啟用: tun0 ${vpn_ip}"
else
  warn "未偵測到 tun0，請確認 OpenVPN 服務是否啟動：systemctl status openvpn@server"
fi

log "[8/8] 完成"
echo ""
echo "中央備份主機初始化完成："
echo "  備份根目錄 : ${BACKUP_ROOT}（分店各一子目錄）"
echo "  推檔帳號   : ${PUSH_USER}@10.8.0.1（僅 VPN 網段，金鑰登入）"
echo "  索引資料庫 : ${INDEX_DB}"
echo "  輔助腳本   : ${SCRIPTS_DIR}/index.sh | monitor.sh | add-branch.sh | gen-openvpn-client.sh"
echo ""
echo "後續步驟："
echo "  1) 產生分店 VPN 設定 : ${SCRIPTS_DIR}/gen-openvpn-client.sh <分店名>"
echo "  2) 新增分店並授權公鑰 : ${SCRIPTS_DIR}/add-branch.sh <分店ID> 'ssh-ed25519 AAAA...'"
echo "  3) 分店每日推檔（範例，走 VPN）:"
echo "       pg_dump -Fc ordersys > /tmp/ordersys.dump"
echo "       rsync -avz /tmp/ordersys.dump ${PUSH_USER}@10.8.0.1:<分店ID>/"
