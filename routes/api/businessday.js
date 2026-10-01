const express = require('express')
const router = express.Router()
const moment = require('moment')
const BusinessDay = require('../../models/BusinessDay')
const Order = require('../../models/Order')
const Commodity = require('../../models/Commodity')
const Category = require('../../models/Category')
const PosSetting = require('../../models/PosSetting')
const Table = require('../../models/Table')
const AuditLog = require('../../models/AuditLog')
const socketio = require('../../plugins/SocketIO')

const money = v => Math.round((Number(v) || 0) * 100) / 100

function itemSubtotal (item) {
  const base = item.free ? 0 : (item.customPrice > 0 ? item.customPrice : (item.price || 0))
  const unit = base * (item.discount || 1)
  return Math.round(unit * (item.count || 1) * 100) / 100
}

// 依商品項的 department 匯總營業額（部門管理，報表最底顯示）
// 報表時間點即時解析部門：優先品項 department → 商品 department → 分類 department，找不到歸「未分類」
async function computeDepartmentTotals (orders) {
  const [commodities, categories] = await Promise.all([
    Commodity.find().select('_id department').lean().exec(),
    Category.find().select('_id cName department').lean().exec()
  ])
  const comMap = {}
  commodities.forEach(c => { comMap[String(c._id)] = c })
  const catMap = {}
  categories.forEach(c => { catMap[String(c._id)] = c; catMap[c.cName] = c })
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
      // 套餐：依 departmentSplit 分帳到各部門（收入）
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

// 從認證上下文提取操作者（員工 no/name；管理員 account/name）
function operatorOf (req) {
  const u = req.user
  if (!u) return { staffNo: '', staffName: '' }
  if (u.no !== undefined) return { staffNo: u.no || '', staffName: u.name || '' }
  return { staffNo: u.account || u.username || '', staffName: u.name || '' }
}

// 根據 cutoffTime 計算當前營業日日期
async function getBusinessDate () {
  let cutoff = '03:00'
  try {
    const setting = await PosSetting.findOne().lean().exec()
    if (setting && setting.businessDayCutoff) cutoff = setting.businessDayCutoff
  } catch (e) { /* ignore */ }
  const today = moment()
  const [h, m] = cutoff.split(':').map(Number)
  const cutoffMinutes = (h || 0) * 60 + (m || 0)
  const currentMinutes = today.hour() * 60 + today.minute()
  if (currentMinutes < cutoffMinutes) {
    return today.clone().subtract(1, 'day').format('YYYY-MM-DD')
  }
  return today.format('YYYY-MM-DD')
}

// $route GET api/businessday/current
// @desc 取得當前營業日狀態
// @access public
router.get('/current', async (req, res) => {
  try {
    const date = await getBusinessDate()
    const businessDay = await BusinessDay.findOne({ date }).lean().exec()
    const cutoff = (await PosSetting.findOne().lean().exec() || {}).businessDayCutoff || '03:00'
    res.json({
      date,
      businessDay: businessDay || null,
      cutoff,
      hasBusinessDay: !!businessDay,
      isOpen: !!(businessDay && businessDay.status === 'open')
    })
  } catch (err) {
    console.log(err)
    res.status(400).send('獲取營業日狀態失敗！')
  }
})

// $route POST api/businessday/dayReport
// @desc 每日結算報表（整個營業日統計，若尚未有營業日則自動建立）
// @access public
router.post('/dayReport', async (req, res) => {
  try {
    const date = req.body.date || await getBusinessDate()
    const businessDay = await BusinessDay.findOneAndUpdate(
      { date },
      { $setOnInsert: { date, startingCash: 0, status: 'open', openedBy: '系統自動' } },
      { upsert: true, new: true }
    ).exec()
    const orders = await Order.find({
      businessDayId: businessDay._id,
      state: 1,
      voidStatus: { $ne: 1 }
    }).lean().exec()
    const voidOrders = await Order.find({ businessDayId: businessDay._id, voidStatus: 1 }).lean().exec()
    const unsettleOrders = await Order.find({ businessDayId: businessDay._id, unsettleCount: { $gt: 0 } }).lean().exec()
    const totalIncome = money(orders.reduce((s, o) => s + (o.totalPrice || 0), 0))
    const cashIncome = money(orders.filter(o => /現金|cash/i.test(o.payMethod || '')).reduce((s, o) => s + (o.totalPrice || 0), 0))
    const cardIncome = money(orders.filter(o => /信用卡|credit|卡/i.test(o.payMethod || '')).reduce((s, o) => s + (o.totalPrice || 0), 0))
    const otherIncome = money(totalIncome - cashIncome - cardIncome)
    const voidAmount = money(voidOrders.reduce((s, o) => s + (o.totalPrice || 0), 0))
    const discountTotal = money(orders.reduce((s, o) => s + (o.discount || 0), 0))
    const serviceChargeTotal = money(orders.reduce((s, o) => s + (o.serviceCharge || 0), 0))
    const taxTotal = money(orders.reduce((s, o) => s + (o.tax || 0), 0))
    const paidOutTotal = money((businessDay.paidOuts || []).reduce((s, r) => s + (r.amount || 0), 0))
    const receivedTotal = money((businessDay.receiveds || []).reduce((s, r) => s + (r.amount || 0), 0))
    const expectedCash = money(businessDay.startingCash + cashIncome + receivedTotal - paidOutTotal)
    res.json({
      date: businessDay.date,
      status: businessDay.status,
      startingCash: businessDay.startingCash,
      snapshot: {
        orderCount: orders.length,
        totalIncome,
        cashIncome,
        cardIncome,
        otherIncome,
        voidCount: voidOrders.length,
        voidAmount,
        unsettleCount: unsettleOrders.length,
        unsettleAmount: money(unsettleOrders.reduce((s, o) => s + (o.totalPrice || 0), 0)),
        discountTotal,
        serviceChargeTotal,
        taxTotal,
        paidOutTotal,
        receivedTotal,
        departmentTotals: await computeDepartmentTotals(orders)
      },
      expectedCash,
      cashDiff: money((Number(businessDay.countedCash) || 0) - expectedCash),
      unsettleList: unsettleOrders.map(o => ({
        orderNo: o.orderNo || '',
        deskNo: o.deskNo || '',
        amount: o.totalPrice || 0,
        count: o.unsettleCount || 1,
        unsettledAt: o.unsettledAt || null,
        unsettledBy: o.unsettledBy || ''
      }))
    })
  } catch (err) {
    console.log(err)
    res.status(400).send('獲取每日結算報表失敗！')
  }
})

// $route POST api/businessday/paidOut
// @desc 代支（支出）——記錄非銷售現金支出並開銀櫃
// @access public
router.post('/paidOut', async (req, res) => {
  try {
    const amount = money(req.body.amount)
    if (amount <= 0) return res.status(400).send('請輸入有效的代支金額')
    const date = await getBusinessDate()
    const op = operatorOf(req)
    const record = {
      amount,
      reason: (req.body.reason || '').trim(),
      staffNo: req.body.staffNo || op.staffNo || '',
      staffName: req.body.staffName || op.staffName || '',
      time: new Date()
    }
    const businessDay = await BusinessDay.findOneAndUpdate(
      { date },
      { $setOnInsert: { date, startingCash: 0, status: 'open', openedBy: '系統自動' }, $push: { paidOuts: record } },
      { upsert: true, new: true }
    ).exec()
    try { await AuditLog.create({ staffNo: record.staffNo, staffName: record.staffName, action: 'paidOut', actionLabel: '代支', amount, detail: record.reason, date: new Date() }) } catch (e) { /* ignore */ }
    res.json({ success: true, message: '代支成功', amount, date: businessDay.date })
  } catch (err) {
    console.log(err)
    res.status(400).send('代支失敗，請重試！')
  }
})

// $route POST api/businessday/received
// @desc 代收（收入）——記錄非銷售現金收入並開銀櫃
// @access public
router.post('/received', async (req, res) => {
  try {
    const amount = money(req.body.amount)
    if (amount <= 0) return res.status(400).send('請輸入有效的代收金額')
    const date = await getBusinessDate()
    const op = operatorOf(req)
    const record = {
      amount,
      reason: (req.body.reason || '').trim(),
      staffNo: req.body.staffNo || op.staffNo || '',
      staffName: req.body.staffName || op.staffName || '',
      time: new Date()
    }
    const businessDay = await BusinessDay.findOneAndUpdate(
      { date },
      { $setOnInsert: { date, startingCash: 0, status: 'open', openedBy: '系統自動' }, $push: { receiveds: record } },
      { upsert: true, new: true }
    ).exec()
    try { await AuditLog.create({ staffNo: record.staffNo, staffName: record.staffName, action: 'received', actionLabel: '代收', amount, detail: record.reason, date: new Date() }) } catch (e) { /* ignore */ }
    res.json({ success: true, message: '代收成功', amount, date: businessDay.date })
  } catch (err) {
    console.log(err)
    res.status(400).send('代收失敗，請重試！')
  }
})

// $route POST api/businessday/close
// @desc 每日結算（結算營業日），每日可做多次，前提是沒有未結賬單
// @access public
router.post('/close', async (req, res) => {
  try {
    const { countedCash, startingCash, remark } = req.body
    const date = await getBusinessDate()
    // 只攔截「有品項、未作廢」的未結訂單；工作站鎖定的空單（order 為空）與已作廢單不計入
    const unsettlCheck = await Order.find({ state: 0, voidStatus: { $ne: 1 }, 'order.0': { $exists: true } }).lean().exec()
    if (unsettlCheck.length > 0) {
      const deskNos = [...new Set(unsettlCheck.map(o => o.deskNo))].sort((a, b) => a - b)
      return res.status(400).send('尚有單據未結帳！以下枱號仍有未結訂單：' + deskNos.join('、'))
    }
    const businessDay = await BusinessDay.findOneAndUpdate(
      { date },
      { $setOnInsert: { date, startingCash: 0, status: 'open', openedBy: '系統自動' } },
      { upsert: true, new: true }
    ).exec()
    const allOrders = await Order.find({ businessDayId: businessDay._id, state: 1, voidStatus: { $ne: 1 } }).lean().exec()
    const allVoid = await Order.find({ businessDayId: businessDay._id, voidStatus: 1 }).lean().exec()
    const allUnsettle = await Order.find({ businessDayId: businessDay._id, unsettleCount: { $gt: 0 } }).lean().exec()
    const totalIncome = money(allOrders.reduce((s, o) => s + (o.totalPrice || 0), 0))
    const cashIncome = money(allOrders.filter(o => /現金|cash/i.test(o.payMethod || '')).reduce((s, o) => s + (o.totalPrice || 0), 0))
    const cardIncome = money(allOrders.filter(o => /信用卡|credit|卡/i.test(o.payMethod || '')).reduce((s, o) => s + (o.totalPrice || 0), 0))
    businessDay.startingCash = Number(startingCash) || 0
    businessDay.countedCash = Number(countedCash) || 0
    businessDay.closeRemark = remark || ''
    businessDay.closeTime = new Date()
    businessDay.status = 'closed'
    businessDay.closedBy = req.body.staffName || req.body.staffNo || ''
    businessDay.snapshot = {
      orderCount: allOrders.length,
      totalIncome,
      cashIncome,
      cardIncome,
      otherIncome: money(totalIncome - cashIncome - cardIncome),
      voidCount: allVoid.length,
      voidAmount: money(allVoid.reduce((s, o) => s + (o.totalPrice || 0), 0)),
      unsettleCount: allUnsettle.length,
      unsettleAmount: money(allUnsettle.reduce((s, o) => s + (o.totalPrice || 0), 0)),
      discountTotal: money(allOrders.reduce((s, o) => s + (o.discount || 0), 0)),
      serviceChargeTotal: money(allOrders.reduce((s, o) => s + (o.serviceCharge || 0), 0)),
      taxTotal: money(allOrders.reduce((s, o) => s + (o.tax || 0), 0)),
      paidOutTotal: money((businessDay.paidOuts || []).reduce((s, r) => s + (r.amount || 0), 0)),
      receivedTotal: money((businessDay.receiveds || []).reduce((s, r) => s + (r.amount || 0), 0)),
      departmentTotals: await computeDepartmentTotals(allOrders)
    }
    await businessDay.save()

    // 每日完結後清除搭枱子枱（shareSuffix 非空者），讓子枱不殘留在枱面
    await Table.deleteMany({ shareSuffix: { $exists: true, $ne: '' } }).exec()
    try {
      const io = socketio.getIO()
      if (io) io.emit('tableLayoutChanged')
    } catch (e) { /* ignore */ }

    res.json({ success: true, message: '每日結算成功！' })
  } catch (err) {
    console.log(err)
    res.status(400).send('每日結算失敗，請重試！')
  }
})

// $route GET api/businessday/list
// @desc 查詢歷史營業日列表
// @access public
router.get('/list', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const size = Math.min(50, Math.max(1, parseInt(req.query.size) || 20))
    const total = await BusinessDay.countDocuments().exec()
    const list = await BusinessDay.find().sort({ date: -1 }).skip((page - 1) * size).limit(size).lean().exec()
    res.json({ total, list })
  } catch (err) {
    console.log(err)
    res.status(400).send('查詢失敗！')
  }
})

module.exports = router
