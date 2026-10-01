const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 掛單（多工作站共用）：把尚未下單的品項暫存到後端，任何工作站都可叫回
const HoldSchema = new Schema({
  label: { type: String, default: '' },
  zone: { type: String, default: '堂食' },
  // 堂食為枱號；外賣為空字串
  deskNo: { type: String, default: '' },
  items: { type: Array, default: [] },
  remark: { type: String, default: '' },
  terminalCode: { type: String, default: '' },
  staffNo: { type: String, default: '' },
  staffName: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
})

HoldSchema.index({ createdAt: 1 })

module.exports = mongoose.model('hold', HoldSchema)
