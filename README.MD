# orderSYS — 餐廳點餐管理系統

輕量級餐廳 POS 點餐系統，適用於中小型餐廳、茶餐廳、快餐店。

## 功能一覽

### POS 前台
- **枱況圖**：即時顯示所有枱位狀態（空枱 / 已點 / 使用中 / 退單）
- **點餐**：按分類選品、PLU 鍵盤輸入、改碼、折扣
- **印單**：後廚小票、結賬小票、上菜紙、二維碼小票，支持多檔口路由
- **結賬**：現金 / 信用卡 / 行動支付 / 八達通，支持找零計算
- **枱位管理**：合拼枱、分單、轉枱、加枱
- **沽清設定**：新增項目、售罄清單、限量庫存（扣完自動沽清）
- **掛單 / 叫回**：暫存未完成訂單
- **報表**：今日訂單數、營業額、未結訂單
- **已送品項鎖定**：已送出的品項鎖定不顯示數量控制，新加同款另起一行標示「新」

### 管理後台
- **商品管理**：商品增刪改查、圖片上傳、PLU 碼設定
- **分類管理**：商品分類
- **套餐管理**：組合套餐
- **改碼管理**：改碼分類及項目
- **枱號管理**：枱位編號、座位數、區域
- **區域管理**：座位分區
- **員工管理**：員工帳號、權限等級（1-4 級）
- **打印機設置**：檔口打印機隊列、小票格式、座位分區打印機
- **POS 功能設定**：按鈕排序及權限、服務費、應付金額取整
- **營業報表**：歷史訂單查詢

### 權限等級

| 等級 | 角色 | 說明 |
|------|------|------|
| 1 | 服務員 | 基本點餐、送單、印單 |
| 2 | 收銀員 | 結帳、折扣、沽清設定 |
| 3 | 經理 | 合拼枱、分單、轉枱、報表、加枱、員工權限、已送品項可改數量 |
| 4 | 管理員 | 全部 POS 功能 |

### 應付金額取整

| 模式 | 說明 | 範例 |
|------|------|------|
| 不取整 | 維持原金額 | $45.3 → $45.3 |
| 四舍五入 | 到 $1 | $45.3 → $45 |
| 始終進位 | Round Up 到 $1 | $45.1 → $46 |
| 始終抹零 | Round Down 到 $1 | $45.9 → $45 |

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | Vue 2 + Vue Router + Vuex + Element UI + Axios |
| 後端 | Node.js + Express + Mongoose + Passport (JWT) |
| 資料庫 | MongoDB |
| 打印 | ESC/POS 熱敏打印機（TCP :9100，58/80mm） |
| 即時通訊 | Socket.IO |

## 環境要求

| 軟體 | 版本 |
|------|------|
| Node.js | ≥ 12.x |
| MongoDB | ≥ 4.x |
| npm | ≥ 6.x |

## 安裝步驟

### 1. Clone 專案

```bash
git clone https://github.com/0x3E5/orderSYS.git
cd orderSYS
```

### 2. 安裝後端依賴

```bash
npm install
```

### 3. 安裝前端依賴

```bash
cd client
npm install
cd ..
```

### 4. 配置資料庫

編輯 `config/config.js`：

```js
module.exports = {
  mongoURI: 'mongodb://localhost:27017/orderSYS',  // MongoDB 連接地址
  secretKey: '你的JWT密鑰'                          // JWT 簽名密鑰
}
```

### 5. 配置前端連接地址

編輯 `client/src/main.js`，確認 `connection` 設定為你伺服器的 IP 地址：

```js
axios.defaults.baseURL = 'http://你的伺服器IP:3000'
```

### 6. 啟動 MongoDB

```bash
# macOS（Homebrew）
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

## 啟動服務

### 開發環境

**終端 1 — 啟動後端：**

```bash
node server.js
```

後端運行於 `http://localhost:3000`

**終端 2 — 啟動前端（熱重載）：**

```bash
cd client
npm run serve
```

前端運行於 `http://localhost:8080`

### 生產環境

**1. 編譯前端：**

```bash
cd client
npm run build
cd ..
```

編譯後的靜態文件輸出到 `client/dist/`。

**2. 啟動後端：**

```bash
node server.js
```

後端會自動 serve `client/dist/` 中的靜態文件，訪問：

```
http://你的伺服器IP:3000
```

**3.（可選）使用 PM2 進程管理：**

```bash
npm install -g pm2
pm2 start server.js --name ordersys
pm2 save
pm2 startup
```

**4.（可選）使用 Nginx 反向代理：**

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /goods/ {
        proxy_pass http://127.0.0.1:3000/goods/;
    }
}
```

## 首次使用

### 1. 初始化管理員

首次訪問時，系統會跳轉到初始化頁面：

```
http://你的伺服器IP:3000/init/admin
```

設定管理員帳號和密碼。

### 2. 設定店鋪資訊

初始化完成後，進入管理後台設定店鋪名稱、電話、地址。

### 3. 建立分類和商品

- 先建立商品分類
- 再逐一新增商品（設定名稱、價格、PLU 碼、圖片、所屬檔口）

### 4. 設定打印機

進入 `管理後台 → 打印機設置`：

1. **檔口打印機隊列**：為每個檔口設定打印機 IP、端口、紙寬
2. **測試打印機**：點擊每台打印機旁的「打印機測試」按鈕驗證連接
3. **小票打印指定**：設定後廚小票、結賬小票、上菜紙的打印機
4. **座位分區**：（可選）設定區域與枱號對應關係

### 5. 建立枱位

進入 `管理後台 → 枱號管理`，新增所有枱位（編號、座位數、區域）。

### 6. 建立員工

進入 `管理後台 → 用戶管理`，新增員工並設定權限等級。

### 7. 設定 POS 功能

進入 `管理後台 → POS 功能設定`：

- 排列按鈕順序及顏色
- 設定每個按鈕的最低權限等級
- 設定服務費率
- 設定應付金額取整方式

### 8. 進入 POS 前台

直接訪問（無需登入）：

```
http://你的伺服器IP:3000/pos
```

員工在 POS 前台以員工編號 + 密碼登入，開始點餐。

## 頁面路由

| 路由 | 說明 |
|------|------|
| `/pos` | POS 前台（無需登入） |
| `/login` | 管理後台登入 |
| `/admin` | 管理後台首頁 |
| `/admin/commodity` | 商品管理 |
| `/admin/category` | 分類管理 |
| `/admin/table` | 枱號管理 |
| `/admin/zone` | 區域管理 |
| `/admin/staff` | 員工管理 |
| `/admin/printer` | 打印機設置 |
| `/admin/possetting` | POS 功能設定 |
| `/admin/shop` | 店鋪資訊 |
| `/index/:id` | 線上點餐頁（掃碼用） |

## 目錄結構

```
orderSYS/
├── config/
│   ├── config.js          # 資料庫及 JWT 配置
│   └── passport.js        # Passport JWT 策略
├── models/                # Mongoose 數據模型
├── routes/api/            # API 路由
├── plugins/
│   ├── Printer.js         # ESC/POS 打印機插件
│   └── SocketIO.js        # WebSocket 插件
├── public/                # 靜態資源（商品圖片等）
├── client/
│   ├── src/
│   │   ├── views/
│   │   │   ├── pos/       # POS 前台
│   │   │   ├── admin/     # 管理後台
│   │   │   ├── user/      # 線上點餐
│   │   │   └── init/      # 初始化
│   │   ├── components/    # 組件
│   │   └── router/        # 前端路由
│   └── dist/              # 編譯輸出
├── server.js              # 後端入口
└── package.json
```

## 常見問題

### Q：打印機無法連接？

- 確認打印機 IP 和端口正確（默認 `:9100`）
- 確認伺服器與打印機在同一局域網
- 在打印機設置頁點擊「打印機測試」驗證

### Q：POS 前台看不到新修改？

- 執行 `cd client && npm run build` 重新編譯
- 在瀏覽器強制重新整理（`Ctrl+F5` / `Command+Shift+R`）

### Q：如何修改服務器端口？

編輯 `server.js` 最後一行：

```js
const server = http.listen(3000, () => { ... })
```

將 `3000` 改為你想要的端口。

## 授權

[GPL-3.0](LICENSE)
