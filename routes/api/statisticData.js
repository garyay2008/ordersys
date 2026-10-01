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
    if (scope === 'personal' && waiter) filter.waiter = waiter
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
      cancelPayment: '取消付款報表', itemCancel: '項目取消報表', orderCancel: '全單取消報表',
      printRecord: '印單紀錄報表', mergeTable: '合併枱報表', itemTransfer: '項目轉移報表',
      orderDetail: '單據明細詳列', staffHours: '員工工時報表'
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
    const revenue = {}
    orders.forEach(order => (order.order || []).forEach(item => {
      const name = item.categoryName || item.category || '未分類'
      if (!revenue[name]) revenue[name] = { name, qty: 0, amount: 0 }
      revenue[name].qty += Number(item.count || item.qty || 1)
      revenue[name].amount += Number(item.price || item.amount || 0) * Number(item.count || item.qty || 1)
    }))
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
    let sections = []
    if (type === 'cashier') {
      sections = [
        { title: '營業帳項', rows: [
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
        { title: '取消統計（Void）', rows: [
          { label: '全單取消（Void Check）', count: voidOrders.length, amount: voidCheckAmount },
          { label: '項目取消（Void Item）', count: itemVoid.count, amount: itemVoid.amount },
          { label: '退售（Refund）', count: refundOrders.length, amount: refundAmount }
        ] },
        slotSection,
        { title: '收銀員業績', rows: cashierGroups.map(row => ({ label: row.name, count: row.count, amount: money(row.amount), average: row.count ? money(row.amount / row.count) : 0 })) },
        { title: '帳單統計（Check Summary）', rows: [
          { label: '總帳單數（Checks）', count: orders.length },
          { label: '總人數（Cover）', count: totalPax },
          { label: '平均每單（Avg Check）', amount: avgCheck },
          { label: '平均每客（Avg Cover）', amount: avgCover }
        ] },
        { title: '營業帳項（分類）', rows: Object.values(revenue).sort((a, b) => a.name.localeCompare(b.name)).map(row => ({ label: row.name, count: row.qty, amount: money(row.amount) })) },
        { title: '未結單據', rows: [{ label: '未結訂單', count: outstanding.length, amount: sum(outstanding, order => order.totalPrice) }] }
      ]
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
        { title: '營業帳項（分類）', rows: Object.values(revenue).sort((a, b) => a.name.localeCompare(b.name)).map(row => ({ label: row.name, count: row.qty, amount: money(row.amount) })) },
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
    } else if (type === 'cancelPayment') {
      sections = [
        { title: '取消統計（Void & Refund）', rows: [
          { label: '全單取消（Void Check）', count: voidOrders.length, amount: voidCheckAmount },
          { label: '項目取消（Void Item）', count: itemVoid.count, amount: itemVoid.amount },
          { label: '退售（Refund）', count: refundOrders.length, amount: refundAmount }
        ] },
        { title: '全單取消明細', hasExtra: true, rows: voidOrders.map(o => ({ label: o.orderNo + '　枱' + (o.deskNo || o.zone || ''), count: 1, amount: o.totalPrice, extra: `原因：${o.voidReason || o.voidReasonCode || '未填'}｜操作：${o.voidBy || ''}` })) },
        { title: '退售明細', hasExtra: true, rows: refundOrders.map(o => ({ label: o.orderNo + '　枱' + (o.deskNo || o.zone || ''), count: 1, amount: o.totalPrice, extra: `原因：${o.refundReason || '未填'}` })) }
      ]
    } else if (type === 'itemCancel') {
      const itemCancelled = []
      allOrders.forEach(o => (o.order || []).forEach(it => {
        if (it.voidStatus === 1) itemCancelled.push({ orderNo: o.orderNo, item: it })
      }))
      sections = [
        { title: '項目取消明細（Void Item Detail）', rows: itemCancelled.map(x => ({ label: x.item.name + '（' + x.orderNo + '）', count: x.item.count || x.item.qty || 1, amount: (Number(x.item.price || x.item.amount) || 0) * (Number(x.item.count || x.item.qty || 1)) })) }
      ]
    } else if (type === 'orderCancel') {
      sections = [
        { title: '全單取消明細（Void Check Detail）', rows: voidOrders.map(o => ({ label: o.orderNo + '　枱' + (o.deskNo || o.zone || ''), count: 1, amount: o.totalPrice })) }
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
        { title: '營業帳項（分類）', rows: Object.values(revenue).sort((a, b) => a.name.localeCompare(b.name)).map(row => ({ label: row.name, count: row.qty, amount: money(row.amount) })) },
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
