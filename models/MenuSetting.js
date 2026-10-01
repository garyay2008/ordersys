const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 電子菜單（牆上大螢幕數位菜單板）顯示設定（單例，純展示不下單）
const MenuSettingSchema = new Schema({
  // 顯示商品圖片
  showImages: {
    type: Boolean,
    default: true
  },
  // 顯示價格
  showPrice: {
    type: Boolean,
    default: true
  },
  // 顯示商品描述
  showDescribe: {
    type: Boolean,
    default: false
  },
  // 沽清品項照常列出（灰色）
  showSoldOut: {
    type: Boolean,
    default: true
  },
  // 自動輪播分類
  autoRotate: {
    type: Boolean,
    default: true
  },
  // 輪播秒數
  rotateInterval: {
    type: Number,
    default: 8
  },
  // 每列欄數
  columns: {
    type: Number,
    default: 4
  },
  // 字體倍率（1 = 100%）
  fontScale: {
    type: Number,
    default: 1
  },
  // 要顯示的分類 ID（空 = 全部）
  categoryIds: {
    type: Array,
    default: []
  },
  // 主題色（header 背景）
  themeColor: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    default: Date.now
  }
})

module.exports = MenuSetting = mongoose.model('menusetting', MenuSettingSchema)
