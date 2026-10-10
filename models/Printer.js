const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 檔口打印機（可增刪，name 自定義作為商品的 station 標識）
const StationPrinterSchema = new Schema({
  name: {
    type: String,
    default: '' // 檔口名，如 快蒸/慢蒸/腸粉煎炸/大排檔/上什/粉面/海鮮/冷盤/熱炒
  },
  role: {
    type: String,
    default: 'kitchen' // kitchen=廚房檔 | bar=水吧 | cashier=收銀臺 | expeditor=傳菜總檯
  },
  dineInMode: {
    type: String,
    default: '' // 堂食單：long=長單 | short=短單 | ''=不印
  },
  takeawayMode: {
    type: String,
    default: '' // 外賣單：long=長單 | short=短單 | ''=不印
  },
  tech: {
    type: String,
    default: 'thermal' // dot=針式 | thermal=感熱
  },
  model: {
    type: String,
    default: '' // tmt88 / xp80ts / tmu220 / ''=自訂
  },
  dpi: {
    type: Number,
    default: 180 // 熱敏解析度：TM-T88=180dpi / XP-80TS=203dpi
  },
  ip: {
    type: String,
    default: ''
  },
  port: {
    type: Number,
    default: 9100
  },
  paperWidth: {
    type: Number,
    default: 58
  },
  cashDrawer: {
    type: Boolean,
    default: false
  },
  copies: {
    type: Number,
    default: 1
  },
  fallbackTo: {
    type: String,
    default: '' // 備援檔口名：主機離線時自動跳飛到此檔口打印機
  },
  fallbackTo2: {
    type: String,
    default: '' // 第二備援檔口名：第一備援機也離線時，跳飛到此檔口打印機
  },
  timeout: {
    type: Number,
    default: 8000 // 超時(ms)：連線逾時。逾時即判離線，跳飛備援機
  },
  retries: {
    type: Number,
    default: 1 // 失敗重試次數（首次嘗試之外的額外重試次數）
  },
  retryDelay: {
    type: Number,
    default: 400 // 重試間隔(ms)
  },
  statusCheck: {
    type: Boolean,
    default: true // DLE EOT 即時狀態檢查（缺紙/開蓋/離線）；USB 轉 LAN 列印伺服器不支援時建議關閉以提速
  }
}, { _id: false })

// 座位分區（Zone Printing）
const ZoneSchema = new Schema({
  name: {
    type: String,
    default: ''
  },
  desks: {
    type: [Number],
    default: []
  },
  serviceIp: {
    type: String,
    default: ''
  },
  servicePort: {
    type: Number,
    default: 9100
  },
  cashierIp: {
    type: String,
    default: ''
  },
  cashierPort: {
    type: Number,
    default: 9100
  }
}, { _id: false })

const PrinterSchema = new Schema({
  // ---- 小票抬頭（所有位置共用）----
  shopName: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  footer: {
    type: String,
    default: '謝謝惠顧，歡迎再次光臨'
  },
  // 小票 Logo 圖片路徑（相對 public/，如 logo/xxx.png）
  logo: {
    type: String,
    default: ''
  },
  // 店舖 Logo 總開關：關閉後所有小票（結賬/上菜/印單/二維碼）都不印 Logo
  logoEnabledAll: {
    type: Boolean,
    default: true
  },
  // 是否在結賬小票上印店舖 Logo
  logoEnabled: {
    type: Boolean,
    default: true
  },
  // 是否在上菜紙上印店舖 Logo
  logoEnabledServing: {
    type: Boolean,
    default: false
  },
  // 是否在印單小票上印店舖 Logo
  logoEnabledPrint: {
    type: Boolean,
    default: false
  },
  // 是否在二維碼小票上印店舖 Logo
  logoEnabledQrcode: {
    type: Boolean,
    default: false
  },
  format: {
    type: Object,
    default: {}
  },
  // 針式打印機專用小票格式（分離熱敏/針式設定；未設定時回退到 format）
  formatDot: {
    type: Object,
    default: {}
  },
  // 中文編碼：big5=繁體 / gbk=簡體 / gb18030 / utf8
  charset: {
    type: String,
    default: 'big5'
  },
  autoPrint: {
    type: Boolean,
    default: false
  },
  // 圖像打印：將中文文字轉成點陣圖（GS v 0）輸出，供不具中文字庫的打印機使用
  imagePrint: {
    type: Boolean,
    default: false
  },
  // 圖像打印字重（350=細 / 400=標準 / 450=中粗）
  imageWeight: {
    type: Number,
    default: 400
  },
  // 熱敏圖像打印字體：noto=思源黑體 / serif=思源宋體 / stheiti=華文黑體 Medium / arial=Arial Unicode
  thermalFont: {
    type: String,
    default: 'noto'
  },
  // 針式打印機點陣圖放大：以 ESC * m=0 點陣圖輸出，突破內建 2x2 字號上限
  dotImagePrint: {
    type: Boolean,
    default: false
  },
  // 針式點陣圖放大基準字號（dot）
  dotImageSize: {
    type: Number,
    default: 31
  },
  // 針式點陣圖字體：noto=思源黑體 / serif=思源宋體 / stheiti=華文黑體 Medium / arial=Arial Unicode
  dotImageFont: {
    type: String,
    default: 'noto'
  },
  // 針式點陣圖字重（350=細 / 400=標準 / 600=粗 / 800=特粗）
  dotImageWeight: {
    type: Number,
    default: 400
  },
  // ---- 默認打印機（向後兼容 fallback）----
  name: {
    type: String,
    default: '熱敏打印機'
  },
  type: {
    type: String,
    default: 'network'
  },
  ip: {
    type: String,
    default: ''
  },
  port: {
    type: Number,
    default: 9100
  },
  paperWidth: {
    type: Number,
    default: 58
  },
  copies: {
    type: Number,
    default: 1
  },
  cashDrawer: {
    type: Boolean,
    default: false
  },
  // ---- 動態檔口打印機隊列 ----
  printers: {
    type: [StationPrinterSchema],
    default: []
  },
  // ---- 小票類型 → 目標位置打印機 ----
  ticketTargets: {
    type: Object,
    default: {}
  },
  // ---- 座位分區打印機 ----
  zones: {
    type: [ZoneSchema],
    default: []
  },
  // ---- 中央埋單印表機（功能鍵「中央埋單」印單專用，可與本機印表機不同型號）----
  centralPrint: {
    ip: { type: String, default: '' },
    port: { type: Number, default: 9100 },
    tech: { type: String, default: 'thermal' },
    model: { type: String, default: '' },
    dpi: { type: Number, default: 180 },
    paperWidth: { type: Number, default: 58 },
    copies: { type: Number, default: 1 }
  },
  date: {
    type: Date,
    default: Date.now
  }
})

module.exports = Printer = mongoose.model('printer', PrinterSchema)
