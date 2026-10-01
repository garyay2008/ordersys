const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 跟餐組內可選品項（差價 Delta：相較於基本跟餐價的加收金額）
const AddonItemSchema = new Schema({
  commodityId: {
    type: String,
    default: ''
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    default: 0
  },
  upgradePrice: {
    type: Number,
    default: 0
  },
  modCategories: {
    type: [String],
    default: []
  }
}, { _id: false })

// 可重用跟餐組（永富 Set Add-on Groups）
// 可被多個套餐（Combo.addonGroupIds）或貨品（Commodity.addonGroupIds）引用
const AddonGroupSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  // 分組加購價（跟餐加購）：只要此分組有揀選（≥1 項），就在主食價上再加此金額一次
  groupPrice: {
    type: Number,
    default: 0
  },
  min: {
    type: Number,
    default: 1
  },
  max: {
    type: Number,
    default: 1
  },
  allowRepeat: {
    type: Boolean,
    default: false
  },
  station: {
    type: String,
    default: ''
  },
  uniformUpgradeEnabled: {
    type: Boolean,
    default: false
  },
  uniformUpgrade: {
    type: Number,
    default: 0
  },
  items: {
    type: [AddonItemSchema],
    default: []
  },
  date: {
    type: Date,
    default: Date.now
  }
})

module.exports = AddonGroup = mongoose.model('addongroup', AddonGroupSchema)
