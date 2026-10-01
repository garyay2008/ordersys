const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 口味改碼（客製化備註）：走蔥/少油/加辣 等，廚房印單用紅色字突出
// Modifier Master：全系統唯一改碼主檔（POS / QR / 套餐共用同一原子資料）
const ModCodeSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  // 改碼編號（如 M001、M002，POS 鍵盤 / 印單用）
  code: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    default: ''
  },
  sort: {
    type: Number,
    default: 0
  },
  // 加價改碼：轉凍飲 +$3 就是這個
  price: {
    type: Number,
    default: 0
  },
  // 多段價格（價格1～價格10），價格1＝主價格，其餘用「填滿」複製
  specs: {
    type: Array,
    default: []
  },
  // 渠道開關：pos=收銀版面, qr=客人手機；舊資料無此欄位時視為兩邊都顯示
  channels: {
    type: [String],
    default: ['pos', 'qr']
  },
  // QR 端必選（如 公仔麵/米粉 二選一），收銀端不受限制
  mandatory: {
    type: Boolean,
    default: false
  },
  // 最多可選數量（1=單選, 2+=可複選）
  maxSelect: {
    type: Number,
    default: 1
  },
  // 出單站別（廚房/水吧），印單分流用
  station: {
    type: String,
    default: ''
  },
  // POS 實體鍵盤快捷鍵（如「走青」= Q）
  quickKey: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    default: Date.now
  }
})

module.exports = ModCode = mongoose.model('modcode', ModCodeSchema)
