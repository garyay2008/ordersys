const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 排隊叫號票（按營業日 + 分類，編號 A001/B012…）
const QueueTicketSchema = new Schema({
  date: { type: String, required: true, index: true },
  // 分類前綴（對應 QueueSetting.categories[].prefix）
  category: { type: String, required: true },
  // 該分類當日流水號（1 起）
  number: { type: Number, required: true },
  // 完整票號，如 A001
  ticketNo: { type: String, required: true },
  // 用餐人數
  pax: { type: Number, default: 1 },
  // waiting=等候中, called=已叫號, seated=已入座, skipped=跳過, cancelled=取消
  status: { type: String, enum: ['waiting', 'called', 'seated', 'skipped', 'cancelled'], default: 'waiting' },
  calledAt: { type: Date },
  seatedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
})

QueueTicketSchema.index({ date: 1, category: 1, number: -1 })

module.exports = mongoose.model('queueTicket', QueueTicketSchema)
