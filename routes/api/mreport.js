// 老闆手機圖形化報表（唯讀）：今日摘要、近 N 天趨勢、熱銷品項、付款方式與堂食/外賣分佈
const express = require('express')
const router = express.Router()
const passport = require('passport')
const moment = require('moment')
const Order = require('../../models/Order')
const PosSetting = require('../../models/PosSetting')
const Commodity = require('../../models/Commodity')
const Category = require('../../models/Category')
const Table = require('../../models/Table')
const { requireAdmin } = require('../../middleware/auth')

const money = v => Math.round((Number(v) || 0) * 100) / 100

const guard = [passport.authenticate('jwt', { session: false }), requireAdmin]

// 指定日期當天起訖 Date（依 local time）
function dayRange (dateStr) {
  const d = moment(dateStr, 'YYYY-MM-DD', true)
  if (!d.isValid()) return null
  return { start: d.startOf('day').toDate(), end: d.add(1, 'day').startOf('day').toDate() }
}

// 指定日期已結訂單
async function settledOrders (dateStr) {
  const r = dayRange(dateStr)
  if (!r) return []
  return Order.find({ date: { $gte: r.start, $lt: r.end }, state: 1 }).exec()
}

// 指定日期全部訂單（含未結/取消）
async function ordersOnDay (dateStr) {
  const r = dayRange(dateStr)
  if (!r) return []
  return Order.find({ date: { $gte: r.start, $lt: r.end } }).exec()
}

// 部門收入匯總（與 statisticData 同邏輯，套餐依 departmentSplit 分帳，一般品項依 部門→商品→分類→未分類）
async function computeDeptRevenue (orders) {
  const [commodities, categories] = await Promise.all([
    Commodity.find().exec(),
    Category.find().exec()
  ])
  const comMap = {}
  commodities.forEach(c => { comMap[String(c._id)] = c })
  const catMap = {}
  categories.forEach(c => { catMap[String(c._id)] = c; catMap[c.cName] = c })
  const itemSubtotal = (item) => {
    const base = item.free ? 0 : (item.customPrice > 0 ? item.customPrice : (item.price || 0))
    return money(base * (item.discount || 1) * (item.count || 1))
  }
  const resolveDept = (item) => {
    if (item.department && String(item.department).trim()) return String(item.department).trim()
    const cid = item.commodityId || item._id
    const com = cid ? comMap[String(cid)] : null
    if (com && com.department) return com.department
    const cat = (item.categoryId ? catMap[String(item.categoryId)] : null) || (item.category ? catMap[item.category] : null)
    if (cat && cat.department) return cat.department
    return '未分類'
  }
  const map = {}
  orders.forEach(o => {
    ;(o.order || []).forEach(item => {
      if (!item || item.voidStatus === 1) return
      const split = item.departmentSplit
      if (Array.isArray(split) && split.length) {
        split.forEach(s => {
          const dept = (s && s.department && String(s.department).trim()) ? String(s.department).trim() : '未分類'
          const amt = Number(s.amount) || 0
          if (!map[dept]) map[dept] = { name: dept, amount: 0, count: 0 }
          map[dept].amount = money(map[dept].amount + amt)
          map[dept].count += 1
        })
        return
      }
      const dept = resolveDept(item)
      if (!map[dept]) map[dept] = { name: dept, amount: 0, count: 0 }
      map[dept].amount = money(map[dept].amount + itemSubtotal(item))
      map[dept].count += 1
    })
  })
  return Object.keys(map).map(k => map[k]).sort((a, b) => b.amount - a.amount)
}

// GET /api/mreport/summary → 今日營業摘要 + 昨日對比 + 未結單數
router.get('/summary', guard, async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD')
    const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD')
    const [todayOrders, yesterdayOrders, unpaid] = await Promise.all([
      settledOrders(today),
      settledOrders(yesterday),
      Order.find({ state: 0 }).exec()
    ])
    const revenue = money(todayOrders.reduce((s, o) => s + (o.totalPrice || 0), 0))
    const yesterdayRevenue = money(yesterdayOrders.reduce((s, o) => s + (o.totalPrice || 0), 0))
    const orders = todayOrders.length
    const pax = todayOrders.reduce((s, o) => s + (Number(o.pax) || 0), 0)
    const yesterdayPax = yesterdayOrders.reduce((s, o) => s + (Number(o.pax) || 0), 0)
    res.json({
      date: today,
      revenue,
      orders,
      avgCheck: orders ? money(revenue / orders) : 0,
      pax,
      avgCover: pax ? money(revenue / pax) : 0,
      unpaid: unpaid.length,
      yesterday: {
        revenue: yesterdayRevenue,
        orders: yesterdayOrders.length,
        pax: yesterdayPax,
        avgCover: yesterdayPax ? money(yesterdayRevenue / yesterdayPax) : 0
      }
    })
  } catch (err) {
    console.log('[mreport/summary] ' + err.message)
    res.status(400).json({ msg: '獲取摘要失敗' })
  }
})

// GET /api/mreport/trend?days=7 → 近 N 天每日營業額與訂單數
router.get('/trend', guard, async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 90)
    const start = moment().subtract(days - 1, 'day').startOf('day').toDate()
    const end = moment().add(1, 'day').startOf('day').toDate()
    const orders = await Order.find({ date: { $gte: start, $lt: end }, state: 1 }).exec()

    const map = {}
    for (let i = 0; i < days; i++) {
      const key = moment().subtract(days - 1 - i, 'day').format('YYYY-MM-DD')
      map[key] = { revenue: 0, orders: 0, pax: 0 }
    }
    orders.forEach(o => {
      const key = moment(o.date).format('YYYY-MM-DD')
      if (map[key]) {
        map[key].revenue = money(map[key].revenue + (o.totalPrice || 0))
        map[key].orders += 1
        map[key].pax += Number(o.pax) || 0
      }
    })

    const dates = []
    const revenue = []
    const orderCounts = []
    const avgCover = []
    Object.keys(map).forEach(k => {
      dates.push(moment(k, 'YYYY-MM-DD').format('MM/DD'))
      revenue.push(map[k].revenue)
      orderCounts.push(map[k].orders)
      avgCover.push(map[k].pax ? money(map[k].revenue / map[k].pax) : 0)
    })
    res.json({ dates, revenue, orders: orderCounts, avgCover })
  } catch (err) {
    console.log('[mreport/trend] ' + err.message)
    res.status(400).json({ msg: '獲取趨勢失敗' })
  }
})

// GET /api/mreport/slots → 今日分市（時段）營業額，含昨日/上週同日對比與時段下鑽（熱銷+折扣）
router.get('/slots', guard, async (req, res) => {
  try {
    const setting = await PosSetting.findOne().exec()
    const globalSlots = (setting && Array.isArray(setting.slots))
      ? setting.slots.filter(s => s && s.name && s.start && s.end)
      : []
    const toMinutes = value => {
      const parts = String(value).split(':').map(Number)
      return (parts[0] || 0) * 60 + (parts[1] || 0)
    }
    const slotOf = d => {
      const hm = moment(d).format('HH:mm')
      const current = toMinutes(hm)
      const s = globalSlots.find(x => {
        const startMinutes = toMinutes(x.start)
        const endMinutes = toMinutes(x.end)
        return startMinutes < endMinutes
          ? current >= startMinutes && current < endMinutes
          : current >= startMinutes || current < endMinutes
      })
      return s ? s.name : '非時段'
    }
    // 品項級折扣估算（贈送/改價/折扣率），與「全日折扣報表」單項折扣邏輯一致
    const itemDiscount = item => {
      const count = Number(item.count || item.qty || 1)
      const price = Number(item.price) || 0
      if (item.free) return money(price * count)
      const custom = Number(item.customPrice) || 0
      if (custom > 0 && custom < price) return money((price - custom) * count)
      const d = Number(item.discount)
      if (d < 1 && d >= 0) return money(price * count * (1 - d))
      return 0
    }
    // 聚合某一天的已結訂單到各時段（含品項熱銷 map）
    const aggregate = (orders) => {
      const map = {}
      globalSlots.forEach(s => { map[s.name] = { revenue: 0, orders: 0, discount: 0, itemMap: {} } })
      orders.forEach(o => {
        const name = slotOf(o.settledAt || o.date)
        if (!map[name]) map[name] = { revenue: 0, orders: 0, discount: 0, itemMap: {} }
        const b = map[name]
        b.revenue = money(b.revenue + (o.totalPrice || 0))
        b.orders += 1
        b.discount = money(b.discount + (o.discount || 0))
        ;(o.order || []).forEach(item => {
          if (!item || item.voidStatus === 1) return
          b.discount = money(b.discount + itemDiscount(item))
          const n = item.name || '未命名'
          const count = Number(item.count || item.qty || 1)
          const price = item.free ? 0 : (Number(item.customPrice) > 0 ? Number(item.customPrice) : (Number(item.price) || 0))
          const amount = money(price * count * (Number(item.discount) || 1))
          if (!b.itemMap[n]) b.itemMap[n] = { name: n, qty: 0, amount: 0 }
          b.itemMap[n].qty += count
          b.itemMap[n].amount = money(b.itemMap[n].amount + amount)
        })
      })
      return map
    }

    const today = moment().format('YYYY-MM-DD')
    const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD')
    const lastWeek = moment().subtract(7, 'day').format('YYYY-MM-DD')
    const [todayOrders, yesterdayOrders, lastWeekOrders] = await Promise.all([
      settledOrders(today),
      settledOrders(yesterday),
      settledOrders(lastWeek)
    ])
    const todayMap = aggregate(todayOrders)
    const yesterdayMap = aggregate(yesterdayOrders)
    const lastWeekMap = aggregate(lastWeekOrders)

    const buildSlot = (name, label, t, y, w) => ({
      name,
      label,
      revenue: t.revenue,
      orders: t.orders,
      avgCheck: t.orders ? money(t.revenue / t.orders) : 0,
      discount: t.discount,
      yesterdayRevenue: y.revenue,
      lastWeekRevenue: w.revenue,
      topItems: Object.values(t.itemMap).sort((a, b) => b.qty - a.qty).slice(0, 3)
    })

    const slots = globalSlots.map(s => buildSlot(s.name, s.name + ' ' + s.start + '-' + s.end, todayMap[s.name], yesterdayMap[s.name], lastWeekMap[s.name]))
    Object.keys(todayMap).forEach(k => {
      if (!globalSlots.some(s => s.name === k)) slots.push(buildSlot(k, k, todayMap[k], yesterdayMap[k], lastWeekMap[k]))
    })
    res.json({ slots })
  } catch (err) {
    console.log('[mreport/slots] ' + err.message)
    res.status(400).json({ msg: '獲取分市報表失敗' })
  }
})

// GET /api/mreport/top?limit=10 → 今日熱銷品項（依數量排序）
router.get('/top', guard, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50)
    const today = moment().format('YYYY-MM-DD')
    const list = await settledOrders(today)
    const map = {}
    list.forEach(o => (o.order || []).forEach(item => {
      if (!item || item.voidStatus === 1) return
      const name = item.name || '未命名'
      const count = Number(item.count || item.qty || 1)
      const price = item.free ? 0 : (Number(item.customPrice) > 0 ? Number(item.customPrice) : (Number(item.price) || 0))
      const amount = money(price * count * (Number(item.discount) || 1))
      if (!map[name]) map[name] = { name, qty: 0, amount: 0 }
      map[name].qty += count
      map[name].amount = money(map[name].amount + amount)
    }))
    const items = Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, limit)
    res.json({ items })
  } catch (err) {
    console.log('[mreport/top] ' + err.message)
    res.status(400).json({ msg: '獲取熱銷品項失敗' })
  }
})

// GET /api/mreport/payment → 今日付款方式分佈 + 堂食/外賣分佈
router.get('/payment', guard, async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD')
    const list = await settledOrders(today)
    const payMap = {}
    const typeMap = {
      dineIn: { name: '堂食', count: 0, amount: 0 },
      takeaway: { name: '外賣', count: 0, amount: 0 }
    }
    list.forEach(o => {
      const pm = o.payMethod || '未指定'
      if (!payMap[pm]) payMap[pm] = { name: pm, count: 0, amount: 0 }
      payMap[pm].count += 1
      payMap[pm].amount = money(payMap[pm].amount + (o.totalPrice || 0))
      const t = (o.tableType === 2 || o.subtype === 2) ? typeMap.takeaway : typeMap.dineIn
      t.count += 1
      t.amount = money(t.amount + (o.totalPrice || 0))
    })
    res.json({
      payment: Object.values(payMap).sort((a, b) => b.amount - a.amount),
      types: [typeMap.dineIn, typeMap.takeaway]
    })
  } catch (err) {
    console.log('[mreport/payment] ' + err.message)
    res.status(400).json({ msg: '獲取付款分佈失敗' })
  }
})

// GET /api/mreport/departments → 今日部門收入（檔口分佈）
router.get('/departments', guard, async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD')
    const list = await settledOrders(today)
    const departments = await computeDeptRevenue(list)
    res.json({ departments })
  } catch (err) {
    console.log('[mreport/departments] ' + err.message)
    res.status(400).json({ msg: '獲取部門收入失敗' })
  }
})

// GET /api/mreport/cancellations → 今日取消/退單分析
router.get('/cancellations', guard, async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD')
    const list = await ordersOnDay(today)
    let voidChecks = 0; let voidCheckAmount = 0
    let voidItems = 0; let voidItemAmount = 0
    let refunds = 0; let refundAmount = 0
    let paymentCancels = 0; let paymentCancelAmount = 0
    list.forEach(o => {
      if (o.voidStatus === 1) {
        voidChecks += 1
        voidCheckAmount = money(voidCheckAmount + (o.totalPrice || 0))
      }
      ;(o.order || []).forEach(item => {
        if (item && item.voidStatus === 1) {
          voidItems += 1
          const n = Number(item.voidQty || item.count || item.qty || 1)
          const p = Number(item.price || item.amount || 0)
          voidItemAmount = money(voidItemAmount + p * n)
        }
      })
      if (o.refundDate) {
        refunds += 1
        refundAmount = money(refundAmount + (o.totalPrice || 0))
      }
      if (o.paymentCancelAt) {
        paymentCancels += 1
        paymentCancelAmount = money(paymentCancelAmount + (o.totalPrice || 0))
      }
    })
    res.json({
      items: [
        { name: '整單取消', count: voidChecks, amount: voidCheckAmount },
        { name: '項目取消', count: voidItems, amount: voidItemAmount },
        { name: '退售', count: refunds, amount: refundAmount },
        { name: '反結帳', count: paymentCancels, amount: paymentCancelAmount }
      ],
      total: money(voidCheckAmount + voidItemAmount + refundAmount + paymentCancelAmount)
    })
  } catch (err) {
    console.log('[mreport/cancellations] ' + err.message)
    res.status(400).json({ msg: '獲取取消分析失敗' })
  }
})

// GET /api/mreport/heatmap?days=28 → 星期 × 鐘點營業額熱力圖
router.get('/heatmap', guard, async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 28, 7), 90)
    const start = moment().subtract(days - 1, 'day').startOf('day').toDate()
    const end = moment().add(1, 'day').startOf('day').toDate()
    const orders = await Order.find({ date: { $gte: start, $lt: end }, state: 1 }).exec()
    const grid = {}
    let max = 0
    orders.forEach(o => {
      const d = moment(o.date)
      const weekday = (d.day() + 6) % 7
      const hour = d.hour()
      const key = weekday + '-' + hour
      if (!grid[key]) grid[key] = { weekday, hour, revenue: 0, count: 0 }
      grid[key].revenue = money(grid[key].revenue + (o.totalPrice || 0))
      grid[key].count += 1
      if (grid[key].revenue > max) max = grid[key].revenue
    })
    res.json({
      weekdays: ['一', '二', '三', '四', '五', '六', '日'],
      hours: Array.from({ length: 24 }, (_, i) => i),
      data: Object.values(grid).map(g => [g.weekday, g.hour, g.revenue]),
      max: Math.ceil(max) || 1
    })
  } catch (err) {
    console.log('[mreport/heatmap] ' + err.message)
    res.status(400).json({ msg: '獲取熱力圖失敗' })
  }
})

// GET /api/mreport/turnover → 今日翻檯率 / 用枱率
router.get('/turnover', guard, async (req, res) => {
  try {
    const today = moment().format('YYYY-MM-DD')
    const [tables, orders] = await Promise.all([
      Table.find({}).exec(),
      settledOrders(today)
    ])
    const enabled = tables.filter(t => t.enabled !== false)
    const tableCount = enabled.length
    const dineIn = orders.filter(o => o.tableType !== 2 && o.subtype !== 2)
    const usedTables = new Set(dineIn.map(o => String(o.deskNo)).filter(n => n && n !== '0'))
    res.json({
      tableCount,
      dineInOrders: dineIn.length,
      usedTables: usedTables.size,
      pax: dineIn.reduce((s, o) => s + (Number(o.pax) || 0), 0),
      turnover: tableCount ? money(dineIn.length / tableCount) : 0,
      occupancyRate: tableCount ? Math.round(usedTables.size / tableCount * 1000) / 10 : 0
    })
  } catch (err) {
    console.log('[mreport/turnover] ' + err.message)
    res.status(400).json({ msg: '獲取翻檯率失敗' })
  }
})

module.exports = router
