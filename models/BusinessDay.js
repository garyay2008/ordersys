const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 金額一律四捨五入到分（2 位小數）
const roundMoney = v => (v == null || v === '' ? 0 : Math.round(Number(v) * 100) / 100)

const BusinessDaySchema = new Schema({
  // 營業日日期（YYYY-MM-DD），基於 cutoffTime 計算
  date: { type: String, required: true, unique: true, index: true },
  // 營業日開始時間
  openTime: { type: Date, default: Date.now },
  // 營業日結束時間
  closeTime: { type: Date },
  // 狀態：open=營業中, closed=已日結
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  // 開班時申報備用金
  startingCash: { type: Number, default: 0, set: roundMoney },
  // 日結時收銀機實點金額
  countedCash: { type: Number, default: 0, set: roundMoney },
  // 日結時備註
  closeRemark: { type: String, default: '' },
  // 代支（支出）紀錄
  paidOuts: [{
    amount: { type: Number, default: 0, set: roundMoney },
    reason: { type: String, default: '' },
    staffNo: { type: String, default: '' },
    staffName: { type: String, default: '' },
    time: { type: Date, default: Date.now }
  }],
  // 代收（收入）紀錄
  receiveds: [{
    amount: { type: Number, default: 0, set: roundMoney },
    reason: { type: String, default: '' },
    staffNo: { type: String, default: '' },
    staffName: { type: String, default: '' },
    time: { type: Date, default: Date.now }
  }],
  // 營業日結算快照（日結時寫入）
  snapshot: {
    orderCount: { type: Number, default: 0 },
    totalIncome: { type: Number, default: 0, set: roundMoney },
    cashIncome: { type: Number, default: 0, set: roundMoney },
    cardIncome: { type: Number, default: 0, set: roundMoney },
    otherIncome: { type: Number, default: 0, set: roundMoney },
    voidCount: { type: Number, default: 0 },
    voidAmount: { type: Number, default: 0, set: roundMoney },
    refundCount: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0, set: roundMoney },
    unsettleCount: { type: Number, default: 0 },
    unsettleAmount: { type: Number, default: 0, set: roundMoney },
    discountTotal: { type: Number, default: 0, set: roundMoney },
    serviceChargeTotal: { type: Number, default: 0, set: roundMoney },
    taxTotal: { type: Number, default: 0, set: roundMoney },
    paidOutTotal: { type: Number, default: 0, set: roundMoney },
    receivedTotal: { type: Number, default: 0, set: roundMoney }
  },
  // 開班操作員
  openedBy: { type: String, default: '' },
  // 日結操作員
  closedBy: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
})

module.exports = BusinessDay = mongoose.model('businessDay', BusinessDaySchema)
