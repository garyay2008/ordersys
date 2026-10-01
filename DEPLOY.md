# orderSYS 部署指引（直接安裝 / 非 Docker）

本文件說明如何在 POS 主機上直接安裝 orderSYS（Node.js + MongoDB），適用 Windows、Linux（Ubuntu）及 macOS。

> 若使用 Docker，請參考 `docker-compose.yml`（MongoDB 7.0 + App + CUPS 列印伺服器），執行 `docker compose up -d --build`。CUPS 服務（`olbat/cupsd`）提供 IPP 列印佇列，管理介面為 `http://<主機IP>:631`（admin / posprint）；首次使用需在 CUPS 介面新增「Raw」佇列（`socket://<印表機IP>:9100`），並於後台印表機設定的「CUPS 佇列」欄位填入該佇列名稱。

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

- `MONGO_URI=mongodb://localhost:27017/orderSYS`
- `JWT_SECRET=0x3E5`
- `NODE_ENV=production`
- `CUPS_URL=http://<CUPS主機>:631`（選用：使用 CUPS/IPP 列印佇列時設定；Docker Compose 已內建 `cups` 服務，app 以 `http://cups:631` 連線）
- `CUPS_USER=admin`（CUPS 管理員帳號）

---

## 1. Windows

1. **安裝 Node.js 18 LTS**：官網下載 `.msi`，安裝時勾選「Add to PATH」。
2. **安裝 MongoDB 7.0**：下載 MongoDB Community Server 7.0 `.msi`，選 Custom/Complete，**勾選「Install MongoDB as a Service」**（會自動開機啟動、常駐）。
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

# MongoDB 7.0（安裝後自動開機啟動）
sudo apt-get install -y gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl enable --now mongod
```

> Ubuntu 24.04（noble）官方不支援 MongoDB 7.0 套件，請改用 MongoDB 8.0 或 Docker。

完成共通步驟後，把專案放到 `/opt/orderSYS`，建立 systemd 服務：

```bash
sudo tee /etc/systemd/system/ordersys.service > /dev/null <<'EOF'
[Unit]
Description=orderSYS
After=network.target mongod.service

[Service]
WorkingDirectory=/opt/orderSYS
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production
Environment=MONGO_URI=mongodb://localhost:27017/orderSYS

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

# MongoDB 7.0（brew services 會開機自動啟動）
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
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

## 重點提醒

1. **資料庫備份**：定期用 `mongodump --db orderSYS --gzip --archive=/backup/orderSYS_$(date +%F).gz`，或系統內「資料庫備份」功能，另存到隨身碟/雲端。
2. **防火牆**：QR 點餐要讓手機連到 POS，需開 port `3000`（Windows 首次啟動會問是否允許，請選「允許」）。
3. **MongoDB 版本**：本專案現以 MongoDB 7.0 為準（Docker 與直接安裝一致）。
4. **瀏覽器最低需求**：POS／後台介面使用自托管思源黑體（woff2 + 可變字型），需瀏覽器支援 woff2 與可變字型。最低版本為 **Chrome 109+ / Edge 109+ / Firefox 115 ESR+**；**Internet Explorer 11 不支援**（無 woff2、無可變字型，版面也會走樣）。Windows 7 已停止支援（2020 年 EOL），其上最後可用瀏覽器即 Chrome/Edge 109、Firefox 115 ESR，已無安全更新，用於處理點餐／結帳有資安風險，建議至少升級至 Windows 10/11 或改用 Linux。
