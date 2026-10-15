const { makeModel } = require('../db/model')
const Commodity = require('./Commodity')

const Combo = makeModel(
  'combos',
  {
    name: 'text',
    qrName: 'text',
    code: 'text',
    img: 'text',
    describe: 'text',
    category: 'text',
    department: 'text',
    price: 'numeric',
    type: 'text',
    courseControl: 'bool',
    groups: 'json',
    departmentSplit: 'json',
    mainDishes: 'json',
    autoPopup: 'bool',
    noPrintComboName: 'bool',
    autoBundle: 'bool',
    bundlePriority: 'int',
    effectiveTime: 'json',
    showItems: 'bool',
    showFixedNames: 'bool',
    soldOut: 'bool',
    showOnPos: 'bool',
    showOnQr: 'bool',
    mainGroupId: 'text',
    date: 'timestamp'
  },
  'combo',
  {
    qrName: '',
    code: '',
    img: '',
    describe: '',
    category: '',
    department: '',
    type: 'select',
    courseControl: false,
    groups: [],
    departmentSplit: [],
    mainDishes: [],
    autoPopup: true,
    noPrintComboName: false,
    bundlePriority: 0,
    effectiveTime: { type: 'permanent' },
    showItems: true,
    showFixedNames: true,
    soldOut: false,
    showOnPos: true,
    showOnQr: true,
    mainGroupId: '',
    date: () => new Date()
  }
)

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
  const commodities = await Commodity.find({ _id: { $in: ids } })
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

Combo.stampItemsSoldOut = stampComboItemsSoldOut

module.exports = Combo
