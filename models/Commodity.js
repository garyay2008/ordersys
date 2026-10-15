const { makeModel } = require('../db/model')

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

const Commodity = makeModel(
  'commodities',
  {
    img: 'text',
    name: 'text',
    name2: 'text',
    describe: 'text',
    category: 'text',
    categoryId: 'id',
    price: 'numeric',
    isDiscount: 'bool',
    onSale: 'int',
    soldOut: 'bool',
    soldOutDate: 'text',
    stock: 'int',
    specs: 'json',
    station: 'text',
    stations: 'json',
    modCategories: 'json',
    department: 'text',
    code: 'text',
    plu: 'text',
    showOnPos: 'bool',
    showOnQr: 'bool',
    openPrice: 'bool',
    mandatory: 'bool',
    bundleGroupId: 'text',
    mainGroupId: 'text',
    nonBusiness: 'bool'
  },
  'commodity',
  {
    img: '',
    name2: '',
    describe: '',
    categoryId: null,
    onSale: 0,
    soldOutDate: '',
    stock: -1,
    specs: [],
    station: '',
    stations: [],
    modCategories: [],
    department: '',
    code: '',
    plu: '',
    showOnPos: true,
    showOnQr: true,
    openPrice: false,
    mandatory: false,
    bundleGroupId: '',
    mainGroupId: '',
    nonBusiness: false
  }
)

Commodity.dayGroupOf = dayGroupOf
Commodity.resolveJumpPrice = resolveJumpPrice

module.exports = Commodity
