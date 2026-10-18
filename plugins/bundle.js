// 撞餐（matching rule）後端權威重算
// 依 MatchingRule / BundleGroup / Commodity 主檔重算「跟餐價」，
// 讓 POS / QR 前端送來的價格僅為預覽，後端存檔前以主檔為準，
// 避免前端漏標記（bundlePrice / bundleMain / bundleOrigPrice）或主檔調價後訂單仍沿用舊價。

const MatchingRule = require('../models/MatchingRule')
const BundleGroup = require('../models/BundleGroup')
const Commodity = require('../models/Commodity')

// 生效時段判斷（與 POS/QR 前端 utils/bundle.js 同款邏輯）
function isEffectiveNow (et, now = new Date()) {
  if (!et || et.type === 'permanent') return true
  if (et.type === 'disabled') return false
  const d = now instanceof Date ? now : new Date(now)
  if (et.type === 'dateRange') {
    if (et.startDate) {
      const start = new Date(et.startDate)
      if (d < start) return false
    }
    if (et.endDate) {
      const end = new Date(et.endDate)
      end.setHours(23, 59, 59, 999)
      if (d > end) return false
    }
  }
  if (et.type === 'weekly') {
    const dow = d.getDay() === 0 ? 7 : d.getDay()
    if (Array.isArray(et.weekdays) && !et.weekdays.includes(dow)) return false
    if (Array.isArray(et.holidays) && et.holidays.length) {
      const today = d.toISOString().slice(0, 10)
      if (et.holidays.includes(today)) return false
    }
  }
  if (et.startTime && et.endTime) {
    const hhmm = d.toTimeString().slice(0, 5)
    if (hhmm < et.startTime || hhmm > et.endTime) return false
  }
  return true
}

function isValidObjectId (id) {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)
}

// 載入撞餐上下文：啟用且生效中的規則 + 跟餐組別價目
async function loadBundleContext () {
  const [rules, groups] = await Promise.all([
    MatchingRule.find({ enabled: { $ne: false } }).lean().exec(),
    BundleGroup.find({}).lean().exec()
  ])
  const activeRules = (rules || []).filter(r => isEffectiveNow(r.effectiveTime))
  const groupPriceMap = {}
  ;(groups || []).forEach(g => { groupPriceMap[String(g._id)] = Number(g.price) || 0 })
  // 任意跟餐（未指定跟餐組別）規則，取優先級最高者
  const anyRules = activeRules
    .filter(r => !(r.bundleGroupIds && r.bundleGroupIds.length))
    .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0))
  return { activeRules, groupPriceMap, anyRules }
}

// 計算品項的跟餐價；無對應有效規則/組別時回傳 null（表示應復原原價）
function addonPriceOf (item, com, ctx) {
  const bgid = (item.bundleGroupId && String(item.bundleGroupId)) ||
    (com && com.bundleGroupId ? String(com.bundleGroupId) : '')
  if (bgid) {
    // 需有生效規則引用此跟餐組別，才視為有效跟餐（規則被刪/停用則復原）
    const referenced = ctx.activeRules.some(r => (r.bundleGroupIds || []).map(String).includes(bgid))
    if (!referenced) return null
    const p = ctx.groupPriceMap[bgid]
    return p != null ? (Number(p) || 0) : null
  }
  // 任意跟餐：取最高優先級、且未指定跟餐組別的規則之 addonPrice
  const rule = ctx.anyRules[0]
  if (rule && Number(rule.addonPrice) >= 0) return Number(rule.addonPrice) || 0
  return null
}

// 權威重算跟餐價：對 bundlePrice 品項重算 price、補齊 bundleOrigPrice；
// 無效跟餐（規則/組別不存在）復原原價。回傳 { items, delta }，delta 為總價變動。
async function recomputeBundlePricing (items) {
  if (!Array.isArray(items) || !items.length) return { items: items || [], delta: 0 }
  const hasBundle = items.some(it => it && it.bundlePrice)
  if (!hasBundle) return { items, delta: 0 }

  const ctx = await loadBundleContext()

  const ids = []
  items.forEach(it => {
    if (!it) return
    const id = it.commodityId || it._id
    if (id) ids.push(String(id))
  })
  const validIds = [...new Set(ids)].filter(isValidObjectId)
  let comMap = {}
  if (validIds.length) {
    const commodities = await Commodity.find({ _id: { $in: validIds } }).lean().exec()
    commodities.forEach(c => { comMap[String(c._id)] = c })
  }

  let delta = 0
  for (const it of items) {
    if (!it || !it.bundlePrice) continue
    const id = it.commodityId || it._id
    const com = id ? comMap[String(id)] : null
    const orig = Number(it.bundleOrigPrice) > 0
      ? Number(it.bundleOrigPrice)
      : (com && Number(com.price) > 0 ? Number(com.price) : (Number(it.price) || 0))
    const addon = addonPriceOf(it, com, ctx)
    const count = it.count || 1
    const oldPrice = Number(it.price) || 0
    const discount = it.discount !== undefined ? (Number(it.discount) || 1) : 1

    if (addon == null) {
      // 規則/組別已不存在：復原原價（去跟餐標記）
      it.price = orig
      it.customPrice = 0
      it.bundlePrice = false
      delete it.bundleOrigPrice
      delta += Math.round((orig - oldPrice) * discount * count * 100) / 100
    } else {
      it.price = addon
      it.customPrice = 0
      it.bundlePrice = true
      it.bundleOrigPrice = orig
      delta += Math.round((addon - oldPrice) * discount * count * 100) / 100
    }
  }
  return { items, delta }
}

module.exports = { isEffectiveNow, loadBundleContext, addonPriceOf, recomputeBundlePricing }
