//db.orders.find({$and:[{date:{$gte:new Date('2020-03-15 0:0:0')}},{date:{$lte:new Date('2020-03-15 23:59:59')}},{state:1}]})
const express = require('express')
const router = express.Router()
const passport = require('passport')
const Order = require('../../models/Order')
const Category = require('../../models/Category')
const Commodity = require('../../models/Commodity')
const ChartsData = require('../../models/ChartsData')
const PosSetting = require('../../models/PosSetting')
const AuditLog = require('../../models/AuditLog')
const Shop = require('../../models/Shop')
const BusinessDay = require('../../models/BusinessDay')
const Department = require('../../models/Department')
const moment = require('moment')

// 部門收入匯總：套餐依 departmentSplit 分帳；一般品項依 department → 商品 → 分類 → 未分類
async function computeDeptRevenue (orders) {
  const [commodities, categories] = await Promise.all([
    Commodity.find().select('_id department').lean().exec(),
    Category.find().select('_id cName department').lean().exec()
  ])
  const comMap = {}
  commodities.forEach(c => { comMap[String(c._id)] = c })
  const catMap = {}
  categories.forEach(c => { catMap[String(c._id)] = c; catMap[c.cName] = c })
  const money = v => Math.round((Number(v) || 0) * 100) / 100
  const itemSubtotal = (item) => {
    const base = item.free ? 0 : (item.customPrice > 0 ? item.customPrice : (item.price || 0))
    return Math.round(base * (item.discount || 1) * (item.count || 1) * 100) / 100
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
      if (!item) return
      const split = item.departmentSplit
      if (Array.isArray(split) && split.length) {
        split.forEach(s => {
          const dept = (s && s.department && String(s.department).trim()) ? String(s.department).trim() : '未分類'
          const amt = Number(s.amount) || 0
          if (!map[dept]) map[dept] = { department: dept, amount: 0, count: 0 }
          map[dept].amount = money(map[dept].amount + amt)
          map[dept].count += 1
        })
        return
      }
      const dept = resolveDept(item)
      if (!map[dept]) map[dept] = { department: dept, amount: 0, count: 0 }
      map[dept].amount = money(map[dept].amount + itemSubtotal(item))
      map[dept].count += 1
    })
  })
  return Object.keys(map).map(k => map[k]).sort((a, b) => b.amount - a.amount)
}

// $route POST api/statistic/data
// @desc 获取统计信息，返回json数据
// @access private
router.post(
  '/data',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const date = moment(req.body.date).format('YYYY-MM-DD')
      const orders = await Order.find({
        $and: [
          {
            date: {
              $gte: new Date(date + ' 00:00:00'),
              $lte: new Date(date + ' 23:59:59')
            }
          },
          { state: 1 }
        ]
      }).exec()
      const commodityCounts = await Commodity.countDocuments().exec()
      const categoryCounts = await Category.countDocuments().exec()
      const orderCounts = orders.length
      let totalIncome = 0
      orders.forEach(item => {
        totalIncome += item.totalPrice
      })
      totalIncome = Math.round(totalIncome * 100) / 100
      const chartsData = await ChartsData.find().exec()
      let xData = []
      let yOrder = []
      let yIncome = []
      if (chartsData) {
        chartsData.forEach(item => {
          xData.push(item.date)
          yOrder.push(item.order)
          yIncome.push(Math.round(item.income * 100) / 100)
        })
      }
      res.json({
        cardData: { orderCounts, totalIncome, commodityCounts, categoryCounts },
        chartsData: { xData, yOrder, yIncome }
      })
    } catch (err) {
      console.log(err)
    }
  }
)
// $route GET api/statistic/pos
// @desc POS 前台今日營業摘要（公開）
// @access public
router.get('/pos', async (req, res) => {
  try {
    const start = moment().startOf('day').toDate()
    const finished = await Order.find({ state: 1, date: { $gte: start } }).exec()
    const unfinished = await Order.find({ state: 0 }).exec()
    const totalIncome = Math.round(finished.reduce((s, o) => s + (o.totalPrice || 0), 0) * 100) / 100
    res.json({
      orderCounts: finished.length,
      totalIncome,
      unfinishedCount: unfinished.length
    })
  } catch (err) {
    console.log(err)
    res.status(400).send('獲取報表失敗！')
  }
})

// $route POST api/statistic/posReport
// @desc 收銀員報表 / 營業報表（支持日期範圍、全部/個人、分市時段）
// @access public
router.post('/posReport', async (req, res) => {
  try {
    const { type, scope, period, date, date_from, date_to, waiter, slot } = req.body
    const from = date_from || (period === 'today' ? moment().format('YYYY-MM-DD') : date)
    const to = date_to || from
    if (!from || !to || !moment(from, 'YYYY-MM-DD', true).isValid() || !moment(to, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).send('請提供有效日期範圍')
    }
    const start = moment(from, 'YYYY-MM-DD').startOf('day').toDate()
    const end = moment(to, 'YYYY-MM-DD').add(1, 'day').startOf('day').toDate()
    if (start >= end) return res.status(400).send('開始日期不能晚於結束日期')

    // 員工操作日誌：以表格列示，不走下方聚合邏輯
    if (type === 'staffLog') {
      const logFilter = { date: { $gte: start, $lt: end } }
      if (scope === 'personal' && waiter) logFilter.staffName = waiter
      const logs = await AuditLog.find(logFilter).sort({ date: 1 }).lean().exec()
      const columns = [
        { prop: 'time', label: '時間', width: 160 },
        { prop: 'staff', label: '員工', width: 140 },
        { prop: 'actionLabel', label: '操作', width: 120 },
        { prop: 'deskNo', label: '枱號', width: 110 },
        { prop: 'orderNo', label: '單號', width: 150 },
        { prop: 'amount', label: '金額', width: 100, align: 'right' },
        { prop: 'detail', label: '內容', minWidth: 180 }
      ]
      const data = logs.map(l => ({
        time: moment(l.date).format('YYYY-MM-DD HH:mm:ss'),
        staff: l.staffName + (l.staffNo ? '（' + l.staffNo + '）' : ''),
        actionLabel: l.actionLabel || l.action,
        deskNo: l.deskNo || '',
        orderNo: l.orderNo || '',
        amount: l.amount ? '$' + (Math.round(Number(l.amount) * 100) / 100).toFixed(2) : '',
        detail: l.detail || ''
      }))
      const title = '員工操作日誌'
      const subtitle = (scope === 'personal' ? `個人：${waiter}` : '全部') + '　｜　' + (from === to ? from : `${from} 至 ${to}`)
      res.json({ title, subtitle, columns, data, printTime: moment().format('YYYY-MM-DD HH:mm:ss') })
      return
    }

    const filter = { date: { $gte: start, $lt: end } }
    // 取消報表的「個人」範圍依操作者（voidBy/unsettledBy）過濾，非 waiter，故不在查詢層過濾
    if (scope === 'personal' && waiter && type !== 'cancel') filter.waiter = waiter
    const allOrders = await Order.find(filter).sort({ date: 1 }).lean().exec()
    // 分市時間同步：讀後台時段主檔，每張單標記所屬時段
    const globalSlots = []
    try {
      const setting = await PosSetting.findOne().lean().exec()
      if (setting && Array.isArray(setting.slots)) globalSlots.push(...setting.slots.filter(s => s && s.name && s.start && s.end))
    } catch (e) {
      console.log('[Report] 讀取分市時間失敗：' + e.message)
    }
    const slotOf = (d) => {
      const hm = moment(d).format('HH:mm')
      const toMinutes = value => {
        const parts = String(value).split(':').map(Number)
        return (parts[0] || 0) * 60 + (parts[1] || 0)
      }
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
    allOrders.forEach(o => { o._slot = slotOf(o.date) })
    const scopedAll = (slot && slot !== 'all') ? allOrders.filter(o => o._slot === slot) : allOrders
    const orders = scopedAll.filter(order => order.state === 1 && order.voidStatus !== 1)
    const voidOrders = scopedAll.filter(order => order.voidStatus === 1)
    const outstanding = scopedAll.filter(order => order.state === 0 && order.voidStatus !== 1)
    const toCents = value => Math.round((Number(value) || 0) * 100)
    const money = value => toCents(value) / 100
    const sum = (items, getter) => items.reduce((total, item) => total + toCents(getter(item)), 0) / 100
    const titleMap = {
      cashier: '收銀員報表', business: '營業報表', department: '分區營業報表', departmentRevenue: '部門收入報表', payment: '付款報表',
      cancel: '取消報表',
      printRecord: '印單紀錄報表', mergeTable: '合併枱報表', itemTransfer: '項目轉移報表',
      orderDetail: '單據明細詳列', staffHours: '員工工時報表', discount: '全日折扣報表', monthly: '每月營業報表'
    }
    const title = titleMap[type] || '營業報表'
    const subtitle = (scope === 'personal' ? `個人：${waiter}` : '全部') + '　｜　' + (from === to ? from : `${from} 至 ${to}`)
    const groups = (items, key) => {
      const result = {}
      items.forEach(item => {
        const name = key(item) || '未指定'
        if (!result[name]) result[name] = { name, count: 0, amount: 0 }
        result[name].count += 1
        result[name].amount += Number(item.totalPrice) || 0
      })
      return Object.values(result).sort((a, b) => a.name.localeCompare(b.name))
    }
    const payments = groups(orders, order => order.payMethod)
    const activeAmount = sum(orders, order => order.totalPrice)
    const discount = sum(orders, order => order.discount)
    const serviceCharge = sum(orders, order => order.serviceCharge)
    const tax = sum(orders, order => order.tax)
    const rounding = sum(orders, order => order.rounding)
    const dineIn = orders.filter(order => order.tableType !== 2 && order.subtype !== 2)
    const takeaway = orders.filter(order => order.tableType === 2 || order.subtype === 2)
    const totalPax = sum(orders, order => order.pax)
    const avgCheck = orders.length ? money(activeAmount / orders.length) : 0
    const avgCover = totalPax ? money(activeAmount / totalPax) : 0
    const voidCheckAmount = sum(voidOrders, order => order.totalPrice)
    const refundOrders = orders.filter(o => o.refundDate)
    const refundAmount = sum(refundOrders, order => order.totalPrice)
    const cashOrders = orders.filter(o => String(o.payMethod).toLowerCase().indexOf('現金') >= 0 || String(o.payMethod).toLowerCase().indexOf('cash') >= 0)
    const cardOrders = orders.filter(o => String(o.payMethod).toLowerCase().indexOf('信用卡') >= 0 || String(o.payMethod).toLowerCase().indexOf('credit') >= 0 || String(o.payMethod).toLowerCase().indexOf('卡') >= 0)
    const cashAmount = sum(cashOrders, o => o.totalPrice)
    const cardAmount = sum(cardOrders, o => o.totalPrice)
    const grossAmount = sum(orders, o => o.subtotalAmount || o.totalPrice)
    const deptRevenue = await computeDeptRevenue(orders)
    const itemVoidTotal = (ords) => {
      let count = 0, amount = 0
      ords.forEach(o => (o.order || []).forEach(item => {
        if (item.voidStatus === 1) {
          count += 1
          amount += (Number(item.price || item.amount) || 0) * (Number(item.count || item.qty || 1))
        }
      }))
      return { count, amount: money(amount) }
    }
    const itemVoid = itemVoidTotal(allOrders)
    const groupBy = (items, key) => {
      const r = {}
      items.forEach(item => {
        const k = key(item) || '未指定'
        if (!r[k]) r[k] = []
        r[k].push(item)
      })
      return r
    }
    const fmtItem = (item) => {
      const n = Number(item.count || item.qty || 1)
      const p = Number(item.price || item.amount || 0)
      return { label: item.name + (n > 1 ? ' x' + n : ''), count: n, amount: money(p * n) }
    }
    const fmtOrderItem = (order) => {
      return (order.order || []).filter(it => it.voidStatus !== 1).map(it => fmtItem(it))
    }
    const cashierGroups = groups(orders, order => order.waiter || order.cashier || '未指定')
    // 結帳員工 × 付款方式：依結帳員工分組，再依付款方式細分收款金額
    const payCategory = (order) => {
      const p = String(order.payMethod || '未指定').toLowerCase()
      if (p.indexOf('現金') >= 0 || p.indexOf('cash') >= 0) return '現金'
      if (p.indexOf('信用卡') >= 0 || p.indexOf('credit') >= 0 || p.indexOf('卡') >= 0) return '信用卡'
      return order.payMethod || '未指定'
    }
    const cashierPaymentMap = {}
    orders.forEach(order => {
      const cashier = order.cashier || order.waiter || '未指定'
      const pm = payCategory(order)
      if (!cashierPaymentMap[cashier]) cashierPaymentMap[cashier] = { count: 0, amount: 0, methods: {} }
      cashierPaymentMap[cashier].count += 1
      cashierPaymentMap[cashier].amount += Number(order.totalPrice) || 0
      if (!cashierPaymentMap[cashier].methods[pm]) cashierPaymentMap[cashier].methods[pm] = { count: 0, amount: 0 }
      cashierPaymentMap[cashier].methods[pm].count += 1
      cashierPaymentMap[cashier].methods[pm].amount += Number(order.totalPrice) || 0
    })
    const cashierPaymentRows = []
    Object.keys(cashierPaymentMap).sort((a, b) => a.localeCompare(b)).forEach(cashier => {
      const entry = cashierPaymentMap[cashier]
      cashierPaymentRows.push({ label: cashier, count: entry.count, amount: money(entry.amount), bold: true })
      Object.keys(entry.methods).sort((a, b) => a.localeCompare(b)).forEach(pm => {
        const m = entry.methods[pm]
        cashierPaymentRows.push({ label: `　${pm}`, count: m.count, amount: money(m.amount) })
      })
    })
    const slotGroups = groups(orders, order => order._slot || '非時段')
    const slotSection = { title: '時段營業', rows: slotGroups.map(row => ({ label: row.name, count: row.count, amount: money(row.amount) })) }
    if (type === 'dailyClose') {
      const shop = await Shop.findOne().lean().exec()
      const shopCode = (shop && shop.shopCode) || '001'
      const shopName = (shop && shop.shopName) || ''
      const bizDate = from
      let businessDay = await BusinessDay.findOne({ date: bizDate }).lean().exec()
      // Close ID（日結序號）：優先取日結寫入的 closeSeq；未日結則預估為「已日結天數 + 1」
      let closeSeq = businessDay && businessDay.closeSeq
      if (!closeSeq) {
        closeSeq = (await BusinessDay.countDocuments({ closeSeq: { $gt: 0 } }).exec()) + 1
      }
      // 商品非營業標記
      const coms = await Commodity.find().select('_id nonBusiness price').lean().exec()
      const comMap = {}
      coms.forEach(c => { comMap[String(c._id)] = c })
      // 撞餐跟餐品項改收跟餐價：營業金額改採原價，撞餐折扣 = 原價 - 跟餐價（併入「折扣」顯示）
      const origPriceOf = (item) => {
        if (item.bundlePrice) {
          if (Number(item.bundleOrigPrice) > 0) return Number(item.bundleOrigPrice)
          const com = (item.commodityId || item._id) ? comMap[String(item.commodityId || item._id)] : null
          if (com && Number(com.price) > 0) return Number(com.price)
        }
        return item.free ? 0 : (item.customPrice > 0 ? item.customPrice : (item.price || 0))
      }
      const actualPriceOf = (item) => item.free ? 0 : (item.customPrice > 0 ? item.customPrice : (item.price || 0))
      let grossItemAmount = 0
      let nonBusinessAmount = 0
      let bundleDiscount = 0
      orders.forEach(o => (o.order || []).forEach(item => {
        if (!item || item.voidStatus === 1) return
        const count = item.count || 1
        const disc = item.discount || 1
        const actual = Math.round(actualPriceOf(item) * disc * count * 100) / 100
        const orig = Math.round(origPriceOf(item) * disc * count * 100) / 100
        grossItemAmount = money(grossItemAmount + orig)
        bundleDiscount = money(bundleDiscount + Math.max(0, orig - actual))
        const com = (item.commodityId || item._id) ? comMap[String(item.commodityId || item._id)] : null
        if (com && com.nonBusiness) nonBusinessAmount = money(nonBusinessAmount + actual)
      }))
      const salesSubtotal = money(grossItemAmount - discount - bundleDiscount + serviceCharge + rounding + tax)
      const netAmount = money(salesSubtotal - nonBusinessAmount)
      const tipTotal = money(sum(orders, o => o.tip))
      const startingCash = businessDay ? money(businessDay.startingCash) : 0
      const countedCash = businessDay ? money(businessDay.countedCash) : 0
      const paidOutTotal = businessDay ? money((businessDay.paidOuts || []).reduce((s, r) => s + (r.amount || 0), 0)) : 0
      const receivedTotal = businessDay ? money((businessDay.receiveds || []).reduce((s, r) => s + (r.amount || 0), 0)) : 0
      const cashReceived = money(cashAmount)
      const expectedCash = money(startingCash + cashReceived + receivedTotal - paidOutTotal)
      const dineInCount = dineIn.length
      const dineInPax = sum(dineIn, o => o.pax)
      const dineInAmount = sum(dineIn, o => o.totalPrice)
      const takeawayCount = takeaway.length
      const takeawayAmount = sum(takeaway, o => o.totalPrice)
      const avgDineIn = dineInCount ? money(dineInAmount / dineInCount) : 0
      const avgDineInCover = dineInPax ? money(dineInAmount / dineInPax) : 0
      const dailyCloseSections = [
        { title: '帳項', rows: [
          { label: '營業金額', amount: grossItemAmount, bold: true },
          { label: '折扣', amount: -(discount + bundleDiscount) },
          { label: '服務費', amount: serviceCharge },
          { label: '小數約數', amount: rounding },
          { label: '稅項', amount: tax },
          { label: '營業額', amount: salesSubtotal, bold: true },
          { label: '非營業項目金額', amount: -nonBusinessAmount },
          { label: '營業金額淨值', amount: netAmount, bold: true }
        ] },
        { title: '未結帳單', rows: [{ label: '未結訂單', count: outstanding.length, amount: sum(outstanding, order => order.totalPrice) }] },
        { title: '付款方式', rows: payments.map(row => ({ label: row.name, count: row.count, amount: money(row.amount) })) },
        { title: '現金結算', rows: [
          { label: '開機金額', amount: startingCash },
          { label: '代收', amount: receivedTotal },
          { label: '收款', amount: cashReceived },
          { label: '小費', amount: tipTotal },
          { label: '代支', amount: -paidOutTotal },
          { label: '銀櫃實點', amount: countedCash },
          { label: '銀櫃結餘（預計）', amount: expectedCash, bold: true }
        ] },
        { title: '折扣', rows: [{ label: '折扣', amount: -(discount + bundleDiscount) }] },
        { title: '取消明細', rows: [
          { label: '取消單據', count: voidOrders.length, amount: voidCheckAmount },
          { label: '取消項目', count: itemVoid.count, amount: itemVoid.amount },
          { label: '退售', count: refundOrders.length, amount: refundAmount }
        ] },
        { title: '銷售模式', rows: [
          { label: 'Dine-In 金額', count: dineInCount, amount: dineInAmount },
          { label: '平均每帳單', amount: avgDineIn },
          { label: 'Dine-In 人數', count: dineInPax },
          { label: '人均消費', amount: avgDineInCover },
          { label: '外賣 金額', count: takeawayCount, amount: takeawayAmount },
          { label: '總金額', amount: activeAmount, bold: true },
          { label: '總人數', count: totalPax }
        ] },
        { title: '營業帳項', rows: deptRevenue.map(d => ({ label: d.department, count: d.count, amount: money(d.amount) })) },
        { title: '非營業帳項', rows: [{ label: '非營業項目金額', amount: nonBusinessAmount }] }
      ]
      return res.json({ title: '日結清機報表', subtitle: `分店：${shopCode} ${shopName}　｜　日期：${bizDate}　｜　Close ID：${closeSeq}`.trim(), sections: dailyCloseSections, slots: globalSlots.map(s => ({ name: s.name, start: s.start, end: s.end })), slot: slot || 'all', printTime: moment().format('YYYY-MM-DD HH:mm:ss') })
    }
    if (type === 'monthly') {
      // 每月營業報表：依日分組的營業紀錄表（原營業額 / 單據 / 每單 / 人數 / 每人）
      const shop = await Shop.findOne().lean().exec()
      const shopCode = (shop && shop.shopCode) || '001'
      const coms = await Commodity.find().select('_id price').lean().exec()
      const comMap = {}
      coms.forEach(c => { comMap[String(c._id)] = c })
      const origPriceOf = (item) => {
        if (item.bundlePrice) {
          if (Number(item.bundleOrigPrice) > 0) return Number(item.bundleOrigPrice)
          const com = (item.commodityId || item._id) ? comMap[String(item.commodityId || item._id)] : null
          if (com && Number(com.price) > 0) return Number(com.price)
        }
        return item.free ? 0 : (Number(item.customPrice) > 0 ? Number(item.customPrice) : (Number(item.price) || 0))
      }
      const grossOf = (o) => {
        let g = 0
        ;(o.order || []).forEach(item => {
          if (!item || item.voidStatus === 1) return
          const count = Number(item.count || item.qty || 1)
          const disc = Number(item.discount) || 1
          g += origPriceOf(item) * disc * count
        })
        return money(g)
      }
      const dayMap = {}
      orders.forEach(o => {
        const key = moment(o.date).format('YYYY-MM-DD')
        if (!dayMap[key]) dayMap[key] = { date: key, gross: 0, checks: 0, pax: 0 }
        dayMap[key].gross = money(dayMap[key].gross + grossOf(o))
        dayMap[key].checks += 1
        dayMap[key].pax += Number(o.pax) || 0
      })
      const fmt1 = v => (v == null || v === '' || isNaN(Number(v))) ? '' : Number(v).toFixed(1)
      const fmtInt = v => (v == null || v === '' || isNaN(Number(v))) ? '' : String(Math.round(Number(v)))
      const dayKeys = Object.keys(dayMap).sort()
      const data = dayKeys.map(k => {
        const d = dayMap[k]
        return {
          date: moment(k, 'YYYY-MM-DD').format('MM/DD/YY'),
          shopCode,
          day: moment(k, 'YYYY-MM-DD').format('ddd'),
          gross: fmt1(d.gross),
          checks: fmtInt(d.checks),
          avgCheck: d.checks ? fmt1(d.gross / d.checks) : '',
          pax: fmtInt(d.pax),
          avgPax: d.pax ? fmt1(d.gross / d.pax) : ''
        }
      })
      const days = dayKeys.length
      const totalGross = money(dayKeys.reduce((s, k) => s + dayMap[k].gross, 0))
      const totalChecks = dayKeys.reduce((s, k) => s + dayMap[k].checks, 0)
      const totalPax = dayKeys.reduce((s, k) => s + dayMap[k].pax, 0)
      const totalRow = {
        date: '** 總數 **', shopCode: '', day: '',
        gross: fmt1(totalGross), checks: fmtInt(totalChecks),
        avgCheck: 'N.A.', pax: fmtInt(totalPax), avgPax: 'N.A.',
        _summary: true
      }
      const averageRow = {
        date: '**平均每日**', shopCode: '', day: '',
        gross: days ? fmt1(totalGross / days) : '',
        checks: days ? fmt1(totalChecks / days) : '',
        avgCheck: totalChecks ? fmt1(totalGross / totalChecks) : '',
        pax: days ? fmt1(totalPax / days) : '',
        avgPax: totalPax ? fmt1(totalGross / totalPax) : '',
        _summary: true
      }
      const columns = [
        { prop: 'date', label: '日期', width: 90 },
        { prop: 'shopCode', label: '營業區', width: 70 },
        { prop: 'day', label: '日', width: 60 },
        { prop: 'gross', label: '營業額', width: 110, align: 'right' },
        { prop: 'checks', label: '# 單據', width: 80, align: 'right' },
        { prop: 'avgCheck', label: '每單', width: 90, align: 'right' },
        { prop: 'pax', label: '# 人數', width: 80, align: 'right' },
        { prop: 'avgPax', label: '每人', width: 90, align: 'right' }
      ]
      return res.json({ title: '每月營業報表', subtitle: `(${moment(from, 'YYYY-MM-DD').format('MM/DD/YY')} - ${moment(to, 'YYYY-MM-DD').format('MM/DD/YY')})`, columns, data: data.concat([totalRow, averageRow]), printTime: moment().format('YYYY-MM-DD HH:mm:ss') })
    }
    if (type === 'sales') {
      // 銷貨報表：依部門分組的品項銷售明細（可篩選部門/分類/貨品編號範圍，簡略/詳細，含分市時段拆帳）
      const department = String(req.body.department || '').trim()
      const category = String(req.body.category || '').trim()
      const pluFrom = String(req.body.plu_from || '').trim()
      const pluTo = String(req.body.plu_to || '').trim()
      const detail = req.body.detail === 'detail' || req.body.detail === true
      const shop = await Shop.findOne().lean().exec()
      const shopName = (shop && shop.shopName) || ''

      const [commodities, categoryDocs, deptDocs] = await Promise.all([
        Commodity.find().select('_id plu department price categoryId categoryName nonBusiness').lean().exec(),
        Category.find().select('_id cName department').lean().exec(),
        Department.find().select('name code').lean().exec()
      ])
      const comMap = {}
      commodities.forEach(c => { comMap[String(c._id)] = c })
      const catMap = {}
      categoryDocs.forEach(c => { catMap[String(c._id)] = c; catMap[c.cName] = c })
      const deptCodeMap = {}
      deptDocs.forEach(d => { if (d.name) deptCodeMap[d.name] = d.code || '' })
      const deptLabel = (name) => {
        const n = name || '未分類'
        const code = deptCodeMap[n] || ''
        if (code && String(n).indexOf(code) !== 0) return code + n
        return n
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
      const resolveCategory = (item) => {
        if (item.categoryName) return String(item.categoryName)
        if (item.category) return String(item.category)
        const cid = item.commodityId || item._id
        const com = cid ? comMap[String(cid)] : null
        if (com && com.categoryName) return String(com.categoryName)
        const cat = item.categoryId ? catMap[String(item.categoryId)] : null
        if (cat) return cat.cName
        return '未分類'
      }
      const resolvePlu = (item) => {
        if (item.plu) return String(item.plu)
        const cid = item.commodityId || item._id
        const com = cid ? comMap[String(cid)] : null
        return (com && com.plu) ? String(com.plu) : ''
      }

      // 逐項聚合（只含已結訂單、未取消品項）
      const agg = []
      let salesTotal = 0
      let nonBusinessTotal = 0
      orders.forEach(o => {
        ;(o.order || []).forEach(item => {
          if (!item || item.voidStatus === 1) return
          const dept = resolveDept(item)
          if (department && department !== 'all' && dept !== department) return
          const cat = resolveCategory(item)
          if (category && category !== 'all' && cat !== category) return
          const plu = resolvePlu(item)
          if (pluFrom && plu < pluFrom) return
          if (pluTo && plu > pluTo) return
          const count = Number(item.count || item.qty || 1)
          const price = item.free ? 0 : (Number(item.customPrice) > 0 ? Number(item.customPrice) : (Number(item.price) || 0))
          const amount = money(price * count * (Number(item.discount) || 1))
          const com = (item.commodityId || item._id) ? comMap[String(item.commodityId || item._id)] : null
          const isNonBusiness = !!(com && com.nonBusiness)
          agg.push({ dept, plu, name: item.name || '未命名', qty: count, price, amount, slot: o._slot || '非時段', nonBusiness: isNonBusiness })
          salesTotal = money(salesTotal + amount)
          if (isNonBusiness) nonBusinessTotal = money(nonBusinessTotal + amount)
        })
      })

      const deptMap = {}
      agg.forEach(r => {
        if (!deptMap[r.dept]) deptMap[r.dept] = { dept: r.dept, items: [], qty: 0, amount: 0, slots: {} }
        const d = deptMap[r.dept]
        d.qty += r.qty
        d.amount = money(d.amount + r.amount)
        d.slots[r.slot] = money((d.slots[r.slot] || 0) + r.amount)
        const key = r.plu + '|' + r.name
        const found = d.items.find(x => x.key === key)
        if (found) {
          found.qty += r.qty
          found.amount = money(found.amount + r.amount)
        } else {
          d.items.push({ key, plu: r.plu, name: r.name, qty: r.qty, price: r.price, amount: r.amount })
        }
      })
      const pctOf = v => (salesTotal ? money(v) / salesTotal * 100 : 0).toFixed(1) + '%'
      const slotRowsOf = (slotMap) => {
        const names = globalSlots.map(s => s.name).filter(n => slotMap[n] != null)
        Object.keys(slotMap).filter(n => !globalSlots.some(s => s.name === n)).sort().forEach(n => names.push(n))
        return names.map(sn => ({ label: `　${sn}`, amount: slotMap[sn] }))
      }

      const sections = []
      const deptNames = Object.keys(deptMap).sort((a, b) => a.localeCompare(b))
      if (detail) {
        deptNames.forEach(name => {
          const d = deptMap[name]
          const rows = []
          d.items.sort((a, b) => (a.plu || '').localeCompare(b.plu || '') || a.name.localeCompare(b.name)).forEach(it => {
            rows.push({ label: `${it.plu || ''}　${it.name}`, count: it.qty, amount: it.amount, extra: `單價 ${Number(it.price).toFixed(1)}　${pctOf(it.amount)}` })
          })
          rows.push({ label: '** 段落總和 **', count: d.qty, amount: d.amount, extra: pctOf(d.amount), bold: true })
          slotRowsOf(d.slots).forEach(r => rows.push(r))
          sections.push({ title: `部門 - ${deptLabel(name)}`, rows, hasExtra: true })
        })
      } else {
        const briefRows = deptNames.map(name => {
          const d = deptMap[name]
          return { label: deptLabel(name), count: d.qty, amount: d.amount, extra: pctOf(d.amount) }
        })
        sections.push({ title: '銷貨摘要', rows: briefRows, hasExtra: briefRows.length > 0 })
      }

      // 總結（footer）
      const scTotal = sum(orders, o => o.serviceCharge)
      const taxTotal = sum(orders, o => o.tax)
      const discTotal = sum(orders, o => o.discount)
      const roundTotal = sum(orders, o => o.rounding)
      const paxTotal = sum(orders, o => o.pax)
      const checkCount = orders.length
      const netTotal = money(salesTotal - discTotal + scTotal + taxTotal + roundTotal)
      const grandSlots = {}
      agg.forEach(r => { grandSlots[r.slot] = money((grandSlots[r.slot] || 0) + r.amount) })
      const footerRows = [{ label: '** 營業區總數 **', count: agg.reduce((s, r) => s + r.qty, 0), amount: salesTotal, bold: true }]
      slotRowsOf(grandSlots).forEach(r => footerRows.push(r))
      footerRows.push({ label: '銷售總和', amount: salesTotal })
      footerRows.push({ label: '非營業總數', amount: -nonBusinessTotal })
      footerRows.push({ label: '服務費', amount: scTotal })
      footerRows.push({ label: '稅項總和', amount: taxTotal })
      footerRows.push({ label: '折扣總和', amount: -discTotal })
      footerRows.push({ label: '總額', amount: netTotal, bold: true })
      footerRows.push({ label: '#單據', count: checkCount })
      footerRows.push({ label: '平均/單據', amount: checkCount ? money(netTotal / checkCount) : 0 })
      footerRows.push({ label: '人數', count: paxTotal })
      footerRows.push({ label: '每人平均', amount: paxTotal ? money(netTotal / paxTotal) : 0 })
      sections.push({ title: '總結', rows: footerRows })

      const dateRangeLabel = from === to ? from : `${from} 至 ${to}`
      return res.json({ title: '銷貨報表', subtitle: `${shopName}　｜　${detail ? '詳細' : '簡略'}　｜　${dateRangeLabel}`.trim(), sections, slots: globalSlots.map(s => ({ name: s.name, start: s.start, end: s.end })), slot: slot || 'all', printTime: moment().format('YYYY-MM-DD HH:mm:ss') })
    }
    if (type === 'slotReport') {
      // 分市報表：入單計（依入單時間，含已結+未結）／埋單計（依埋單時間，只含已結）
      const mode = req.body.mode === 'settlement' ? 'settlement' : 'entry'
      const modeLabel = mode === 'settlement' ? '埋單計' : '入單計'
      const shop = await Shop.findOne().lean().exec()
      const shopName = (shop && shop.shopName) || ''
      const slotLabel = name => {
        const s = globalSlots.find(x => x.name === name)
        return s ? `${name}（${s.start} - ${s.end}）` : name
      }
      const targetOrders = mode === 'settlement'
        ? allOrders.filter(o => o.state === 1 && o.voidStatus !== 1)
        : allOrders.filter(o => o.voidStatus !== 1 && o.order && o.order.length)
      const acc = {}
      const ensure = name => { if (!acc[name]) acc[name] = { paid: 0, unpaid: 0, count: 0, pax: 0 }; return acc[name] }
      targetOrders.forEach(o => {
        const t = mode === 'settlement' ? (o.settledAt || o.date) : o.date
        const name = slotOf(t)
        if (slot && slot !== 'all' && name !== slot) return
        const e = ensure(name)
        const amt = Number(o.totalPrice) || 0
        if (o.state === 1) e.paid += amt
        else e.unpaid += amt
        e.count += 1
        e.pax += Number(o.pax) || 0
      })
      const orderedNames = []
      if (slot && slot !== 'all') {
        // 選定單一時段：只顯示該時段（即使無單也顯示）
        orderedNames.push(slot)
      } else {
        // 全部時段：依後台順序顯示所有時段（即使無單也顯示），再補「非時段」
        globalSlots.forEach(s => orderedNames.push(s.name))
        Object.keys(acc).filter(n => !globalSlots.some(s => s.name === n)).sort().forEach(n => orderedNames.push(n))
      }
      const empty = { paid: 0, unpaid: 0, count: 0, pax: 0 }
      const buildRows = e => {
        e = e || empty
        const total = money(e.paid + e.unpaid)
        const rows = [{ label: '已付', amount: money(e.paid) }]
        if (e.unpaid > 0) rows.push({ label: '未付', amount: money(e.unpaid) })
        rows.push({ label: '總數', amount: total, bold: true })
        rows.push({ label: '#單據', count: e.count })
        rows.push({ label: '人數', count: e.pax })
        rows.push({ label: '平均每單據', amount: e.count ? money(total / e.count) : 0 })
        rows.push({ label: '平均每人', amount: e.pax ? money(total / e.pax) : 0 })
        return rows
      }
      const slotReportSections = orderedNames.map(name => ({ title: slotLabel(name), rows: buildRows(acc[name] || empty) }))
      const grand = { paid: 0, unpaid: 0, count: 0, pax: 0 }
      Object.values(acc).forEach(e => { grand.paid += e.paid; grand.unpaid += e.unpaid; grand.count += e.count; grand.pax += e.pax })
      slotReportSections.push({ title: '大總數', rows: buildRows(grand) })
      const dateRangeLabel = from === to ? from : `${from} 至 ${to}`
      return res.json({ title: '分市報表', subtitle: `${shopName}　｜　${modeLabel}　｜　${dateRangeLabel}`.trim(), sections: slotReportSections, slots: globalSlots.map(s => ({ name: s.name, start: s.start, end: s.end })), slot: slot || 'all', printTime: moment().format('YYYY-MM-DD HH:mm:ss') })
    }
    let sections = []
    if (type === 'cashier') {
      // 收銀報表（以收銀員）：個人＝單一收銀員段落；全部＝每位收銀員段落＋大總數
      const isCashPay = pm => {
        const p = String(pm || '').toLowerCase()
        return p.indexOf('現金') >= 0 || p.indexOf('cash') >= 0
      }
      const buildCashierBlock = async (ordList) => {
        const payMap = {}
        ordList.forEach(o => {
          const pm = String(o.payMethod || '未指定')
          if (!payMap[pm]) payMap[pm] = { name: pm, count: 0, amount: 0, tip: 0 }
          payMap[pm].count += 1
          payMap[pm].amount += Number(o.totalPrice) || 0
          payMap[pm].tip += Number(o.tip) || 0
        })
        const payList = Object.values(payMap).sort((a, b) => a.name.localeCompare(b.name))
        const cashRows = payList.filter(p => isCashPay(p.name)).map(p => ({ label: p.name, count: p.count, amount: money(p.amount), tip: money(p.tip) }))
        const cardRows = payList.filter(p => !isCashPay(p.name)).map(p => ({ label: p.name, count: p.count, amount: money(p.amount), tip: money(p.tip) }))
        const dept = await computeDeptRevenue(ordList)
        const deptTotal = money(dept.reduce((s, d) => s + d.amount, 0))
        const serviceCharge = money(ordList.reduce((s, o) => s + (Number(o.serviceCharge) || 0), 0))
        const tax = money(ordList.reduce((s, o) => s + (Number(o.tax) || 0), 0))
        const rounding = money(ordList.reduce((s, o) => s + (Number(o.rounding) || 0), 0))
        const discount = money(ordList.reduce((s, o) => s + (Number(o.discount) || 0), 0))
        const tip = money(ordList.reduce((s, o) => s + (Number(o.tip) || 0), 0))
        const net = money(deptTotal + serviceCharge + tax + rounding - discount)
        const count = ordList.length
        const pax = ordList.reduce((s, o) => s + (Number(o.pax) || 0), 0)
        return [
          { title: '非信用咭付款', rows: cashRows.length ? cashRows : [{ label: '現金', count: 0, amount: 0, tip: 0 }] },
          { title: '信用咭付款', rows: cardRows },
          { title: '部門總結', rows: dept.map(d => ({ label: d.department, amount: money(d.amount) })).concat([{ label: '總額', amount: deptTotal, bold: true }]) },
          { title: '總結', rows: [
            { label: '部門總數', amount: deptTotal, bold: true },
            { label: '服務費', amount: serviceCharge },
            { label: '稅', amount: tax },
            { label: '約數差額', amount: rounding },
            { label: '單據折扣', amount: -discount },
            { label: '單據總數', amount: net, bold: true },
            { label: '總共小賬', amount: tip },
            { label: '付款金額＋小賬', amount: money(net + tip), bold: true },
            { label: '單據數目', count },
            { label: '人數', count: pax },
            { label: '付款次數', count },
            { label: '付款金額／單據#', amount: count ? money(net / count) : 0 },
            { label: '付款金額／人數', amount: pax ? money(net / pax) : 0 }
          ] }
        ]
      }
      if (scope === 'personal') {
        sections = await buildCashierBlock(orders)
      } else {
        sections = []
        const byCashier = {}
        orders.forEach(o => {
          const key = o.cashier || o.waiter || '未指定'
          if (!byCashier[key]) byCashier[key] = []
          byCashier[key].push(o)
        })
        const cashierNames = Object.keys(byCashier).sort((a, b) => a.localeCompare(b))
        for (const name of cashierNames) {
          sections.push({ title: `收銀員：${name}`, rows: [] })
          sections = sections.concat(await buildCashierBlock(byCashier[name]))
        }
        // 大總數：依所有收銀員合計
        sections.push({ title: '大總數', rows: [] })
        sections = sections.concat(await buildCashierBlock(orders))
      }
    } else if (type === 'business') {
      sections = [
        { title: '營業帳項（Sales Summary）', rows: [
          { label: '營業總額（Gross Amount）', count: orders.length, amount: activeAmount, bold: true },
          { label: '折扣（Discount）', amount: -discount },
          { label: '服務費（Service Charge）', amount: serviceCharge },
          { label: '稅項（Tax）', amount: tax },
          { label: '抹零（Rounding）', amount: rounding },
          { label: '應收總額（Net Amount）', amount: money(activeAmount - discount + serviceCharge + tax + rounding), bold: true }
        ] },
        { title: '收款方式（Payment）', rows: [
          { label: '現金（CASH）', count: cashOrders.length, amount: money(cashAmount) },
          { label: '信用卡（Card）', count: cardOrders.length, amount: money(cardAmount) }
        ].concat(payments.filter(r => r.name !== '現金' && r.name !== '信用卡' && r.name !== 'cash' && r.name !== 'credit').map(row => ({ label: row.name, count: row.count, amount: money(row.amount) }))) },
        { title: '結帳員工收款明細（Cashier × Payment）', rows: cashierPaymentRows },
        { title: '取消統計（Void & Refund）', rows: [
          { label: '全單取消（Void Check）', count: voidOrders.length, amount: voidCheckAmount },
          { label: '項目取消（Void Item）', count: itemVoid.count, amount: itemVoid.amount },
          { label: '退售（Refund）', count: refundOrders.length, amount: refundAmount }
        ] },
        slotSection,
        { title: '帳單統計（Check Summary）', rows: [
          { label: '總帳單數（Checks）', count: orders.length },
          { label: '總人數（Cover）', count: totalPax },
          { label: '平均每單（Avg Check）', amount: avgCheck },
          { label: '平均每客（Avg Cover）', amount: avgCover }
        ] },
        { title: '營業帳項（部門）', rows: deptRevenue.map(d => ({ label: d.department, count: d.count, amount: money(d.amount) })) },
        { title: '未結單據', rows: [{ label: '未結訂單', count: outstanding.length, amount: sum(outstanding, order => order.totalPrice) }] }
      ]
    } else if (type === 'department') {
      const zoneGroups = groupBy(orders, order => order.zone || '未分區')
      sections = [
        { title: '營業帳項', rows: [
          { label: '營業總額（Gross Amount）', count: orders.length, amount: activeAmount, bold: true },
          { label: '折扣（Discount）', amount: -discount },
          { label: '服務費（Service Charge）', amount: serviceCharge },
          { label: '稅項（Tax）', amount: tax },
          { label: '抹零（Rounding）', amount: rounding },
          { label: '應收總額（Net Amount）', amount: money(activeAmount - discount + serviceCharge + tax + rounding), bold: true }
        ] },
        { title: '分區營業', rows: Object.keys(zoneGroups).sort().map(z => ({ label: z, count: zoneGroups[z].length, amount: sum(zoneGroups[z], order => order.totalPrice) })) }
      ]
    } else if (type === 'departmentRevenue') {
      const deptTotals = await computeDeptRevenue(orders)
      sections = [
        { title: '部門收入（營業額分拆）', rows: deptTotals.map(d => ({ label: d.department, count: d.count, amount: money(d.amount) })) },
        { title: '合計', rows: [{ label: '部門收入合計', count: deptTotals.reduce((s, d) => s + d.count, 0), amount: money(deptTotals.reduce((s, d) => s + d.amount, 0)), bold: true }] }
      ]
    } else if (type === 'payment') {
      const paymentDetails = []
      orders.forEach(o => {
        paymentDetails.push({
          label: o.orderNo,
          count: 1,
          amount: money(o.totalPrice),
          extra: `枱${o.deskNo || ''}｜${o.payMethod || '未指定'}｜${o.cashier || o.waiter || ''}`
        })
      })
      sections = [
        { title: '營業帳項', rows: [
          { label: '營業總額（Gross Amount）', count: orders.length, amount: activeAmount, bold: true },
          { label: '折扣（Discount）', amount: -discount },
          { label: '服務費（Service Charge）', amount: serviceCharge },
          { label: '稅項（Tax）', amount: tax },
          { label: '抹零（Rounding）', amount: rounding },
          { label: '應收總額（Net Amount）', amount: money(activeAmount - discount + serviceCharge + tax + rounding), bold: true }
        ] },
        { title: '收款方式（Payment）', rows: payments.map(row => ({ label: row.name, count: row.count, amount: money(row.amount) })) },
        { title: '付款明細（Payment Detail）', hasExtra: true, rows: paymentDetails }
      ]
    } else if (type === 'cancel') {
      const timeFmt = d => (d ? moment(d).format('HH:mm:ss') : '')
      const isPersonal = scope === 'personal' && waiter
      const managerMatch = name => !isPersonal || String(name || '') === waiter

      // 整單取消
      const wholeCancel = voidOrders.filter(o => managerMatch(o.voidBy))
      const wcRows = []
      wholeCancel.forEach(o => {
        wcRows.push({ label: `${o.orderNo || ''}　${timeFmt(o.date)}`, amount: o.totalPrice })
        wcRows.push({ label: `　${timeFmt(o.voidDate)}　${o.voidBy || ''}` })
        if (o.voidReason) wcRows.push({ label: `　原因：${o.voidReason}` })
      })
      wcRows.push({ label: `總數：${wholeCancel.length} 單據`, amount: sum(wholeCancel, o => o.totalPrice), bold: true })

      // 項目取消
      const itemCancelled = []
      scopedAll.forEach(o => (o.order || []).forEach(it => {
        if (it.voidStatus !== 1) return
        if (!managerMatch(it.voidBy)) return
        itemCancelled.push({ order: o, item: it })
      }))
      const icRows = []
      itemCancelled.forEach(({ order: o, item: it }) => {
        const n = Number(it.voidQty || it.count || it.qty || 1)
        const p = Number(it.price || it.amount || 0)
        icRows.push({ label: `${o.orderNo || ''}　${timeFmt(o.date)}　${it.name || ''}`, count: n, amount: money(p * n) })
        icRows.push({ label: `　${it.plu || ''}　${timeFmt(it.voidDate)}　${it.voidBy || ''}` })
        if (it.voidReason) icRows.push({ label: `　原因：${it.voidReason}` })
      })
      const icAmount = itemCancelled.reduce((s, x) => s + (Number(x.item.price || x.item.amount) || 0) * (Number(x.item.voidQty || x.item.count || x.item.qty || 1)), 0)
      icRows.push({ label: `總數：${itemCancelled.length} 項目`, amount: money(icAmount), bold: true })

      // 付款取消（反結帳）
      const paymentCancel = scopedAll.filter(o => o.refundDate && managerMatch(o.unsettledBy))
      const pcRows = []
      paymentCancel.forEach(o => {
        pcRows.push({ label: `${o.orderNo || ''}　${timeFmt(o.paymentCancelAt)}`, amount: o.totalPrice })
        pcRows.push({ label: `　${o.payMethod || ''}　${timeFmt(o.unsettledAt || o.refundDate)}　${o.unsettledBy || ''}` })
        if (o.refundReason) pcRows.push({ label: `　原因：${o.refundReason}` })
      })
      pcRows.push({ label: `總數：${paymentCancel.length} 付款`, amount: sum(paymentCancel, o => o.totalPrice), bold: true })

      // 合併枱
      const mergeTable = scopedAll.filter(o => o.fromAction === 'merge')
      const mtRows = []
      mergeTable.forEach(o => {
        mtRows.push({ label: `${o.orderNo || ''}　${timeFmt(o.date)}`, amount: o.totalPrice })
        mtRows.push({ label: `　${o.transferredFrom || ''} → ${o.deskNo || ''}` })
      })
      mtRows.push({ label: `總數：${mergeTable.length} 合併枱`, amount: sum(mergeTable, o => o.totalPrice), bold: true })

      sections = [
        { title: '整單取消', rows: wcRows },
        { title: '項目取消', rows: icRows },
        { title: '付款取消', rows: pcRows },
        { title: '合併枱', rows: mtRows }
      ]
    } else if (type === 'printRecord') {
      const printed = orders.filter(o => o.printed)
      sections = [
        { title: '印單紀錄', rows: [
          { label: '已印單數', count: printed.length, amount: sum(printed, o => o.totalPrice) },
          { label: '未印單數', count: orders.length - printed.length, amount: sum(orders.filter(o => !o.printed), o => o.totalPrice) }
        ] }
      ]
    } else if (type === 'mergeTable') {
      sections = [
        { title: '合併枱統計', rows: [{ label: '合併枱訂單', count: orders.filter(o => o.subtype === 3).length, amount: sum(orders.filter(o => o.subtype === 3), o => o.totalPrice) }] }
      ]
    } else if (type === 'itemTransfer') {
      sections = [
        { title: '項目轉移統計', rows: [{ label: '轉移訂單', count: orders.filter(o => o.tranType === 1).length, amount: sum(orders.filter(o => o.tranType === 1), o => o.totalPrice) }] }
      ]
    } else if (type === 'orderDetail') {
      const itemAnalysis = {}
      orders.forEach(o => (o.order || []).forEach(item => {
        if (item.voidStatus === 1) return
        const name = item.name || '未命名'
        const category = item.categoryName || item.category || '未分類'
        const key = category + '|' + name
        if (!itemAnalysis[key]) itemAnalysis[key] = { category, name, plu: item.plu || '', price: 0, qty: 0, amount: 0, discount: 0 }
        const n = Number(item.count || item.qty || 1)
        const p = Number(item.price || item.amount || 0)
        itemAnalysis[key].qty += n
        itemAnalysis[key].amount += p * n
        itemAnalysis[key].price = p
        itemAnalysis[key].discount += Number(item.discount || 0) * n
      }))
      const categorySummary = {}
      Object.values(itemAnalysis).forEach(it => {
        if (!categorySummary[it.category]) categorySummary[it.category] = { qty: 0, amount: 0, discount: 0 }
        categorySummary[it.category].qty += it.qty
        categorySummary[it.category].amount += it.amount
        categorySummary[it.category].discount += it.discount
      })
      const itemRows = []
      Object.keys(categorySummary).sort().forEach(cat => {
        const catItems = Object.values(itemAnalysis).filter(it => it.category === cat).sort((a, b) => a.name.localeCompare(b.name))
        const cs = categorySummary[cat]
        catItems.forEach(it => {
          const pct = cs.amount ? money(it.amount / cs.amount * 100) : 0
          itemRows.push({ label: `${it.name}　PLU:${it.plu || '-'}`, count: it.qty, amount: money(it.amount), average: `${pct}%`, bold: false })
        })
        itemRows.push({ label: `　${cat} 小計`, count: cs.qty, amount: money(cs.amount - cs.discount), bold: true })
      })
      itemRows.push({ label: '合計', count: Object.values(categorySummary).reduce((s, c) => s + c.qty, 0), amount: money(activeAmount - discount), bold: true })
      sections = [
        { title: '商品銷售分析（Item Sales Analysis）', rows: itemRows },
        { title: '帳單統計（Check Summary）', rows: [
          { label: '總帳單數（Checks）', count: orders.length },
          { label: '總人數（Cover）', count: totalPax },
          { label: '營業總額（Gross Amount）', amount: activeAmount },
          { label: '折扣（Discount）', amount: -discount },
          { label: '服務費（Service Charge）', amount: serviceCharge },
          { label: '稅項（Tax）', amount: tax },
          { label: '抹零（Rounding）', amount: rounding },
          { label: '應收總額（Net Amount）', amount: money(activeAmount - discount + serviceCharge + tax + rounding), bold: true },
          { label: '平均每單（Avg Check）', amount: avgCheck },
          { label: '平均每客（Avg Cover）', amount: avgCover }
        ] }
      ]
    } else if (type === 'staffHours') {
      sections = [
        { title: '員工工時', rows: cashierGroups.map(row => ({ label: row.name, count: row.count, amount: money(row.amount), average: row.count ? money(row.amount / row.count) : 0 })) }
      ]
    } else if (type === 'discount') {
      // 全日折扣報表：依折扣類別分組（整單折扣 / 單項折扣 / 贈送 / 撞餐）
      const comMap = {}
      try {
        const coms = await Commodity.find().select('_id price').lean().exec()
        coms.forEach(c => { comMap[String(c._id)] = c })
      } catch (e) {}
      const fmtDate = d => (d ? moment(d).format('YYYYMMDD') : '')
      const fmtTime = d => (d ? moment(d).format('HH:mm:ss') : '')
      const origPriceOf = (item) => {
        if (Number(item.bundleOrigPrice) > 0) return Number(item.bundleOrigPrice)
        const id = item.commodityId || item._id
        if (id && comMap[String(id)] && Number(comMap[String(id)].price) > 0) return Number(comMap[String(id)].price)
        return Number(item.price) || 0
      }
      const buckets = { '整單折扣': [], '單項折扣': [], '贈送': [], '撞餐': [] }
      const push = (cat, orderNo, date, time, op, method, amount, pax) => {
        buckets[cat].push({ orderNo, date, time, op, method, amount, pax: Number(pax) || 0 })
      }
      // 整單折扣
      orders.forEach(o => {
        const amt = money(Number(o.discount) || 0)
        if (amt > 0) push('整單折扣', o.orderNo, fmtDate(o.date), fmtTime(o.settledAt || o.date), o.cashier || o.waiter || '', '整單折扣', amt, o.pax)
      })
      // 項目級折扣
      orders.forEach(o => (o.order || []).forEach(item => {
        if (item.voidStatus === 1) return
        const count = Number(item.count || item.qty || 1)
        const price = Number(item.price) || 0
        const op = o.cashier || o.waiter || ''
        const date = fmtDate(o.date)
        const time = fmtTime(o.settledAt || o.date)
        if (item.bundlePrice) {
          const amt = money(Math.max(0, origPriceOf(item) - price) * count)
          if (amt > 0) push('撞餐', o.orderNo, date, time, op, '撞餐', amt, o.pax)
          return
        }
        if (item.free) {
          const amt = money(price * count)
          if (amt > 0) push('贈送', o.orderNo, date, time, op, '贈送', amt, o.pax)
          return
        }
        if (Number(item.customPrice) > 0 && Number(item.customPrice) < price) {
          const amt = money((price - Number(item.customPrice)) * count)
          if (amt > 0) push('單項折扣', o.orderNo, date, time, op, '改價', amt, o.pax)
          return
        }
        if (Number(item.discount) < 1 && Number(item.discount) >= 0) {
          const amt = money(price * count * (1 - Number(item.discount)))
          if (amt > 0) push('單項折扣', o.orderNo, date, time, op, `${Math.round((1 - Number(item.discount)) * 100)}% 折扣`, amt, o.pax)
        }
      }))
      const catOrder = ['整單折扣', '單項折扣', '贈送', '撞餐']
      const sectionRows = []
      let grandCount = 0
      let grandPax = 0
      let grandAmount = 0
      catOrder.forEach(cat => {
        const list = buckets[cat]
        if (!list.length) return
        const rows = []
        list.forEach(r => {
          rows.push({ label: `${r.orderNo || ''}　${r.date || ''}`, amount: money(r.amount) })
          rows.push({ label: `　${r.op || ''}　${r.time || ''}　${r.method || ''}` })
        })
        const cnt = list.length
        const pax = list.reduce((s, r) => s + (r.pax || 0), 0)
        const amt = money(list.reduce((s, r) => s + r.amount, 0))
        rows.push({ label: '　單據#', count: cnt })
        rows.push({ label: '　總人數', count: pax })
        rows.push({ label: '　** 總 數 **', amount: amt, bold: true })
        sectionRows.push({ title: `折扣類別　:　${cat}`, rows })
        grandCount += cnt
        grandPax += pax
        grandAmount += amt
      })
      if (sectionRows.length) {
        sectionRows.push({ title: '營業區統計', rows: [
          { label: '營業區單據#', count: grandCount },
          { label: '營業區總人數', count: grandPax },
          { label: '** 營業區總數 **', amount: money(grandAmount), bold: true }
        ] })
        sectionRows.push({ title: '總計', rows: [
          { label: '總單據#', count: grandCount },
          { label: '總人數', count: grandPax },
          { label: '** 總 額 **', amount: money(grandAmount), bold: true }
        ] })
      }
      sections = sectionRows
    } else {
      sections = [
        { title: '營業帳項', rows: [
          { label: '營業總額（Gross Amount）', count: orders.length, amount: activeAmount, bold: true },
          { label: '折扣（Discount）', amount: -discount },
          { label: '服務費（Service Charge）', amount: serviceCharge },
          { label: '稅項（Tax）', amount: tax },
          { label: '抹零（Rounding）', amount: rounding },
          { label: '應收總額（Net Amount）', amount: money(activeAmount - discount + serviceCharge + tax + rounding), bold: true }
        ] },
        { title: '收款方式（Payment）', rows: payments.map(row => ({ label: row.name, count: row.count, amount: money(row.amount) })) },
        { title: '取消統計（Void & Refund）', rows: [
          { label: '全單取消（Void Check）', count: voidOrders.length, amount: voidCheckAmount },
          { label: '項目取消（Void Item）', count: itemVoid.count, amount: itemVoid.amount },
          { label: '退售（Refund）', count: refundOrders.length, amount: refundAmount }
        ] },
        slotSection,
        { title: '收銀員', rows: cashierGroups.map(row => ({ label: row.name, count: row.count, amount: money(row.amount) })) },
        { title: '營業帳項（部門）', rows: deptRevenue.map(d => ({ label: d.department, count: d.count, amount: money(d.amount) })) },
        { title: '未結單據', rows: [{ label: '未結訂單', count: outstanding.length, amount: sum(outstanding, order => order.totalPrice) }] }
      ]
    }
    const fmtValue = (row) => {
      const countStr = row.count !== undefined ? String(row.count) : ''
      const amountStr = row.amount !== undefined ? `$${money(row.amount)}` : ''
      const avgStr = row.average !== undefined && row.average !== '' ? `　${row.average}` : ''
      return [countStr, amountStr, avgStr].filter(Boolean).join('　')
    }
    const rows = sections.reduce((result, section) => result.concat([{ label: section.title, value: '', section: true }], section.rows.map(row => ({ label: row.label, value: fmtValue(row), bold: row.bold }))), [])
    res.json({ title, subtitle, rows, sections, slots: globalSlots.map(s => ({ name: s.name, start: s.start, end: s.end })), slot, printTime: moment().format('YYYY-MM-DD HH:mm:ss') })
  } catch (err) {
    console.log(err)
    res.status(400).send('獲取報表失敗！')
  }
})

// $route POST api/statistic/submit
// @desc 提交统计信息，返回json数据
// @access private
router.post('/submit', async (req, res) => {
  try {
    const date = moment(req.body.date).format('YYYY-MM-DD')
    const income = parseFloat(req.body.income)
    const result = await ChartsData.findOneAndUpdate(
      { date },
      { $inc: { income, order: +1 } },
      { upsert: true, new: true }
    ).exec()
    if (result) {
      res.json({ status: 'ok' })
    } else {
      res.status(400).send('统计数据失败')
    }
  } catch (err) {
    console.log(err)
  }
})

module.exports = router
