const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 各 POS 按鈕預設最低權限等級
const DEFAULT_BTN_PERMS = {
  merge: 3, split: 3, transfer: 3,
  hold: 1, recall: 1, print: 1, chase: 1, serving: 1, qrcode: 1, printTableQr: 1,
  wholeDiscount: 2, itemDiscount: 2,
  clear: 1, submit: 1, send: 1,
  checkout: 2, soldout: 2, openDrawer: 1,
  refund: 3, report: 3, manager: 4, addTable: 3, releaseTable: 3,
  showDetail: 1, deptSplit: 2
}

// POS 功能設定（服務費等）
const PosSettingSchema = new Schema({
  serviceChargeEnabled: {
    type: Boolean,
    default: false
  },
  serviceChargeRate: {
    type: Number,
    default: 10
  },
  // 折前服務費：true=以「商品總額」計算服務費（折前），false=以「折扣後金額」計算服務費（折後）
  serviceChargePreDiscount: {
    type: Boolean,
    default: true
  },
  // 應付金額取整方式：'none'=不取整, 'normal'=四舍五入, 'up'=始終進位, 'down'=始終抹零
  roundingMode: {
    type: String,
    default: 'none'
  },
  // POS 入單版面是否顯示食品圖片（關閉後改為純文字菜名）
  showFoodImages: {
    type: Boolean,
    default: true
  },
  // === 入單版面設定 ===
  // 版面風格：sidebar=側欄式（左分類導航＋右上清單＋底部雙色 dock）| classic=傳統式（左清單＋右食品＋底欄）
  orderLayout: {
    type: String,
    default: 'sidebar'
  },
  // 主題配色：indigo=藍紫 | ocean=海洋藍 | emerald=翡翠綠 | sunset=日落橙 | dark=深夜
  orderTheme: {
    type: String,
    default: 'indigo'
  },
  // 顯示左側分類導航（sidebar 風格）
  showSideNav: {
    type: Boolean,
    default: true
  },
  // 點餐清單位置：right=右側 | left=左側（sidebar 風格）
  ticketSide: {
    type: String,
    default: 'right'
  },
  // 自訂版面模式（自由移動/縮放面板）：開啟後 POS 登入即進入設計模式
  freeLayoutEdit: {
    type: Boolean,
    default: false
  },
  // 分市時間主檔（午市/下午茶/晚市...）：報表按此時段分組
  slots: {
    type: [{
      name: { type: String, default: '' },
      start: { type: String, default: '' },
      end: { type: String, default: '' }
    }],
    default: []
  },
  buttonOrder: {
    type: Array,
    default: []
  },
  btnPerms: {
    type: Object,
    default: {}
  },
  // === 入單版面佈局（取代 localStorage，統一由後台管理）===
  // 面板尺寸（px），0 = 使用預設
  ticketWidth: { type: Number, default: 0 },
  dockHeight: { type: Number, default: 0 },
  sideNavWidth: { type: Number, default: 0 },
  dockMinH: { type: Number, default: 0 },
  // 面板自由定位（freeLayoutEdit 時使用）：{ sideNav: {x,y,w,h}, foodZone, ticket, dock }
  panels: { type: Object, default: {} },
  // 功能鍵自由定位：{ btnId: {x,y,w,h}, … }
  btnPos: { type: Object, default: {} },
  // 功能鍵自訂顏色：{ btnId: '#hex', … }
  btnColors: { type: Object, default: {} },
  // 面板自訂背景色：{ panelKey: '#hex', … }
  panelColors: { type: Object, default: {} },
  // 面板透明度（0-100）：{ sideNav: 100, foodZone: 100, ticket: 100, dock: 100 }
  panelOpacity: { type: Object, default: {} },
  // 面板圓角（px）：{ sideNav: 4, foodZone: 4, ticket: 4, dock: 4 }
  panelRadius: { type: Object, default: {} },
  // 面板 z-index 層級：{ sideNav: 5, foodZone: 3, ticket: 4, dock: 2 }
  panelZIndex: { type: Object, default: {} },
  // 側欄按鈕列數（2-5）
  sideNavCols: { type: Number, default: 3 },
  // 全局字型大小（px）
  globalFontSize: { type: Number, default: 14 },
  // POS 自訂字型：posFontFamily = 字型名稱（可自訂系統字型），posFontUrl = 上傳的自訂字型檔網址
  posFontFamily: { type: String, default: '' },
  posFontUrl: { type: String, default: '' },
  // 按鈕字體大小與寬度（rowsPerPage = 每頁顯示行數，0 = 不分頁）
  posBtnSettings: { type: Object, default: { fontSize: 18, width: 60, rowsPerPage: 2, perRow: 8 } },
  // 分類按鈕樣式（fontSize=字號, height=高度, padding=左右內距, cols=每行分類數, rows=每頁列數, 0=不分頁）
  catBtnSettings: { type: Object, default: { fontSize: 13, width: 0, height: 40, padding: 20, paddingY: 0, gapX: 10, gapY: 10, cols: 4, rows: 6, shape: 'pill' } },
  // 貨品按鈕樣式（cols=每行貨品數, 0=自動偵測, rows=顯示行數, 0=自動, fontSize=字號, width=寬度, height=高度(0=用minHeight), minHeight=最小高度, imageSize=圖片大小）
  foodBtnSettings: { type: Object, default: { cols: 0, rows: 0, fontSize: 25, width: 0, height: 0, minHeight: 88, imageSize: 40, paddingX: 3, paddingY: 6, gapX: 6, gapY: 6, showPlu: true, showPrice: true } },
  // 上下頁導航按鈕樣式設定
  dockNav: { type: Object, default: { fontSize: 18, width: 100, height: 40, bgColor: '#409eff', textColor: '#ffffff', pageNumFontSize: 12, gap: 6 } },
  // 即時座位狀態 Sidebar 設定
  sidebarSettings: { type: Object, default: {} },
  sidebarButtons: { type: Array, default: [] },
  // 已隱藏功能鍵 ID 列表
  hiddenBtns: { type: Array, default: [] },
  // 叫起標籤顏色設定
  calledTagStyle: { type: Object, default: {} },
  // 枱卡操作標籤樣式（合/分/追/轉 的字體大小、字色、背景色）
  badgeStyle: { type: Object, default: {} },
  // 經理功能選單配置
  managerMenu: { type: Array, default: [] },
  // 枱號圖佈局設定
  boardLayout: { type: Object, default: {} },
  // 卡片枱顯示設定（座位數/狀態點/枱號/金額/狀態/時長 的開關、字號、位置）
  cardDisplay: { type: Object, default: {} },
  // 搭枱功能開關
  shareTableEnabled: { type: Boolean, default: false },
  // 手勢功能開關（左撥顯示明細／右撥隱藏／雙擊單項刪除／三擊整單刪除）
  gestureEnabled: { type: Boolean, default: true },
  // 訂單編號前綴（堂食 / 外賣）
  dineInPrefix: { type: String, default: '10' },
  takeawayPrefix: { type: String, default: '99' },
  // 數字鍵盤「數量」按鈕模式：'pending'=預設數量（方案一），'select'=選中修改數量（方案二）
  sideQtyMode: {
    type: String,
    default: 'pending'
  },
  // 改碼顯示方式：'A'=列表多選（方案 A），'B'=品項編輯 Chip 介面（方案 B）
  modCodeUIMode: {
    type: String,
    default: 'A'
  },
  // 印單鍵重複列印最低權限等級（此等級以上可重複印單，以下只可印一次）
  reprintMinLevel: {
    type: Number,
    default: 3
  },
  // 沽清每日自動重置：開啟後，手動沽清的品項於新營業日自動重售（保留庫存歸零的沽清）
  soldOutDailyReset: { type: Boolean, default: false },
  // 營業日截止時間（HH:mm），用於計算跨日（例如 03:00 表示凌晨3點後算新一天）
  businessDayCutoff: { type: String, default: '03:00' },
  // 跳飛 POS 通知：打印機跳飛（備援機/廚房通用機代印）時，POS 前台頂部顯示閃爍提示
  failoverNotify: { type: Boolean, default: true },
  // 公眾假期日期表（'YYYY-MM-DD'），用於「跳價錢設定」的 holiday 組別
  publicHolidays: { type: [String], default: [] },
  // 茶芥必選項目開關：開啟後結帳／印單需有必選貨品在單內
  teaChargesRequired: { type: Boolean, default: false },
  // 必選分類 ID（提示後自動跳轉到該分類）
  requiredCategoryId: { type: String, default: '' },
  // 茶位自動同步人數：印單／結帳時，以茶芥必選貨品數量自動帶入人數
  teaSeatSyncPax: { type: Boolean, default: false },
  // 上菜紙只列印後加項目：開啟後，上菜紙只印新加入的品項；無後加品項時仍印整張單
  servingNewItemsOnly: { type: Boolean, default: false },
  // 套餐名稱只印一次：開啟後，後廚小票／追單的套餐子品項改為「套餐名標題 + 子品項縮排列」，不再每個子品項重複印套餐名
  comboNameOnce: { type: Boolean, default: false },
  // 撞餐功能：多項單點自動組合成套餐價
  bundleEnabled: { type: Boolean, default: false }, // 撞餐總開關
  bundleMode: { type: String, default: 'auto' },     // auto=加單自動偵測 | manual=手動撞餐鍵 | both=兩者
  bundleRule: { type: String, default: 'bestPrice' }, // bestPrice=省最多錢 | priority=套餐優先級
  // 取消項目小票列印開關：kitchen=廚房出單, workstation=工作站出單
  cancelItemPrint: {
    type: Object,
    default: { kitchen: true, workstation: false }
  },
  // 分類按鈕順序／顯示／分頁指派設定：[{ id, visible, label, page, fontSize, width, height }]
  // page 0 = 依順序自動分頁，>0 = 固定在該頁（1 起算）
  // fontSize/height 0 = 用全局 catBtnSettings 的對應值；width = 跨欄數（0/1 = 佔 1 欄）
  categoryOrder: {
    type: [{
      id: { type: String, default: '' },
      visible: { type: Boolean, default: true },
      label: { type: String, default: '' },
      page: { type: Number, default: 0 },
      fontSize: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 }
    }],
    default: []
  },
  // QR 分類排序：[{ id, visible }]，陣列依序為 QR 菜單左欄顯示順序；visible=false 表示在 QR 隱藏
  qrCategoryOrder: {
    type: [{
      id: { type: String, default: '' },
      visible: { type: Boolean, default: true }
    }],
    default: []
  },
  // 貨價跳價錢設定總開關：關閉後所有跳價規則（入單／開枱／埋單／菜單顯示）一律不生效
  jumpPriceEnabled: {
    type: Boolean,
    default: true
  },
  // 全局貨價跳價規則：一至五/六/日/公眾假期 + 生效時間 + 計價時機 + 用第幾個規格價
  jumpPriceRules: {
    type: [{
      days: { type: String, default: 'weekdays' }, // weekdays | saturday | sunday | holiday
      start: { type: String, default: '' },         // HH:mm 生效時間
      end: { type: String, default: '' },           // HH:mm 結束時間（空 = 至當天結束）
      timing: { type: String, default: 'order' },   // open=開枱計 | order=入單計 | checkout=埋單計
      mode: { type: String, default: 'all' },       // all=堂食+外賣 | 堂食 | 外賣
      specIndex: { type: Number, default: 1 }       // 1~10 對應貨品 specs 順序
    }],
    default: []
  },
  // 預設折扣快捷選項（由 ISM discount.xml 匯入）：{ name, type: 'percent'|'amount', value }
  discountOptions: {
    type: [{
      name: { type: String, default: '' },
      type: { type: String, enum: ['percent', 'amount'], default: 'percent' },
      value: { type: Number, default: 0 }
    }],
    default: []
  },
  date: {
    type: Date,
    default: Date.now
  }
})

module.exports = PosSetting = mongoose.model('possetting', PosSettingSchema)
module.exports.DEFAULT_BTN_PERMS = DEFAULT_BTN_PERMS
