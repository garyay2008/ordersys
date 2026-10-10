const mongoose = require('mongoose')
const Schema = mongoose.Schema
const Commodity = require('./Commodity')

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
  // QR 點餐顯示名稱（客人手機端）；留空則回退用 name（POS 套餐名稱）
  qrName: {
    type: String,
    default: ''
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
  // 不列印套餐名：true 時後廚/服務票種把套餐拆成子品項獨立打印，不印套餐名標題（收據/印單小票仍保留套餐名）
  noPrintComboName: {
    type: Boolean,
    default: false
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
  // QR 顯示自動選取品項名稱：false 時 QR 套餐選擇頁不顯示 fixed（自動選取）品項名稱（POS 永遠顯示，不受影響）
  showFixedNames: {
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
  // 主菜組別（MainGroup._id）：撞餐規則的主食側記認，'' = 非主食
  mainGroupId: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    default: Date.now
  }
})

// 依 Commodity.soldOut 為套餐內貨品（groups[].items[].commodityId）補上 soldOut 旗標（唯讀，不寫回資料庫）。
// 供點餐端（POS/QR）在套餐選擇時自動繼承全局沽清。
async function stampComboItemsSoldOut (combos) {
  if (!combos || !combos.length) return combos
  const ids = []
  const seen = new Set()
  const pushId = v => {
    if (!v) return
    const s = String(v)
    if (!seen.has(s)) { seen.add(s); ids.push(s) }
  }
  combos.forEach(c => {
    ;(c.groups || []).forEach(g => { (g.items || []).forEach(it => pushId(it.commodityId)) })
    ;(c.mainDishes || []).forEach(m => pushId(m.commodityId))
  })
  if (!ids.length) return combos
  const commodities = await Commodity.find({ _id: { $in: ids } }).select('_id soldOut').lean().exec()
  const soldOutMap = {}
  commodities.forEach(c => { soldOutMap[String(c._id)] = !!c.soldOut })
  return combos.map(c => {
    const groups = (c.groups || []).map(g => {
      const items = (g.items || []).map(it => {
        if (!it.commodityId) return it
        const s = soldOutMap[String(it.commodityId)]
        if (s === undefined) return it
        return Object.assign({}, it, { soldOut: s })
      })
      return Object.assign({}, g, { items })
    })
    return Object.assign({}, c, { groups })
  })
}

const Combo = mongoose.model('combo', ComboSchema)

Combo.stampItemsSoldOut = stampComboItemsSoldOut

module.exports = Combo
