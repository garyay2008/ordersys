const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 撞餐「獨立規則表」：不預先定義套餐，直接以規則做跨品項計價配對。
// 例：任一「飯類」主食 + 任一「飲品」跟餐 → 合計價 $48。
const MatchingRuleSchema = new Schema({
  name: { type: String, required: true }, // 規則名稱，如：飯類 + 凍飲
  enabled: { type: Boolean, default: true },
  priority: { type: Number, default: 0 }, // 規則優先級（數字越大越優先）
  triggerCategoryIds: { type: [String], default: [] }, // 主食分類（空 = 任意主食）
  addonCategoryIds: { type: [String], default: [] }, // 跟餐分類（空 = 任意跟餐）
  bundleGroupIds: { type: [String], default: [] }, // 跟餐組別（有值時撞組別，跟餐價取自組別，忽略 addonPrice）
  addonPrice: { type: Number, default: 0 }, // 跟餐價（撞餐時跟餐的特別價，主食保留原價）
  effectiveTime: {
    type: { type: String, default: 'permanent' }, // permanent / dateRange / weekly / disabled
    startDate: String,
    endDate: String,
    startTime: String,
    endTime: String,
    weekdays: { type: [Number], default: [1, 2, 3, 4, 5] },
    holidays: { type: [String], default: [] }
  },
  date: { type: Date, default: Date.now }
})

module.exports = MatchingRule = mongoose.model('matchingrule', MatchingRuleSchema)
