const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 單台印表機設定（本機收據/上菜紙/印單各自獨立，可指定不同型號）
// 型號自動帶入 tech / dpi / 紙寬，支援兩台印表機型號不同的情境
const PrinterConfigSchema = new Schema({
  ip: { type: String, default: '' },
  port: { type: Number, default: 9100 },
  tech: { type: String, default: 'thermal' }, // thermal=感熱 | dot=針式
  model: { type: String, default: '' }, // tmt88 / xp80ts / tmu220 / ''=自訂
  dpi: { type: Number, default: 180 },
  paperWidth: { type: Number, default: 58 }, // 58 / 80 mm
  copies: { type: Number, default: 1 },
  cashDrawer: { type: Boolean, default: false }
}, { _id: false })

// 收銀機 / 工作站主檔（Terminal Management）
// 用來識別每一台實體收銀機、點餐機或平板電腦的唯一編號
// 功能：交易溯源、單號前綴、印表機/錢箱路由、班次綁定
const PosTerminalSchema = new Schema({
  // 編號（唯一識別碼）：POS-01, POS-02, KIOSK-01
  code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // 名稱：大門收銀台 / 外賣收銀台 / 手提落單 Pad
  name: {
    type: String,
    required: true
  },
  // 位置描述
  location: {
    type: String,
    default: ''
  },
  // 類型：cashier=收銀機, kiosk=自助點餐機, pad=手提平板, kitchen=廚房顯示
  type: {
    type: String,
    default: 'cashier',
    enum: ['cashier', 'kiosk', 'pad', 'kitchen']
  },
  // 是否啟用
  enabled: {
    type: Boolean,
    default: true
  },
  // === 訂單編號前綴（避免多機單號衝突）===
  // 例如 '1' = 該機的單號為 1001, 1002, 1003...
  // 例如 '2' = 該機的單號為 2001, 2002, 2003...
  orderPrefix: {
    type: String,
    default: ''
  },
  // 該機的當前流水號（Z-Report 後歸零）
  orderSeq: {
    type: Number,
    default: 1
  },
  // === 硬件對應 ===
  // 該機的收銀印表機 IP
  printerIp: {
    type: String,
    default: ''
  },
  printerPort: {
    type: Number,
    default: 9100
  },
  // 是否連接錢箱
  cashDrawer: {
    type: Boolean,
    default: false
  },
  // === 本機專屬印表機（各自出各自的收據/上菜紙/印單，可不同型號）===
  // 收據印表機（兼錢箱），留空 ip 時回退全域 cashier printer
  receipt: {
    type: PrinterConfigSchema,
    default: () => ({ ip: '', port: 9100, tech: 'thermal', model: '', dpi: 180, paperWidth: 58, copies: 1, cashDrawer: false })
  },
  // 上菜紙印表機，留空 ip 時回退全域 expeditor printer
  serving: {
    type: PrinterConfigSchema,
    default: () => ({ ip: '', port: 9100, tech: 'thermal', model: '', dpi: 180, paperWidth: 58, copies: 1, cashDrawer: false })
  },
  // 印單印表機，留空 ip 時回退全域 cashier printer
  print: {
    type: PrinterConfigSchema,
    default: () => ({ ip: '', port: 9100, tech: 'thermal', model: '', dpi: 180, paperWidth: 58, copies: 1, cashDrawer: false })
  },
  // === 權限控制 ===
  // 該機允許的最高操作員等級（0=不限制）
  maxPermissionLevel: {
    type: Number,
    default: 0
  },
  // 該機允許的功能（空陣列=不限制）
  allowedFunctions: {
    type: [String],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

module.exports = PosTerminal = mongoose.model('posTerminal', PosTerminalSchema)
