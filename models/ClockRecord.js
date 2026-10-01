const mongoose = require('mongoose')
const Schema = mongoose.Schema

const ClockRecordSchema = new Schema({
  // 員工編號
  staffNo: { type: String, default: '' },
  // 員工姓名
  staffName: { type: String, default: '' },
  // 收銀機 / 工作站編號
  terminalCode: { type: String, default: '' },
  // 上班時間
  clockInTime: { type: Date, default: null },
  // 下班時間
  clockOutTime: { type: Date, default: null },
  // 狀態：active=上班中, closed=已下班
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  // 備註
  remark: { type: String, default: '' },
  date: { type: Date, default: Date.now }
})

ClockRecordSchema.index({ staffNo: 1, terminalCode: 1, status: 1 })

module.exports = mongoose.model('clockRecord', ClockRecordSchema)
