#!/bin/bash
# Linux 一鍵還原：啟動容器 -> 等 Mongo 就緒 -> 還原備份 -> 驗證 -> 顯示服務狀態
# 用法：
#   ./deploy-restore.sh [backup.json] [--append] [--collections=a,b,c] [--skip-build] [--no-restore]
# 範例：
#   ./deploy-restore.sh
#   ./deploy-restore.sh my_backup.json --append
set -e

BACKUP="full_backup_20260914_100417.json"
APPEND_FLAG=""
COLLECTIONS_FLAG=""
SKIP_BUILD=0
DO_RESTORE=1

for arg in "$@"; do
  case "$arg" in
    --append) APPEND_FLAG="--append" ;;
    --collections=*) COLLECTIONS_FLAG="$arg" ;;
    --skip-build) SKIP_BUILD=1 ;;
    --no-restore) DO_RESTORE=0 ;;
    --help|-h)
      echo "用法: $0 [backup.json] [--append] [--collections=a,b,c] [--skip-build] [--no-restore]"
      exit 0 ;;
    *) BACKUP="$arg" ;;
  esac
done

cd "$(dirname "$0")"

if [ ! -f "$BACKUP" ]; then
  echo "錯誤：備份文件不存在: $BACKUP"
  exit 1
fi

# 先檢查 Docker：已安裝就跳過，未安裝才自動安裝（Ubuntu/Debian）
if command -v docker >/dev/null 2>&1; then
  echo "==> Docker 已安裝，略過安裝"
else
  echo "==> 未安裝 Docker，開始安裝 docker.io / docker-compose ..."
  sudo apt-get update
  sudo apt-get install -y docker.io docker-compose docker-compose-plugin
  sudo systemctl enable --now docker
fi
docker compose version >/dev/null 2>&1 || { echo "錯誤：找不到 docker compose 插件（docker-compose-plugin）"; exit 1; }

echo "==> [1/5] 啟動容器..."
if [ "$SKIP_BUILD" = "1" ]; then
  docker compose up -d
else
  docker compose up -d --build
fi

echo "==> [2/5] 等待 MongoDB 就緒..."
for i in $(seq 1 30); do
  if docker compose exec -T mongo mongosh --quiet --eval "db.runCommand({ping:1})" >/dev/null 2>&1; then
    echo "    MongoDB 已就緒"
    break
  fi
  if [ "$i" = "30" ]; then
    echo "錯誤：MongoDB 30 秒內未就緒"
    docker compose logs --tail=30 mongo
    exit 1
  fi
  sleep 1
done

if [ "$DO_RESTORE" = "1" ]; then
  echo "==> [3/5] 還原備份: $BACKUP ..."
  # 備份文件掛載為容器內 /seed/backup.json；若用戶指定了其他文件，先拷貝進容器
  if [ "$BACKUP" = "full_backup_20260914_100417.json" ]; then
    IN_CONTAINER="/seed/backup.json"
  else
    BASENAME=$(basename "$BACKUP")
    docker compose cp "$BACKUP" "app:/tmp/$BASENAME"
    IN_CONTAINER="/tmp/$BASENAME"
  fi
  docker compose exec -T app node restore.js "$IN_CONTAINER" $APPEND_FLAG $COLLECTIONS_FLAG

  echo "==> [4/5] 驗證還原結果..."
  docker compose exec -T mongo mongosh --quiet orderSYS --eval '
    var cols = db.getCollectionNames();
    var kept = cols.filter(function(c) { return c.substring(0, 7) == "system." ? false : true; });
    var total = 0;
    kept.forEach(function(c) { var n = db.getCollection(c).countDocuments(); total = total + n; print("  " + c + ": " + n); });
    print("共 " + kept.length + " 個集合，" + total + " 筆資料");
  '
else
  echo "==> [3/5] 跳過還原（--no-restore）"
  echo "==> [4/5] 跳過驗證"
fi

echo "==> [5/5] 服務狀態..."
docker compose ps
echo ""
echo "完成！前端/後端: http://<主機IP>:3000"
echo "登入帳號: admin1 / admin123（如備份中所存）"
