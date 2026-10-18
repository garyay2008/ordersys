# orderSYS 部署指引（直接安裝 / 非 Docker）

本文件說明如何在 POS 主機上直接安裝 orderSYS（Node.js + PostgreSQL），適用 Windows、Linux（Ubuntu）及 macOS。

> 若使用 Docker，請參考 `docker-compose.yml`（PostgreSQL + App + Redis），執行 `docker compose up -d --build`。列印直接以網路打印機 `ip:9100` 直連（`plugins/Printer.js`），並經 BullMQ + Redis 出單佇列（`plugins/printQueue.js`）串行出單。

## 0. 共通步驟（三個平台都要做）

假設專案放在固定資料夾，之後不要移動（例如 Windows `C:\orderSYS`、Linux `/opt/orderSYS`、macOS `~/orderSYS`）。

```bash
# 1) 進入 client 建前端（產生 client/dist）
cd client
npm install
npm run build
cd ..

# 2) 裝後端依賴
npm install

# 3) 啟動（測試用，先確認能跑）
node server.js
# 看到「Server is running ... Url:http://0.0.0.0:3000」即成功
```

環境變數（可選，預設已可用）：

- `PG_CONN=postgres://ordersys:ordersys@127.0.0.1:5432/ordersys`
- `JWT_SECRET=0x3E5`
- `NODE_ENV=production`
- `REDIS_URL=redis://127.0.0.1:6379`（選用：BullMQ 出單佇列；未設時降級為 in-memory FIFO）

PostgreSQL 初始化（首次安裝需建立資料庫與使用者，對應預設連線字串 `postgres://ordersys:ordersys@127.0.0.1:5432/ordersys`）：

```bash
# Linux（Debian/Ubuntu）
sudo -u postgres psql -c "CREATE USER ordersys WITH PASSWORD 'ordersys';" -c "CREATE DATABASE ordersys OWNER ordersys;"

# macOS（Homebrew）
psql postgres -c "CREATE USER ordersys WITH PASSWORD 'ordersys';" -c "CREATE DATABASE ordersys OWNER ordersys;"
```

Windows 用「SQL Shell (psql)」以 postgres 登入後執行相同兩行 SQL：

```sql
CREATE USER ordersys WITH PASSWORD 'ordersys';
CREATE DATABASE ordersys OWNER ordersys;
```

---

## 1. Windows

1. **安裝 Node.js 18 LTS**：官網下載 `.msi`，安裝時勾選「Add to PATH」。
2. **安裝 PostgreSQL 16**：下載 EDB installer（https://www.postgresql.org/download/windows/），安裝時設定 `postgres` 超級使用者密碼並安裝為服務（開機自動啟動）；完成後依「共通步驟」建立資料庫與使用者。
3. 完成「共通步驟」（build 前端 + `npm install`）。
4. **用 PM2 讓 Node 開機自動啟動**：

```powershell
npm install -g pm2
cd C:\orderSYS
pm2 start server.js --name ordersys
pm2 save
pm2 startup
# 依畫面提示複製貼上它給的那一行（安裝開機服務）
```

---

## 2. Linux（以 Ubuntu 22.04 為例）

```bash
# Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL（安裝後自動開機啟動）
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

> PostgreSQL 已內建於 Ubuntu 官方套件庫，無需額外新增 repo。

完成共通步驟後，把專案放到 `/opt/orderSYS`，建立 systemd 服務：

```bash
sudo tee /etc/systemd/system/ordersys.service > /dev/null <<'EOF'
[Unit]
Description=orderSYS
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/orderSYS
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production
Environment=PG_CONN=postgres://ordersys:ordersys@127.0.0.1:5432/ordersys

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now ordersys
```

---

## 3. macOS（蘋果）

```bash
# Homebrew（若未安裝）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js 18
brew install node@18

# PostgreSQL 16（brew services 會開機自動啟動）
brew install postgresql@16
brew services start postgresql@16
```

完成共通步驟後，把專案放 `~/orderSYS`，用 PM2 自動啟動：

```bash
npm install -g pm2
cd ~/orderSYS
pm2 start server.js --name ordersys
pm2 save
pm2 startup launchd
```

---

## 4. 只有平板客戶（加小主機方案）

情境：客戶**只有安卓/iOS 平板 + 一台網絡打印機**，沒有 POS 主機（PC）。平板瀏覽器不能直接連印表機 9100 埠，因此需要一台「小主機」當印表機的大腦。**本方案不改程式，列印邏輯（跳飛／格式／編碼／QR）全部保留。**

### 前置：印表機
1. 網絡打印機設**固定 IP**（例 `192.168.1.50`），跟小主機同網段。

### 步驟

1. **準備小主機**：迷你 PC / NUC / Raspberry Pi 4（約 HK$400–600），建議有實體網路孔。
2. **裝環境**：依上方「Linux（Ubuntu）」一節安裝 Node.js 18 + PostgreSQL。
3. **放程式 + 安裝**：
   ```bash
   sudo mkdir -p /opt/orderSYS && sudo chown $USER /opt/orderSYS
   # 把 orderSYS 程式整個複製進去（或 git clone）
   cd /opt/orderSYS
   npm install
   cd client && npm install && npm run build && cd ..
   ```
4. **啟動（常駐）**：
   ```bash
   sudo npm i -g pm2
   pm2 start server.js --name orderSYS
   pm2 save && pm2 startup
   ```
5. **平板連小主機**：平板、小主機、印表機**同一 WiFi/網路**，平板瀏覽器開 `http://小主機IP:3000/pos`。
6. **後台設印表機**：登入 `/admin/printer`，印表機填 `ip: 192.168.1.50`、`port: 9100`。
7. **驗證**：平板下一單 → 小主機出票；**拔掉外網線**測試，本機後端照印（離線可用）。

> 重點：小主機 = 印表機的「大腦」，平板只是開網頁的遙控器。斷外網仍可離線列印，因為後端和印表機在同一台小主機上。

---

## 重點提醒

1. **資料庫備份**：定期用 `pg_dump --dbname=postgres://ordersys:ordersys@127.0.0.1:5432/ordersys --format=custom --file=/backup/orderSYS_$(date +%F).dump`，或系統內「資料庫備份」功能，另存到隨身碟/雲端。
2. **防火牆**：QR 點餐要讓手機連到 POS，需開 port `3000`（Windows 首次啟動會問是否允許，請選「允許」）。
3. **PostgreSQL 版本**：本專案現以 PostgreSQL 為準（Docker 與直接安裝一致）。
4. **瀏覽器最低需求**：POS／後台介面使用自托管思源黑體（woff2 + 可變字型），需瀏覽器支援 woff2 與可變字型。最低版本為 **Chrome 109+ / Edge 109+ / Firefox 115 ESR+**；**Internet Explorer 11 不支援**（無 woff2、無可變字型，版面也會走樣）。Windows 7 已停止支援（2020 年 EOL），其上最後可用瀏覽器即 Chrome/Edge 109、Firefox 115 ESR，已無安全更新，用於處理點餐／結帳有資安風險，建議至少升級至 Windows 10/11 或改用 Linux。
