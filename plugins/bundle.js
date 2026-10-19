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

// 對稱重算撞餐（一配一防線）：用於分單/轉桌/合併/退菜/加單後重新校正。
// 1) 跟餐(bundlePrice) 多於主食 → 復原多餘跟餐為原價
// 2) 主食多於跟餐 → 把有跟餐組別且尚未撞餐的飲品重新標回跟餐價
// 主食/跟餐依 MatchingRule 主檔判定（不依賴前端 bundleMain 標記），避免前端漏標導致一配一失效。
async function rebalanceBundlePairs (items) {
  if (!Array.isArray(items) || !items.length) return items

  const ctx = await loadBundleContext()

  // 商品主檔 map（原價 + bundleGroupId/mainGroupId 兜底）
  const ids = []
  items.forEach(it => {
    if (!it) return
    const id = it.commodityId || it._id
    if (id) ids.push(String(id))
  })
  const validIds = [...new Set(ids)].filter(isValidObjectId)
  const comMap = {}
  if (validIds.length) {
    const commodities = await Commodity.find({ _id: { $in: validIds } }).lean().exec()
    commodities.forEach(c => { comMap[String(c._id)] = c })
  }

  const isVoided = it => !it || it.voidStatus === 1
  const origPriceOf = it => {
    if (Number(it.bundleOrigPrice) > 0) return Number(it.bundleOrigPrice)
    const id = it.commodityId || it._id
    const com = id ? comMap[String(id)] : null
    if (com && Number(com.price) > 0) return Number(com.price)
    return Number(it.price) || 0
  }

  // 依生效規則收集「主食觸發組」與「跟餐組」，供主檔判定角色
  const triggerGroups = new Set()
  const bundleGroups = new Set()
  ;(ctx.activeRules || []).forEach(r => {
    ;(r.triggerGroupIds || []).forEach(g => triggerGroups.add(String(g)))
    ;(r.bundleGroupIds || []).forEach(g => bundleGroups.add(String(g)))
  })
  const mainGroupOf = it => {
    if (!it) return ''
    if (it.mainGroupId) return String(it.mainGroupId)
    const com = comMap[String(it.commodityId || it._id)]
    return com && com.mainGroupId ? String(com.mainGroupId) : ''
  }
  // 主食：mainGroupId 被某規則 triggerGroupIds 引用（bundleMain 標記僅為兜底）
  const isMainItem = it => {
    if (!it || it.bundlePrice) return false
    const gid = mainGroupOf(it)
    return !!gid && triggerGroups.has(gid)
  }
  const addonOf = it => {
    const id = it && (it.commodityId || it._id)
    return addonPriceOf(it, id ? comMap[String(id)] : null, ctx)
  }
  const countUnits = list => {
    let mains = 0
    let addons = 0
    for (const it of list) {
      if (isVoided(it)) continue
      if (isMainItem(it) || it.bundleMain) mains += (it.count || 1)
      if (it.bundlePrice) addons += (it.count || 1)
    }
    return { mains, addons }
  }

  // 1) 復原多餘跟餐（自尾端往前）
  let { mains, addons } = countUnits(items)
  let excess = addons - mains
  if (excess > 0) {
    for (let i = items.length - 1; i >= 0 && excess > 0; i--) {
      const it = items[i]
      if (isVoided(it) || !it.bundlePrice) continue
      const cnt = it.count || 1
      const orig = origPriceOf(it)
      if (cnt <= excess) {
        it.price = orig
        it.customPrice = 0
        it.bundlePrice = false
        delete it.bundleOrigPrice
        excess -= cnt
      } else {
        const kept = Object.assign({}, it, { count: cnt - excess })
        const reverted = Object.assign({}, it, { count: excess, price: orig, customPrice: 0, bundlePrice: false })
        delete reverted.bundleOrigPrice
        items.splice(i, 1, kept, reverted)
        excess = 0
      }
    }
  }

  // 2) 重新撞餐：主食多於跟餐時，把有跟餐組別的未撞飲品標回跟餐價
  ;({ mains, addons } = countUnits(items))
  // 先依主檔補標主食（bundleMain），供後續一配一對照
  for (const it of items) {
    if (isVoided(it) || it.bundleMain || it.bundlePrice) continue
    if (isMainItem(it)) it.bundleMain = true
  }
  let freeMains = Math.max(0, mains - addons)
  if (freeMains > 0) {
    for (let i = 0; i < items.length && freeMains > 0; i++) {
      const it = items[i]
      if (isVoided(it) || it.bundleMain || it.bundlePrice) continue
      const addon = addonOf(it)
      if (addon == null) continue
      const cnt = it.count || 1
      const orig = origPriceOf(it)
      const take = Math.min(freeMains, cnt)
      if (take >= cnt) {
        it.price = addon
        it.customPrice = 0
        it.bundlePrice = true
        it.bundleOrigPrice = orig
        freeMains -= cnt
      } else {
        const bundled = Object.assign({}, it, { count: take, price: addon, customPrice: 0, bundlePrice: true, bundleOrigPrice: orig })
        const rest = Object.assign({}, it, { count: cnt - take })
        items.splice(i, 1, bundled, rest)
        freeMains -= take
      }
    }
  }

  return items
}

module.exports = { isEffectiveNow, loadBundleContext, addonPriceOf, recomputeBundlePricing, rebalanceBundlePairs }
