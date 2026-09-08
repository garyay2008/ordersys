const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 各 POS 按鈕預設最低權限等級
const DEFAULT_BTN_PERMS = {
  merge: 3, split: 3, transfer: 3,
  hold: 1, recall: 1, print: 1, chase: 1, serving: 1, qrcode: 1,
  wholeDiscount: 2, itemDiscount: 2,
  clear: 1, submit: 1, send: 1,
  checkout: 2, soldout: 2, openDrawer: 1,
  refund: 3, report: 3, manager: 4, addTable: 3
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
  // 應付金額取整方式：'none'=不取整, 'normal'=四舍五入, 'up'=始終進位, 'down'=始終抹零
  roundingMode: {
    type: String,
    default: 'none'
  },
  // POS 入單版面是否顯示食品圖片（關閉後改顯示類別色圓形頭像＋菜名首字）
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
  // 分市時間主檔（午市/下午茶/晚市...）：報表按此時段分組，商品時段價亦跟呢度
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
  // 按鈕字體大小與寬度
  posBtnSettings: { type: Object, default: { fontSize: 18, width: 60 } },
  // 即時座位狀態 Sidebar 設定
  sidebarSettings: { type: Object, default: {} },
  sidebarButtons: { type: Array, default: [] },
  // 已隱藏功能鍵 ID 列表
  hiddenBtns: { type: Array, default: [] },
  // 叫起標籤顏色設定
  calledTagStyle: { type: Object, default: {} },
  // 經理功能選單配置
  managerMenu: { type: Array, default: [] },
  // 枱號圖佈局設定
  boardLayout: { type: Object, default: {} },
  // 搭枱功能開關
  shareTableEnabled: { type: Boolean, default: false },
  // 訂單編號前綴
  orderPrefix: { type: String, default: '' },
  // 營業日截止時間（HH:mm），用於計算跨日（例如 03:00 表示凌晨3點後算新一天）
  businessDayCutoff: { type: String, default: '03:00' },
  date: {
    type: Date,
    default: Date.now
  }
})

module.exports = PosSetting = mongoose.model('possetting', PosSettingSchema)
module.exports.DEFAULT_BTN_PERMS = DEFAULT_BTN_PERMS
