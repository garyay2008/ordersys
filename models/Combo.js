const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 中式客製化選項（Modifier）：如 少油 / 走蔥 / 蔥絲多
const ModifierSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    default: 0
  }
}, { _id: false })

// 換菜替代品（Substitution）
const SubstituteSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    default: 0
  },
  priceDelta: {
    type: Number,
    default: 0
  }
}, { _id: false })

// 套餐分組內可選單品
const ComboItemSchema = new Schema({
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
  },
  modifiers: {
    type: [ModifierSchema],
    default: []
  },
  substitutes: {
    type: [SubstituteSchema],
    default: []
  }
}, { _id: false })

// 主食綁定：點擊這些主食（commodityId）會自動帶出本套餐（主食自動彈出）
const MainDishSchema = new Schema({
  commodityId: {
    type: String,
    default: ''
  },
  name: {
    type: String,
    default: ''
  }
}, { _id: false })

// 收入分帳：套餐賣價拆返各部門收入
const DepartmentSplitSchema = new Schema({
  department: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    default: 0
  }
}, { _id: false })

// 套餐階段（Modifier Group）：精選冷盤 / 經典熱炒 / 招牌主食 ...
const ComboGroupSchema = new Schema({
  name: {
    type: String,
    required: true
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
  fixed: {
    type: Boolean,
    default: false
  },
  station: {
    type: String,
    default: ''
  },
  // 整組套用同一加價（Apply to All Items）：啟用時全組品項統一用 uniformUpgrade 作為加價
  uniformUpgradeEnabled: {
    type: Boolean,
    default: false
  },
  uniformUpgrade: {
    type: Number,
    default: 0
  },
  // 分組加購價（跟餐加購）：只要此分組有揀選（≥1 項），就在套餐底價上再加此金額一次
  groupPrice: {
    type: Number,
    default: 0
  },
  items: {
    type: [ComboItemSchema],
    default: []
  }
}, { _id: false })

// 撞餐生效時段（依 Category.effectiveTime 同款結構；撞餐為 POS 專屬，故僅單層）
const EffectiveTimeSchema = new Schema({
  type: {
    type: String,
    enum: ['permanent', 'dateRange', 'weekly', 'disabled'],
    default: 'permanent'
  },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  weekdays: { type: [Number], default: [1, 2, 3, 4, 5] },
  holidays: { type: [String], default: [] }
}, { _id: false })

const ComboSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  code: {
    type: String,
    default: ''
  },
  img: {
    type: String,
    default: ''
  },
  describe: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    default: ''
  },
  department: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    default: 'select' // select=選單式合菜 | fixed=固定式桌菜
  },
  courseControl: {
    type: Boolean,
    default: false
  },
  groups: {
    type: [ComboGroupSchema],
    default: []
  },
  // 引用的可重用跟餐組（AddonGroup._id）：點餐端讀取時與 groups 一併展開
  addonGroupIds: {
    type: [String],
    default: []
  },
  departmentSplit: {
    type: [DepartmentSplitSchema],
    default: []
  },
  mainDishes: {
    type: [MainDishSchema],
    default: []
  },
  autoPopup: {
    type: Boolean,
    default: true
  },
  // 自動撞餐（背景碰撞）：false 強制不參與；true 強制參與；未設定時依 type（fixed 不自動，其餘自動）
  autoBundle: {
    type: Boolean
  },
  // 撞餐優先級（計價規則選「優先級」時用，數字越大越優先）
  bundlePriority: {
    type: Number,
    default: 0
  },
  effectiveTime: {
    type: EffectiveTimeSchema,
    default: () => ({ type: 'permanent' })
  },
  showItems: {
    type: Boolean,
    default: true
  },
  soldOut: {
    type: Boolean,
    default: false
  },
  // 渠道開關（Channel Visibility）：跟 Commodity 一致，控制套餐在 POS/QR 是否顯示
  showOnPos: {
    type: Boolean,
    default: true
  },
  showOnQr: {
    type: Boolean,
    default: true
  },
  date: {
    type: Date,
    default: Date.now
  }
})

module.exports = Combo = mongoose.model('combo', ComboSchema)
