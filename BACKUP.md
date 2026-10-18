# orderSYS 備份方案說明（主機 + 副機 + 異地）

本文說明 orderSYS 的資料庫備份與容災架構，涵蓋三層備份、串流複製設定、後台備援狀態頁面，以及日常操作步驟與主機恢復方法。

> 文中密碼以 `<...>` 佔位，實際值應存放於安全位置（password manager / 離線紙本），**切勿**提交到版本庫。

---

## 1. 架構總覽

| 角色 | 主機 | OS / glibc | PostgreSQL | 資料庫狀態 |
|------|------|-----------|-----------|-----------|
| **主機（Primary）** | `192.168.3.85` | Ubuntu 25.10 / 2.42 | 17（直接安裝，systemd `postgresql@17-main`） | 可讀寫，對外提供服務 |
| **副機（Standby）** | `192.168.3.150` | Ubuntu 24.04.5 LTS / 2.39 | 17（PGDG 安裝） | 唯讀 Hot Standby，即時同步 |
| **中央備份（Offsite）** | `129.150.36.178`（VPS） | — | — | 異地離線備份（每 5 分鐘拉取） |

三層備份：

1. **串流複製**（副機 3.150）：即時、非同步，主機每筆交易即時同步到副機。
2. **每日 pg_dump**（副機 3.150 本機磁碟）：可選時點還原，保留 90 天。
3. **中央 VPS 異地備份**：跨店/異地，防現場火災/失竊等整機損失。

> 重要：複製 ≠ 備份。串流複製會「連誤刪、誤改也一併同步」。每日 pg_dump 與異地備份才是可回溯的歷史版本。

---

## 2. 串流複製設定

### 主機 3.85 端（已完成）

- `postgresql.conf`：
  - `listen_addresses = 'localhost,192.168.3.85'`（改完需 restart）
  - `wal_level = replica`（預設）、`max_wal_senders = 10`、`max_replication_slots = 10`（預設已足夠）
- `pg_hba.conf` 新增：
  ```
  host    replication     repl            192.168.3.150/32        scram-sha-256
  ```
- 建立複製帳號：
  ```sql
  CREATE ROLE repl LOGIN REPLICATION PASSWORD '<REPL_PASSWORD>';
  ```
- 後台監控所需授權（讓 app 的 `ordersys` 帳號能讀複製狀態）：
  ```sql
  GRANT pg_read_all_stats TO ordersys;
  ```

### 副機 3.150 端（已完成）

- 安裝 PG17（PGDG）。
- 以 `pg_basebackup` 建立基底並直接進入 standby：
  ```bash
  sudo -u postgres pg_basebackup -h 192.168.3.85 -p 5432 -U repl \
    -D /var/lib/postgresql/17/main -R -X stream -C -S standby_150
  ```
  - `-R` 產生 `standby.signal` 與 `postgresql.auto.conf`
  - `-C -S standby_150` 建立複製槽 `standby_150`
- `postgresql.auto.conf`（自動產生）：
  ```
  primary_conninfo = 'user=repl passfile=''/var/lib/postgresql/.pgpass'' host=192.168.3.85 port=5432 sslmode=prefer ...'
  primary_slot_name = 'standby_150'
  ```
- `/var/lib/postgresql/.pgpass`（postgres 帳號，權限 600）：
  ```
  192.168.3.85:5432:replication:repl:<REPL_PASSWORD>
  ```
- 副機以 `pg_ctlcluster 17 main start` 啟動，狀態顯示 `online,recovery`。

### 驗證

- 主機端看複製：
  ```sql
  SELECT application_name, client_addr, state, sync_state,
         pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS bytes_behind
  FROM pg_stat_replication;
  ```
  預期：`state=streaming`、`sync_state=async`、`bytes_behind=0`。
- 副機端看是否為 standby：
  ```sql
  SELECT pg_is_in_recovery();  -- 應回傳 t
  ```

---

## 3. 每日 pg_dump 備份（副機 3.150）

- 腳本：`/home/pos/backup_ordersys.sh`
- 排程：`crontab -l`（pos 帳號）
  ```
  15 4 * * * /home/pos/backup_ordersys.sh >> /home/pos/backups/ordersys/cron.log 2>&1
  ```
- 流程：
  1. 透過受限 SSH（forced command）從主機拉取 `pg_dump -Fc`（custom format）。
  2. 驗證 `PGDMP` magic。
  3. 存到 `/home/pos/backups/ordersys/ordersys_<時間>.dump`，保留 90 天。
- 主機端配套：
  - `/home/gary/bin/pg_dump_ordersys.sh`（wrapper，執行 pg_dump）
  - `~/.ssh/authorized_keys` 中 `backup-150` 金鑰綁定 `command="...",no-port-forwarding,no-pty,...`

> 副機已是唯讀 standby，因此腳本**不再**做 `pg_restore` 到本機 DB（會因唯讀失敗）。pg_dump 檔作為歷史時點備份保留。

---

## 4. 中央 VPS 異地備份

- 中央備份 dashboard：`http://129.150.36.178:888`，Python `server.py`。
- 排程：`index.sh` + `restore.sh` 每 5 分鐘執行（root crontab），`monitor.sh` 每天 07:00。
- 提供「匯出 Menu＋設定」與完整備份、還原、上傳監控等功能。
- 詳見中央主機自身設定（不在本 repo 內）。

---

## 5. 後台備援狀態頁面

- 位置：**系統維護 → 備援主機狀態**（`/admin/systemmaint` 頁面最上方）。
- 顯示：
  - 本機角色（主機/備援）
  - 已連線備援數、狀態（`streaming`/`startup`/`catchup`）、同步模式（`async`）
  - 延遲（WAL 尚未重播的位元組數）
  - 複製槽（slot）狀態與保留 WAL
- 自動 5 秒刷新，也可手動「重新整理」。
- 後端 API：`GET /api/systemmaint/replicationStatus`（僅管理員，`requireLevel(4)`）。

> 前置條件：主機需先執行 `GRANT pg_read_all_stats TO ordersys;`，否則非 superuser 讀到的欄位會是 NULL。

---

## 6. 日常操作步驟

### 6.1 每日檢查備援健康

1. 登入後台 → 系統維護，看「備援主機狀態」是否為 `streaming`、延遲是否接近 0。
2. 或 SSH 到主機，執行：
   ```bash
   sudo -u postgres psql -x -c "SELECT * FROM pg_stat_replication;"
   ```
3. 確認每日 pg_dump 有成功：
   ```bash
   # 副機 3.150
   ls -l /home/pos/backups/ordersys/ordersys_*.dump
   tail /home/pos/backups/ordersys/backup.log
   tail /home/pos/backups/ordersys/error.log
   ```

### 6.2 手動立即備份

```bash
# 副機 3.150
/home/pos/backup_ordersys.sh
```

### 6.3 重建副機（副機損毀/需重新同步）

```bash
# 副機 3.150（root / sudo）
pg_ctlcluster 17 main stop
mv /var/lib/postgresql/17/main /var/lib/postgresql/17/main.old.$(date +%Y%m%d)
mkdir -p /var/lib/postgresql/17/main && chown postgres:postgres /var/lib/postgresql/17/main && chmod 700 /var/lib/postgresql/17/main

sudo -u postgres pg_basebackup -h 192.168.3.85 -p 5432 -U repl \
  -D /var/lib/postgresql/17/main -R -X stream -C -S standby_150

pg_ctlcluster 17 main start
```

---

## 7. 主機恢復方法

### 7.1 主機整機故障 → 把副機提升為新主機（Failover）

```bash
# 副機 3.150：提升為可讀寫
sudo pg_ctlcluster 17 main promote
# 驗證
sudo -u postgres psql -tAc "SELECT pg_is_in_recovery();"   # 應回傳 f
```

接著把 orderSYS 應用的資料庫連線指向 3.150（改 `PG_CONN`/config，或直接把 3.150 接上主機原本的 IP/網路位置）。

主機修復後，再依「6.3 重建副機」方向，把 3.85 重建成新的備援（或反向 `pg_basebackup` 自 3.150 拉基底）。

> 注意：非同步複製下，promote 當下尚未重播的 WAL 會遺失。若主機還可讀取，優先先做一次 `pg_dump` 或等延遲歸零再切換。

### 7.2 主機資料誤刪/損毀（主機仍可運作）

用歷史時點備份還原：

1. 副機磁碟上的 pg_dump（最快）：
   ```bash
   # 在目標主機（先停掉 orderSYS 或切到維護）
   pg_restore --no-owner --clean --if-exists -d ordersys /path/ordersys_<時間>.dump
   ```
2. 或從中央 VPS 下載 JSON 完整備份，於後台「系統維護 → 匯入資料庫」還原。

### 7.3 重新建立主機（重灌 OS / 換機）

1. 重裝 PostgreSQL 17 與 orderSYS（見 `DEPLOY.md` / `INSTALL.md`）。
2. 以 pg_dump 還原資料：
   ```bash
   pg_restore --no-owner --clean --if-exists -d ordersys /path/ordersys_<時間>.dump
   ```
3. 或由副機反向 `pg_basebackup` 拉基底建立新主機。

---

## 8. 憑證與注意事項

- 密碼（`<REPL_PASSWORD>`、`<SUDO_PASSWORD>` 等）務必離線保管，勿提交 repo。
- 兩台主機 glibc 不同（主機 2.42 / 副機 2.39），副機查詢會出現 `collation version mismatch` 警告，**不影響 WAL 複製**；若要長期把副機當報表查詢節點，建議將兩台 OS 版本對齊。
- 複製為**非同步**（async）：極少數極端情況（主機在交易 commit 後、WAL 尚未傳送前立即損毀）可能遺失最後一兩筆交易；重要交易可在收銀後確認副機延遲為 0。
