const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 員工操作日誌：記錄 POS 關鍵操作（下單/結帳/取消/退款/分單/轉桌/解除枱號…）
const AuditLogSchema = new Schema({
  staffNo: {
    type: String,
    default: ''
  },
  staffName: {
    type: String,
    default: ''
  },
  action: {
    type: String,
    default: ''
  },
  actionLabel: {
    type: String,
    default: ''
  },
  deskNo: {
    type: String,
    default: ''
  },
  orderNo: {
    type: String,
    default: ''
  },
  detail: {
    type: String,
    default: ''
  },
  amount: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  }
})

AuditLogSchema.index({ staffNo: 1, date: -1 })
AuditLogSchema.index({ action: 1, date: -1 })

module.exports = AuditLog = mongoose.model('auditlog', AuditLogSchema)
