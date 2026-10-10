const mongoose = require('mongoose')
const Schema = mongoose.Schema

const CommoditySchema = new Schema({
  img: {
    type: String,
    default: ''
  },
  name: {
    type: String,
    required: true
  },
  name2: {
    type: String,
    default: ''
  },
  describe: {
    type: String
  },
  category: {
    type: String,
    required: true
  },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: 'category',
    default: null
  },
  price: {
    type: Number,
    required: true
  },
  isDiscount: {
    type: Boolean,
    required: true
  },
  onSale: {
    type: Number,
    default: 0
  },
  soldOut: {
    type: Boolean,
    required: true
  },
  // 手動沽清日期（YYYY-MM-DD）：沽清每日自動重置時，只清「非今日、非空白」的沽清
  soldOutDate: {
    type: String,
    default: ''
  },
  stock: {
    type: Number,
    default: -1
  },
  specs: {
    type: Array,
    default: []
  },
  station: {
    type: String,
    default: ''
  },
  stations: {
    type: [String],
    default: []
  },
  modCategories: {
    type: [String],
    default: []
  },
  department: {
    type: String,
    default: ''
  },
  code: {
    type: String,
    default: ''
  },
  plu: {
    type: String,
    default: ''
  },
  // 渠道開關（Channel Visibility）：員工餐/私房菜只開 POS，自助用品只開 QR
  showOnPos: {
    type: Boolean,
    default: true
  },
  showOnQr: {
    type: Boolean,
    default: true
  },
  // 浮動價格（手寫單）：點選時由收銀員輸入實際菜名與金額
  openPrice: {
    type: Boolean,
    default: false
  },
  // 茶芥必選項目：開啟後 POS 結帳／印單需此貨品已在單內
  mandatory: {
    type: Boolean,
    default: false
  },
  // 跟餐組別（BundleGroup._id）：撞餐規則的飲品側記認，'' = 不跟餐
  bundleGroupId: {
    type: String,
    default: ''
  },
  // 主菜組別（MainGroup._id）：撞餐規則的主食側記認，'' = 非主食
  mainGroupId: {
    type: String,
    default: ''
  },
  // 非營業商品：不計入營業額（如賣紙箱/押金等），日結報表歸入「非營業項目金額」
  nonBusiness: {
    type: Boolean,
    default: false
  }
})

function pad (n) { return n < 10 ? '0' + n : '' + n }

function dateStr (d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function hhmm (d) {
  return pad(d.getHours()) + ':' + pad(d.getMinutes())
}

// 判斷日期所屬的星期/假日組別（holiday 優先）
function dayGroupOf (date, holidays) {
  const list = Array.isArray(holidays) ? holidays : []
  if (list.indexOf(dateStr(date)) >= 0) return 'holiday'
  const dow = date.getDay() === 0 ? 7 : date.getDay()
  if (dow === 6) return 'saturday'
  if (dow === 7) return 'sunday'
  return 'weekdays'
}

// 全局跳價規則解析：依日期/星期/時間/計價時機/堂食外賣回傳對應規格價，無符合回 null
function resolveJumpPrice (commodity, date, holidays, timing, rules, mode) {
  if (!commodity || !Array.isArray(rules) || !rules.length) return null
  const group = dayGroupOf(date, holidays)
  const nowHm = hhmm(date)
  let best = null
  let bestStart = ''
  for (const r of rules) {
    if (!r || r.days !== group) continue
    if (timing && r.timing !== timing) continue
    if (mode) {
      const rm = r.mode || 'all'
      if (rm !== 'all' && rm !== mode) continue
    }
    const start = r.start || '00:00'
    const end = r.end || '23:59'
    if (nowHm < start) continue
    if (end && nowHm > end) continue
    if (!best || start > bestStart) {
      best = r
      bestStart = start
    }
  }
  if (!best) return null
  const idx = Number(best.specIndex) || 1
  const specs = Array.isArray(commodity.specs) ? commodity.specs : []
  const spec = specs[idx - 1]
  if (!spec) return null
  const raw = spec.price
  if (raw === '' || raw == null) return null
  const p = Number(raw)
  if (isNaN(p) || p <= 0) return null
  return { price: p, specIndex: idx, specName: spec.name || '' }
}

CommoditySchema.statics.dayGroupOf = dayGroupOf
CommoditySchema.statics.resolveJumpPrice = resolveJumpPrice

// 依分類與 PLU 查詢
CommoditySchema.index({ categoryId: 1 })
CommoditySchema.index({ plu: 1 })

module.exports = Commodity = mongoose.model('commodity', CommoditySchema)
