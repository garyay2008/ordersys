# orderSYS Windows 7 安裝說明

> **先講結論**：orderSYS 的**桌面版 App（Electron）無法在 Windows 7 執行**，因為 Electron 28 起只支援 Windows 10 或更新版本。Windows 7 若要使用，請當作**分機／客戶端**，用瀏覽器連到另一台主機即可，本機不裝後端。

---

## 一、Windows 7 能做的 vs 不能做的

| 用途 | 可否 | 說明 |
|------|------|------|
| 當 **主機**（跑後端 + MongoDB）| ❌ 不建議 | Node.js 最後支援 Win7 的版本是 12（已 EOL）、MongoDB 最後支援 Win7 的是 4.4（已 EOL）；本專案以 Node 18 + MongoDB 7.0 為準，無法在 Win7 正常運作 |
| 安裝**桌面版 App（.exe）** | ❌ 不能 | Electron 28 需要 Windows 10+ |
| 當 **分機／客戶端**（瀏覽器連主機）| ✅ 可以 | 用 Chrome/Edge 109 或 Firefox 115 ESR 開網頁即可 |

---

## 二、建議做法：Windows 7 當分機（客戶端）

### 前置條件
1. 已有一台 **Windows 10/11 或 Linux 主機**安裝並啟動 orderSYS（參考 `INSTALL.md` 或 `DEPLOY.md`）。
2. Windows 7 與主機在**同一個區域網路**。

### 步驟
1. 在 Windows 7 安裝支援的瀏覽器：
   - **Chrome 109** 或 **Edge 109**（Windows 7 最後可用版本），或 **Firefox 115 ESR**。
2. 開啟瀏覽器，輸入主機網址：
   - POS 前檯：`http://<主機IP>:3000/pos`
   - 自助點餐：`http://<主機IP>:3000/kiosk`
   - 電子菜單：`http://<主機IP>:3000/emenu/<桌號>`
   - 排隊顯示：`http://<主機IP>:3000/queue`
3. （選用）加到桌面當捷徑：瀏覽器選單 → **更多工具 → 建立捷徑**。

### 分機授權
- 若主機已開啟分機授權，在網址加上 `?terminal=<收銀機編號>`，例如：
  `http://<主機IP>:3000/pos?terminal=POS-01`
- 未授權時會自動導向啟用頁，輸入該分機的授權碼即可。

---

## 三、不建議：硬要在 Windows 7 當主機（僅供參考）

若必須讓 Windows 7 自己跑後端，理論上需降級到已停止支援的舊元件，**有資安與相容風險，不推薦用於點餐/結帳**：

1. **Node.js 12.x**（最後支援 Win7 的版本，2022 年 EOL）
2. **MongoDB 4.4**（最後支援 Win7 的版本，已 EOL）

> 由於本專案依賴 Node 18 與 MongoDB 7.0 的部分功能，實際在此組合上能否完整運作**未經測試，不保證可用**。請優先考慮「升級至 Windows 10/11」或「改用 Linux 主機」。

---

## 四、Windows 7 注意事項

1. **安全**：Windows 7 已於 2020 年停止支援，其瀏覽器（Chrome/Edge 109、Firefox 115 ESR）也不再收到安全更新，處理交易有風險。
2. **字型**：介面使用自托管思源黑體（woff2 + 可變字型），Chrome/Edge 109 與 Firefox 115 ESR 均支援。
3. **防火牆**：分機連不到主機時，檢查主機防火牆是否放行 `3000` 埠，並確認兩端在同一區網。
