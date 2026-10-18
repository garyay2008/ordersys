# orderSYS 安裝說明（Windows / Linux / Android）

## 一、架構總覽（先看這裡）

orderSYS 是「**後端伺服器 + 網頁前檯**」的架構，不是三套各自獨立的程式：

| 平台 | 角色 | 安裝方式 |
|------|------|----------|
| **Windows** | 主機（跑後端 + 資料庫）| 安裝程式 `.exe` |
| **Linux** | 主機（跑後端 + 資料庫）| `AppImage` 或 `.deb` |
| **Android** | 客戶端（平板/手機連到主機）| 網頁 PWA（加到主畫面）|

> 實際部署 = **一台 Windows 或 Linux 主機當伺服器**，Android 平板/手機用瀏覽器連到它即可，**Android 端不用裝後端**。

---

## 二、如何取得安裝檔

### 方法 A：從 GitHub Actions 下載（免本機打包）
1. 專案推到 GitHub → 點 **Actions** → **Build Desktop (Windows + Linux)** → **Run workflow**
2. 跑完後進該次執行，下方 **Artifacts** 有：
   - `ordersys-windows` → `orderSYS Setup x.x.x.exe`
   - `ordersys-linux` → `orderSYS-x.x.x.AppImage` + `orderSYS_x.x.x_amd64.deb`

### 方法 B：本機自己打包
```bash
npm install
npm run download:mongod   # 需在目標平台上跑（Mac 產 Mac、Win 產 Win、Linux 產 Linux）
npm run dist:win          # Windows：產生 .exe
npm run dist:linux        # Linux：產生 .AppImage + .deb
```

---

## 三、Windows 安裝

1. 雙擊 **`orderSYS Setup x.x.x.exe`**
2. 可自選安裝路徑（預設 `Program Files`）
3. 完成後啟動，程式會**自動在本機啟動 MongoDB**，並開視窗載入 POS
4. 第一次使用：瀏覽器開 `http://127.0.0.1:3000/init` 建立管理員帳號與店家資料
5. 同區網其他裝置（Android 平板等）連 `http://<主機IP>:3000`

**資料存放**：資料庫、上傳圖片、授權碼都放在 Windows 使用者資料目錄（約 `%APPDATA%\orderSYS`），移除程式不會誤刪。

---

## 四、Linux 安裝

### AppImage（免安裝，推薦）
```bash
chmod +x orderSYS-*.AppImage
./orderSYS-*.AppImage
```
- 若出現 FUSE 相關錯誤，先裝：`sudo apt install libfuse2`

### deb（Debian / Ubuntu）
```bash
sudo dpkg -i orderSYS_*_amd64.deb
# 相依缺漏時：
sudo apt -f install
```

**資料存放**：約 `~/.config/orderSYS`

---

## 五、Android（平板 / 手機）— PWA

Android 是「連到主機的網頁前檯」，用瀏覽器開啟即可，無需後端。

1. Android 裝置與主機連**同一個區域網路**
2. Chrome 開啟 `http://<主機IP>:3000/pos`（POS 前檯）或 `/kiosk`（自助點餐）
3. Chrome 選單 → **加到主畫面** → 產生桌面圖示捷徑

### 關於「安裝成 App」的重要說明
- 純 HTTP（`http://192.168.x.x`）下只能「加到主畫面」當捷徑（瀏覽器分頁開啟）。
- 要變成**全螢幕獨立 App（standalone 安裝）**，瀏覽器要求 **HTTPS**（或 localhost）。區域網路部署需另外架 HTTPS（反向代理 + 憑證），屬進階設定。

---

## 六、列印設定

- 打印機用**網路打印機**（`ip:9100` 直連），在各前檯/檔口設定裡填 IP 即可，Windows / Linux / Android 通用（由主機出單）。
- 後台路徑：`/admin/printer`、`/admin/posterminal` 設定打印機 IP（`ip:9100` 直連）。

---

## 七、網路 / 授權注意事項

| 項目 | 埠 | 說明 |
|------|----|------|
| 網頁服務 | `3000` | 主機對外開放，Android 裝置連此埠 |
| PostgreSQL | `5432` | 只綁 `127.0.0.1`，不對外 |
| 授權 | — | 綁定主機機器碼（首次啟動產生），在後台 `/admin` 或 `/api/license/status` 查看 |

---

## 八、常見問題

- **Windows 安裝後打不開**：檢查 3000 埠是否被佔用（其他服務/Docker），或看安裝目錄 log。
- **Android 連不上主機**：確認同一 Wi-Fi/區網、防火牆放行 3000 埠。
- **換主機後資料沒了**：資料在主機的使用者資料目錄，換機需先做後台「系統維護 → 備份/還原」。
