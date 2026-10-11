const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 分機（收銀機/工作站）授權：以收銀機編號（PosTerminal.code）綁定
// 每台分機需各自啟用一份授權碼，由主機伺服器統一驗證
const TerminalLicenseSchema = new Schema({
  // 收銀機編號（唯一識別碼，如 POS-01、KIOSK-01）
  code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // 授權碼（ORDERSYS.<payload>.<sig>），每次驗證時重新檢查簽名與到期日
  key: {
    type: String,
    required: true
  },
  activatedAt: {
    type: Date,
    default: Date.now
  }
})

module.exports = mongoose.model('TerminalLicense', TerminalLicenseSchema)
