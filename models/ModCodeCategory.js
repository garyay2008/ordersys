const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 改碼類別：甜度與冰量 / 辣度選擇 / 油鹽與配料 等
const ModCodeCategorySchema = new Schema({
  name: {
    type: String,
    required: true
  },
  // 類別編號（如 MC01、MC02）
  code: {
    type: String,
    default: ''
  },
  // 必選改碼類別：按下貨品時自動彈出選擇（對應 ISM lookup_header.compulsory）
  mandatory: {
    type: Boolean,
    default: false
  },
  sort: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now
  }
})

module.exports = ModCodeCategory = mongoose.model('modcodecategory', ModCodeCategorySchema)
