const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 自助點餐機（含付款）設定（單例設定檔）
const KioskSettingSchema = new Schema({
  // 可用付款方式（排除現金/信用卡）
  paymentMethods: {
    type: [String],
    default: ['八達通', '行動支付']
  },
  // 行動支付 FPS 收款 QR 圖片網址（空則顯示文字提示）
  fpsQrImage: {
    type: String,
    default: ''
  },
  // 顯示商品圖片
  showImages: {
    type: Boolean,
    default: true
  },
  // 自助機對應的收銀機編號（單號前綴來源，空則用時間戳單號）
  terminalCode: {
    type: String,
    default: ''
  },
  // 開啟堂食點餐
  dineIn: {
    type: Boolean,
    default: true
  },
  // 開啟外賣自取點餐
  takeaway: {
    type: Boolean,
    default: true
  },
  // 開啟「查單付款」（輸入單號付款）
  payByOrderNo: {
    type: Boolean,
    default: true
  },
  date: {
    type: Date,
    default: Date.now
  }
})

module.exports = KioskSetting = mongoose.model('kiosksetting', KioskSettingSchema)
