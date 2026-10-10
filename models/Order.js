const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 金額一律四捨五入到分（2 位小數），避免浮點誤差寫入資料庫
const roundMoney = v => (v == null || v === '' ? 0 : Math.round(Number(v) * 100) / 100)

const OrderSchema = new Schema({
  orderNo: {
    type: String,
    required: true,
    unique: true
  },
  shopId: {
    type: String,
    default: '001'
  },
  deskNo: {
    type: String,
    required: true
  },
  order: {
    type: Array,
    required: true
  },
  remark: {
    type: String
  },
  zone: {
    type: String,
    default: '堂食'
  },
  source: {
    type: String,
    enum: ['pos', 'qr', 'extension', 'kiosk'],
    default: 'pos'
  },
  totalPrice: {
    type: Number,
    required: true,
    set: roundMoney
  },
  serviceCharge: {
    type: Number,
    default: 0,
    set: roundMoney
  },
  discount: {
    type: Number,
    default: 0,
    set: roundMoney
  },
  tax: {
    type: Number,
    default: 0,
    set: roundMoney
  },
  rounding: {
    type: Number,
    default: 0,
    set: roundMoney
  },
  pax: {
    type: Number,
    default: 0
  },
  printer: {
    type: String,
    default: ''
  },
  waiter: {
    type: String,
    default: ''
  },
  cashier: {
    type: String,
    default: ''
  },
  payMethod: {
    type: String,
    default: ''
  },
  // 小費（信用卡付款時可加）
  tip: {
    type: Number,
    default: 0,
    set: roundMoney
  },
  settled: {
    type: Number,
    default: 0
  },
  subtotalAmount: {
    type: Number,
    default: 0,
    set: roundMoney
  },
  tableType: {
    type: Number,
    default: 1
  },
  subtype: {
    type: Number,
    default: 1
  },
  closeId: {
    type: String,
    default: ''
  },
  tranType: {
    type: Number,
    default: 0
  },
  voidStatus: {
    type: Number,
    default: 0
  },
  voidReason: {
    type: String,
    default: ''
  },
  voidReasonCode: {
    type: String,
    default: ''
  },
  voidType: {
    type: Number,
    default: 0
  },
  voidDate: {
    type: Date
  },
  voidBy: {
    type: String,
    default: ''
  },
  refundReason: {
    type: String,
    default: ''
  },
  refundDate: {
    type: Date
  },
  // 付款取消（反結賬）快照：記錄被沖銷付款的原始付款時間（settledAt 反結賬時會被清空）
  paymentCancelAt: {
    type: Date,
    default: null
  },
  relisted: {
    type: Boolean,
    default: false
  },
  // 反結賬（Un-settle / Re-open）：沖銷付款、重開未結訂單的追蹤
  unsettledAt: {
    type: Date
  },
  unsettledBy: {
    type: String,
    default: ''
  },
  unsettleCount: {
    type: Number,
    default: 0
  },
  printed: {
    type: Boolean,
    default: false
  },
  // 印單重印次數（首次印單為 0，之後每次重印 +1）
  reprintCount: {
    type: Number,
    default: 0
  },
  // 最近一次重印的員工
  reprintBy: {
    type: String,
    default: ''
  },
  transferredFrom: {
    type: String,
    default: ''
  },
  fromAction: {
    type: String,
    default: ''
  },
  chasedAt: {
    type: Date
  },
  // 收銀機 / 工作站編號（交易溯源用）
  terminalCode: {
    type: String,
    default: ''
  },
  // 印單小票流水號（收銀機 orderSeq，Z-Report 後歸零）
  orderSeq: {
    type: String,
    default: ''
  },
  // 枱面點餐碼 Token（POS「印點餐碼」產生；重印沿用原 token；結帳後 state=1 失效）
  qrToken: {
    type: String,
    default: ''
  },
  // 外賣叫號（每日重置的遞增流水號，格式 001；僅外賣/外賣枱等 deskNo=0 訂單使用）
  takeawayNo: {
    type: String,
    default: ''
  },
  state: {
    type: Number,
    required: true,
    default: 0
  },
  // 埋單（結帳）時間：分市報表「埋單計」使用；反結賬時清空
  settledAt: {
    type: Date,
    default: null
  },
  businessDayId: {
    type: Schema.Types.ObjectId,
    ref: 'businessDay',
    default: null
  },
  shiftId: {
    type: Schema.Types.ObjectId,
    ref: 'shift',
    default: null
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  }
})

// 索引：POS 高頻查詢（未結單按枱號、結算按營業日、按日期排序）
OrderSchema.index({ state: 1, deskNo: 1 })
OrderSchema.index({ businessDayId: 1, state: 1 })
OrderSchema.index({ date: -1 })

const Order = mongoose.model('order', OrderSchema)

module.exports = Order
