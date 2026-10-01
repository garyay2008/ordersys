const mongoose = require('mongoose')
const Schema = mongoose.Schema

// QR Code 點餐版面功能設定（單例設定檔，全部可開關）
const QrSettingSchema = new Schema({
  // 客人手機顯示商品圖片（關閉後改為純文字列表）
  showImages: {
    type: Boolean,
    default: true
  },
  // 顯示商品描述
  showDescribe: {
    type: Boolean,
    default: true
  },
  // 顯示庫存剩餘（剩餘 N 份）
  showStock: {
    type: Boolean,
    default: false
  },
  // 顯示改碼加價（chip 上的 +$3）
  showModPrices: {
    type: Boolean,
    default: true
  },
  // 沽清品項照常列出（灰色）
  showSoldOutItems: {
    type: Boolean,
    default: true
  },
  // 顯示店鋪公告列
  showNotice: {
    type: Boolean,
    default: true
  },
  // 顯示店鋪詳情按鈕（右上角「詳情」）
  showDetail: {
    type: Boolean,
    default: true
  },
  // 顯示打折（原價/折扣資訊）
  showDiscount: {
    type: Boolean,
    default: true
  },
  // 版面主題（orange/green/blue/indigo/purple）
  theme: {
    type: String,
    default: 'orange'
  },
  // 客人手機版面文字/介面縮放倍數（1 = 100%）
  fontScale: {
    type: Number,
    default: 1
  },
  // 點餐網址前綴（公開 IP 或域名，例如 http://168.70.36.64:3000）。
  // 留空時，QR 碼會沿用後台瀏覽器當下的網址；填了就固定用此網址生成點餐碼。
  baseUrl: {
    type: String,
    default: ''
  },
  // 登入（歡迎）畫面背景圖網址；留空＝沿用主題漸層
  welcomeImage: {
    type: String,
    default: ''
  },
  // QR 端顯示商品「選規格」按鈕（預設關閉，直接以基礎價加購）
  showSpecs: {
    type: Boolean,
    default: false
  },
  date: {
    type: Date,
    default: Date.now
  }
})

module.exports = QrSetting = mongoose.model('qrsetting', QrSettingSchema)
