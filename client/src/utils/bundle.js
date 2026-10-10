// 撞餐（自動組餐）純函數
// 將購物車中的多項單點，比對 Combo 套餐的 groups/items，自動組合成套餐價。
// 純函數：不依賴 Vue / 後端，方便測試與未來在 POS / QR 端共用。

// 單一貨品是否可參與撞餐
// 排除：贈送、已折扣、已改價、無 _id 的品項；
// 套餐（combo）僅在被標記為主菜組別（mainGroupId，主食側）時參與撞餐，
// 否則維持既有行為（套餐本身已含組合價，不再重複撞餐）。
export function isBundlableItem (item) {
  if (!item) return false
  const isCombo = !!(item.comboId || item._isCombo || item._itemType === 'combo' || item.isCombo)
  if (isCombo && !item.mainGroupId) return false
  if (item.free) return false
  if (item.discount !== undefined && Number(item.discount) < 1) return false
  if (Number(item.customPrice) > 0) return false
  if (!item._id) return false
  return true
}

// 生效時段判斷（與後端 Category.isEffectiveNow 同款邏輯）
// et: { type, startDate, endDate, startTime, endTime, weekdays, holidays }
export function isEffectiveNow (et, now = new Date()) {
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

// 套餐是否參與自動撞餐
// autoBundle === false 強制排除；=== true 強制加入；
// 未設定時，預設僅「選單式（select）」自動撞餐，「固定式（fixed）」不自動。
// 另依套餐 effectiveTime 判斷目前是否在生效時段內。
export function isBundlableCombo (combo, now = new Date()) {
  if (!combo || combo.soldOut) return false
  if (!isEffectiveNow(combo.effectiveTime, now)) return false
  if (!Array.isArray(combo.groups) || !combo.groups.length) return false
  if (combo.autoBundle === false) return false
  if (combo.autoBundle === true) return true
  return combo.type !== 'fixed'
}

// 建立分組內 commodityId -> 套餐品項 的對照（含 upgradePrice）
function groupLookup (group) {
  const map = {}
  ;(group.items || []).forEach((it, ii) => {
    const key = String(it.commodityId || '')
    if (key) map[key] = { item: it, ii }
  })
  return map
}

// 嘗試用目前剩餘的單點組出「一組」套餐
// singles: [{ index, _id, name, price, remaining }]（會被就地扣除）
// 回傳 { savings, original, bundled, selected } 或 null（無法成組／不省錢）
function tryBuildSet (combo, singles) {
  const groups = combo.groups || []
  const selected = [] // { gi, index, name, price, upgradePrice }
  let original = 0
  let bundled = Number(combo.price) || 0

  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi]
    const lookup = groupLookup(g)
    const rawMin = (g.min === undefined || g.min === null) ? 1 : Number(g.min)
    const minPick = isNaN(rawMin) ? 1 : Math.max(0, rawMin)
    let maxPick = Number(g.max)
    if (!maxPick || maxPick < 0) maxPick = Infinity
    else maxPick = Math.max(minPick, Math.floor(maxPick))

    // 該分組可用的單點（依單價由高到低，優先取貴的先省最多）
    const candidates = singles
      .filter(s => s.remaining > 0 && lookup[String(s._id)])
      .sort((a, b) => b.price - a.price)

    const totalUnits = candidates.reduce((sum, s) => sum + s.remaining, 0)
    if (totalUnits < minPick) return null

    let picked = 0
    // 先取每組最低數量（min）
    for (const s of candidates) {
      if (picked >= minPick) break
      const entry = lookup[String(s._id)]
      const upgrade = Number(entry.item.upgradePrice) || 0
      while (s.remaining > 0 && picked < minPick) {
        selected.push({ gi, index: s.index, name: s.name, price: s.price, upgradePrice: upgrade, ii: entry.ii, commodityId: s._id })
        original += s.price
        bundled += upgrade
        s.remaining--
        picked++
      }
    }

    // 再視 max 追加，只要該品項單價 > 加價（upgradePrice）仍省錢就加
    if (picked < maxPick) {
      for (const s of candidates) {
        if (picked >= maxPick) break
        const entry = lookup[String(s._id)]
        const upgrade = Number(entry.item.upgradePrice) || 0
        while (s.remaining > 0 && picked < maxPick && s.price > upgrade) {
          selected.push({ gi, index: s.index, name: s.name, price: s.price, upgradePrice: upgrade, ii: entry.ii, commodityId: s._id })
          original += s.price
          bundled += upgrade
          s.remaining--
          picked++
        }
        if (s.remaining > 0 && s.price <= upgrade) break
      }
    }
    // 分組加購價：此分組有揀選（picked > 0）時，在套餐底價上再加一次 groupPrice
    if (picked > 0) bundled += Number(g.groupPrice) || 0
  }

  const savings = Math.round((original - bundled) * 100) / 100
  if (savings <= 0) return null
  return { savings, original, bundled, selected }
}

// 預估某套餐「單組」可省多少（排序用，不影響原 singles）
function estimateComboSavings (combo, singles) {
  const clone = singles.map(s => Object.assign({}, s))
  const set = tryBuildSet(combo, clone)
  return set ? set.savings : 0
}

/**
 * 撞餐主函數
 * @param {Array} order 購物車品項陣列
 * @param {Array} combos 套餐清單（Combo 文件）
 * @param {Object} posSetting { bundleEnabled, bundleRule('bestPrice'|'priority') }
 * @param {Date} now 目前時間（預設 new Date()，供時段過濾與測試）
 * @returns {Object} {
 *   bundles: [{ comboId, comboName, price, original, savings, items:[{index, gi, ii, commodityId, name, upgradePrice, qty}] }],
 *   bundledIndexes: [number], // 被撞餐用到的購物車 index
 *   totalSavings: number
 * }
 */
export function computeBundles (order = [], combos = [], posSetting = {}, now = new Date()) {
  const result = { bundles: [], bundledIndexes: [], totalSavings: 0 }
  if (!posSetting || !posSetting.bundleEnabled) return result

  // 收集可撞餐的單點（含數量展開）
  const singles = []
  ;(order || []).forEach((item, index) => {
    if (!isBundlableItem(item)) return
    const qty = Math.max(1, Math.floor(Number(item.count) || 1))
    singles.push({
      index,
      _id: String(item._id || ''),
      name: item.name || '',
      price: Number(item.price) || 0,
      remaining: qty
    })
  })
  if (!singles.length) return result

  const candidates = (combos || [])
    .filter(c => isBundlableCombo(c, now))
    .map(combo => ({ combo, estimate: estimateComboSavings(combo, singles) }))

  // 排序：priority = 套餐優先級；bestPrice = 單組省最多優先
  const rule = posSetting.bundleRule || 'bestPrice'
  if (rule === 'priority') {
    candidates.sort((a, b) => (Number(b.combo.bundlePriority) || 0) - (Number(a.combo.bundlePriority) || 0))
  } else {
    candidates.sort((a, b) => b.estimate - a.estimate)
  }

  for (const c of candidates) {
    const combo = c.combo
    while (true) {
      // 在複本上試組，成功才扣減真實 singles，避免 tryBuildSet 組不成（例如某規則主食組有貨但跟餐組為空）時留下殘留扣減
      const working = singles.map(s => Object.assign({}, s))
      const set = tryBuildSet(combo, working)
      if (!set) break

      set.selected.forEach(s => {
        const real = singles.find(x => x.index === s.index)
        if (real) real.remaining--
      })

      const items = set.selected.map(s => ({
        index: s.index,
        gi: s.gi,
        ii: s.ii,
        commodityId: s.commodityId || '',
        name: s.name || '',
        upgradePrice: s.upgradePrice || 0,
        qty: 1
      }))

      result.bundles.push({
        comboId: combo._id,
        comboName: combo.name || '',
        price: set.bundled,
        original: set.original,
        savings: set.savings,
        items
      })
      result.totalSavings += set.savings
      set.selected.forEach(s => result.bundledIndexes.push(s.index))
    }
  }

  result.totalSavings = Math.round(result.totalSavings * 100) / 100
  result.bundledIndexes = [...new Set(result.bundledIndexes)]
  return result
}
