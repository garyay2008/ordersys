const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 用戶管理：POS 員工（服務員/收銀員）
const StaffSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  no: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    default: '服務員' // 管理員 / 收銀員 / 服務員
  },
  permissionLevel: {
    type: Number,
    default: 1 // 1=服務員, 2=收銀員, 3=經理, 4=管理員
  },
  permissions: {
    type: [String],
    default: []
  },
  // 預設收銀機（登入時自動帶入）
  defaultTerminal: {
    type: String,
    default: ''
  },
  password: {
    type: String,
    default: ''
  },
  enabled: {
    type: Boolean,
    default: true
  },
  date: {
    type: Date,
    default: Date.now
  }
})

// 登入按員工編號查詢
StaffSchema.index({ no: 1 })

const Staff = mongoose.model('staff', StaffSchema)

module.exports = Staff
