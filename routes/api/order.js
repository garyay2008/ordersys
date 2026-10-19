const express = require('express')
const router = express.Router()
const passport = require('passport')
const crypto = require('crypto')
const Order = require('../../models/Order')
const Printer = require('../../models/Printer')
const Table = require('../../models/Table')
const Commodity = require('../../models/Commodity')
const Category = require('../../models/Category')
const ModCode = require('../../models/ModCode')
const BusinessDay = require('../../models/BusinessDay')
const PosSetting = require('../../models/PosSetting')
const QrSetting = require('../../models/QrSetting')
const AuditLog = require('../../models/AuditLog')
const escpos = require('../../plugins/Printer')
const printQueue = require('../../plugins/printQueue')
const moment = require('moment')
const io = require('../../plugins/SocketIO').getIO()
const { requireLevel, staffLevel } = require('../../middleware/auth')
const bundle = require('../../plugins/bundle')

// 24 位 hex 字串即視為有效 ObjectId（PG 以 TEXT 存 _id）
function isValidObjectId (id) {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)
}

// 從認證上下文提取操作者（員工 no/name；管理員 account/name）
function operatorOf (req) {
  const u = req.user
  if (!u) return { staffNo: '', staffName: '' }
  if (u.no !== undefined) return { staffNo: u.no || '', staffName: u.name || '' }
  return { staffNo: u.account || u.username || '', staffName: u.name || '' }
}

// 寫入員工操作日誌（失敗不影響主流程）
async function logAction (req, action, actionLabel, meta) {
  try {
    const op = operatorOf(req)
    await AuditLog.create(Object.assign({
      staffNo: op.staffNo,
      staffName: op.staffName,
      action,
      actionLabel,
      date: new Date()
    }, meta || {}))
  } catch (e) {
    console.log('[AuditLog] 寫入失敗：' + e.message)
  }
}

// 工作站鎖定 TTL：超過此時長視為呆鎖，其他工作站可接管（單位：毫秒）
const LOCK_TTL_MS = 30 * 60 * 1000

// 兼容舊數據（Number）與新數據（String）的 deskNo 查詢
function deskNoQuery (deskNo) {
  const s = String(deskNo)
  // 純數字枱號：相容舊資料 Number / String
  if (/^\d+$/.test(s)) return { deskNo: { $in: [s, Number(s)] } }
  // 帶後綴（如 10A）或非數字枱號：精確比對，避免誤配主枱
  return { deskNo: s }
}

// 依 zone 決定訂單編號前綴（堂食 / 外賣枱 / 外賣）
function zonePrefixOf (setting, zone) {
  if (!setting) return '10'
  if (zone === '外賣') return setting.takeawayPrefix || '88'
  if (zone === '外賣枱') return setting.takeawayTablePrefix || '99'
  return setting.dineInPrefix || '10'
}

// 產生收銀機訂單編號（帶前綴 + 遞增流水號）；無收銀機時回退時間戳
async function genTerminalOrderNo (terminalCode, zone) {
  const PosTerminal = require('../../models/PosTerminal')
  if (terminalCode) {
    try {
      const terminal = await PosTerminal.findOneAndUpdate(
        { code: terminalCode },
        { $inc: { orderSeq: 1 } },
        { new: true }
      ).lean().exec()
      if (terminal) {
        const machinePrefix = terminal.orderPrefix || ''
        const seq = String(terminal.orderSeq).padStart(4, '0')
        let zonePrefix = ''
        const setting = await PosSetting.findOne().lean().exec()
        if (setting) zonePrefix = zonePrefixOf(setting, zone || '堂食')
        const parts = []
        if (zonePrefix) parts.push(zonePrefix)
        if (machinePrefix) parts.push(machinePrefix)
        parts.push(seq)
        return parts.join('')
      }
    } catch (e) {
      console.log('[Order] 收銀機流水號更新失敗：' + e.message)
    }
  }
  return moment(Date.now()).format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 8999 + 1000)
}

// 取得並自動建立當前營業日，回傳 businessDayId（失敗回傳 null）
async function getOrCreateBusinessDayId () {
  try {
    let cutoff = '03:00'
    const setting = await PosSetting.findOne().lean().exec()
    if (setting && setting.businessDayCutoff) cutoff = setting.businessDayCutoff
    const today = moment()
    const [h, m] = cutoff.split(':').map(Number)
    const cutoffMinutes = (h || 0) * 60 + (m || 0)
    const currentMinutes = today.hour() * 60 + today.minute()
    const bizDate = currentMinutes < cutoffMinutes ? today.clone().subtract(1, 'day').format('YYYY-MM-DD') : today.format('YYYY-MM-DD')
    const bd = await BusinessDay.findOneAndUpdate(
      { date: bizDate },
      { $setOnInsert: { date: bizDate, startingCash: 0, status: 'open', openedBy: '系統自動' } },
      { upsert: true, new: true }
    ).lean().exec()
    return bd._id
  } catch (e) {
    console.log('[Order] 綁定營業日失敗：' + e.message)
    return null
  }
}

// 外賣叫號：每日遞增（依營業日 cutoff 重置），格式 001（失敗時退回時分秒）
async function getNextTakeawayNo () {
  try {
    let cutoff = '03:00'
    const setting = await PosSetting.findOne().lean().exec()
    if (setting && setting.businessDayCutoff) cutoff = setting.businessDayCutoff
    const today = moment()
    const [h, m] = cutoff.split(':').map(Number)
    const cutoffMinutes = (h || 0) * 60 + (m || 0)
    const currentMinutes = today.hour() * 60 + today.minute()
    const bizDate = currentMinutes < cutoffMinutes ? today.clone().subtract(1, 'day').format('YYYY-MM-DD') : today.format('YYYY-MM-DD')
    const bd = await BusinessDay.findOneAndUpdate(
      { date: bizDate },
      { $inc: { takeawaySeq: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean().exec()
    return String(bd.takeawaySeq || 1).padStart(3, '0')
  } catch (e) {
    console.log('[Order] 產生外賣叫號失敗：' + e.message)
    return moment(Date.now()).format('HHmmss')
  }
}

async function cleanupExpiredZTables () {
  const startOfToday = moment().startOf('day').toDate()
  await Table.deleteMany({ name: /^\d+Z$/, date: { $lt: startOfToday } })
}

cleanupExpiredZTables().catch(err => console.log(err))
const zCleanupTimer = setInterval(() => cleanupExpiredZTables().catch(err => console.log(err)), 60 * 60 * 1000)
if (zCleanupTimer.unref) zCleanupTimer.unref()

// $route POST api/order/submit
// @desc 提交订单信息，返回json数据
// @access public
// 限量庫存扣減：每送一份扣一份，扣完自動沽清
async function decrementStock (items, multiplier = 1) {
  for (const item of items || []) {
    if (!item) continue
    if (item.contents && item.contents.length) {
      await decrementStock(item.contents, (item.count || 1) * multiplier)
      continue
    }
    const id = item.commodityId || item._id
    if (!id) continue
    try {
      const qty = (item.count || 1) * multiplier
      if (qty <= 0) continue
      const com = await Commodity.findById(id).lean().exec()
      if (!com) continue
      if (com.stock === -1) continue
      if (com.stock === undefined || com.stock === null || com.stock <= 0) continue
      const update = { $inc: { stock: -qty } }
      if (com.stock - qty <= 0) update.$set = { soldOut: true }
      await Commodity.findOneAndUpdate(
        { _id: id, stock: { $gte: qty } },
        update,
        { new: true }
      ).exec()
    } catch (e) {
      console.log('[Stock] 扣減失敗：' + e.message)
    }
  }
}

// 自动打印辅助（加单时只打印新加菜品 + 不分传菜总台/上菜纸）
async function autoPrint (order, newItems, isAdd, force, kitchenOnly) {
  try {
    const setting = await Printer.findOne().exec()
    if (!setting || (!setting.autoPrint && !force)) return
    const allItems = (isAdd && newItems && newItems.length) ? newItems : (order.order || [])
    const printItems = allItems.filter(it => it.dishStatus !== 'called')
    if (!printItems.length) return
    const printOrder = Object.assign({}, order.toObject ? order.toObject() : order, { order: printItems })
    if (order.zone === '外賣' || order.zone === '外賣枱') {
      // 外賣/外賣枱：按檔口長短單路由（只處理 takeaway* 檔口）；未設定則退回舊「外賣單／外賣枱單」
      const zoneLabel = order.zone === '外賣枱' ? '外賣枱' : '外賣'
      const tickets = escpos.buildKitchenByStation(setting, printOrder)
      for (const t of tickets) {
        await printQueue.enqueuePrint(setting, t.printer, t.data, printOrder)
        console.log('[Printer] 已打印[' + t.station + '档] 订单号：' + order.orderNo)
      }
      if (!tickets.length) {
        const zonePrinter = escpos.resolvePrinter(setting, zoneLabel)
        if (zonePrinter.ip) {
          await printQueue.enqueuePrint(setting, zonePrinter, escpos.buildExpeditorOrder(setting, printOrder, '【' + zoneLabel + '單】'), printOrder)
          console.log('[Printer] 已打印[' + zoneLabel + '單] 订单号：' + order.orderNo)
        }
      }
      return
    }
    const kitchenTarget = escpos.resolveTicketPrinter(setting, 'kitchen')
    if (kitchenTarget) {
      await printQueue.enqueuePrint(setting, kitchenTarget, escpos.buildKitchenOrder(kitchenTarget, printOrder, kitchenTarget.name), printOrder)
    } else {
      const tickets = escpos.buildKitchenByStation(setting, printOrder)
      for (const t of tickets) {
        await printQueue.enqueuePrint(setting, t.printer, t.data, printOrder)
        console.log('[Printer] 已打印[' + t.station + '档] 订单号：' + order.orderNo)
      }
    }
    if (kitchenOnly) return
    if (!isAdd) {
      const exp = escpos.resolvePrinter(setting, 'expeditor')
      if (exp.ip) await printQueue.enqueuePrint(setting, exp, escpos.buildExpeditorOrder(setting, order), order)
      const zones = setting.zones || []
      const zone = zones.find(z => (z.desks || []).map(String).indexOf(order.deskNo) >= 0)
      if (zone && zone.serviceIp) {
        const zonePrinter = { ip: zone.serviceIp, port: zone.servicePort || 9100, paperWidth: 58 }
        await printQueue.enqueuePrint(setting, zonePrinter, escpos.buildExpeditorOrder(setting, order, '【' + zone.name + '】预结单'), order)
      }
    }
  } catch (e) {
    console.log('[Printer] 自动打印失败：' + e.message)
  }
}

// 正規化訂單品項：commodityId（POS/QR/KDS 同源）+ 改碼物件化（原子 Modifier Master）
// 舊資料 mods 為純字串陣列 ['走蔥']，正規化後為 [{id, name, price, station}]
async function normalizeOrderItems (items) {
  const modNames = []
  const collect = (list) => {
    for (const item of list || []) {
      if (!item) continue
      if (item._id && !item.commodityId) item.commodityId = String(item._id)
      for (const m of item.mods || []) {
        if (typeof m === 'string' && modNames.indexOf(m) < 0) modNames.push(m)
      }
      if (item.contents && item.contents.length) collect(item.contents)
    }
  }
  collect(items)
  if (!modNames.length) return
  const byName = {}
  try {
    const master = await ModCode.find({ name: { $in: modNames } }).exec()
    master.forEach(m => { byName[m.name] = m })
  } catch (e) {
    console.log('[Order] 改碼主檔解析失敗：' + e.message)
  }
  const normalize = (list) => {
    for (const item of list || []) {
      if (!item) continue
      item.mods = (item.mods || []).map(m => {
        if (typeof m !== 'string') return m
        const mm = byName[m]
        if (mm) return { id: String(mm._id), name: mm.name, price: mm.price || 0, station: mm.station || '' }
        return { name: m }
      })
      if (item.contents && item.contents.length) normalize(item.contents)
    }
  }
  normalize(items)
}

// 讀取全局貨價跳價上下文（總開關 + 公眾假期 + 跳價規則）
async function getJumpContext () {
  try {
    const setting = await PosSetting.findOne().lean().exec()
    return {
      enabled: setting ? setting.jumpPriceEnabled !== false : true,
      holidays: (setting && setting.publicHolidays) || [],
      rules: (setting && setting.jumpPriceRules) || []
    }
  } catch (e) {
    return { enabled: true, holidays: [], rules: [] }
  }
}

// 依指定時間點對品項套用全局跳價（僅處理最上層品項，回傳總價變動金額）
async function applyJumpPrice (items, date, holidays, timing, rules, mode) {
  if (!Array.isArray(items) || !Array.isArray(rules) || !rules.length) return 0
  const ids = []
  for (const item of items) {
    if (!item) continue
    const id = item.commodityId || item._id
    if (id) ids.push(String(id))
  }
  if (!ids.length) return 0
  const validIds = [...new Set(ids)].filter(isValidObjectId)
  if (!validIds.length) return 0
  const commodities = await Commodity.find({ _id: { $in: validIds } }).lean().exec()
  const comMap = {}
  commodities.forEach(c => { comMap[String(c._id)] = c })
  let delta = 0
  for (const item of items) {
    if (!item) continue
    const id = item.commodityId || item._id
    const com = id ? comMap[String(id)] : null
    if (!com) continue
    // 撞餐跟餐價已由前端（POS/QR）設定，跳價不得覆寫
    if (item.bundlePrice) continue
    const jp = Commodity.resolveJumpPrice(com, date, holidays, timing, rules, mode)
    if (jp == null) continue
    const oldBase = item.customPrice > 0 ? item.customPrice : (item.price || 0)
    delta += Math.round((jp.price - oldBase) * (item.discount || 1) * (item.count || 1) * 100) / 100
    item.price = jp.price
    item.customPrice = 0
    item.jumpPriceApplied = true
    item.jumpSpecIndex = jp.specIndex
    item.jumpSpecName = jp.specName
  }
  return delta
}

// $route POST /api/order/previewNo
// @desc 產生下一個訂單編號（POS 開新單時預覽單號，僅查詢不遞增流水號）
// @access public
router.post('/previewNo', async (req, res) => {
  try {
    const PosTerminal = require('../../models/PosTerminal')
    const terminalCode = req.body.terminalCode || ''
    const zone = req.body.zone || '外賣'
    let orderNo = ''
    if (terminalCode) {
      const terminal = await PosTerminal.findOne({ code: terminalCode }).lean().exec()
      if (terminal) {
        const machinePrefix = terminal.orderPrefix || ''
        const seq = String((terminal.orderSeq || 0) + 1).padStart(4, '0')
        let zonePrefix = ''
        try {
          const setting = await PosSetting.findOne().lean().exec()
          if (setting) zonePrefix = zonePrefixOf(setting, zone)
        } catch (e) {}
        const parts = []
        if (zonePrefix) parts.push(zonePrefix)
        if (machinePrefix) parts.push(machinePrefix)
        parts.push(seq)
        orderNo = parts.join('')
      }
    }
    if (!orderNo) orderNo = moment(Date.now()).format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 8999 + 1000)
    res.json({ orderNo })
  } catch (e) {
    console.log('[Order] 產生預覽單號失敗：' + e.message)
    res.status(400).send('產生單號失敗！')
  }
})

router.post('/submit', async (req, res) => {
  let data = req.body
  const PosTerminal = require('../../models/PosTerminal')

  // 先判斷堂食/外賣（用於決定單號前綴）
  const isDineIn = !!data.deskNo
  data.source = ['qr', 'extension', 'kiosk'].indexOf(data.source) >= 0 ? data.source : 'pos'

  // 手機/QR 下單標記為虛擬員工 QRCODE（用戶編號 9999），讓後廚小票顯示開單/送單來源
  if (data.source === 'qr' && !data.waiter) data.waiter = 'QRCODE'

  // 根據收銀機 terminalCode 產生單號（帶前綴 + 遞增流水號）
  const terminalCode = data.terminalCode || ''
  if (terminalCode) {
    try {
      const terminal = await PosTerminal.findOneAndUpdate(
        { code: terminalCode },
        { $inc: { orderSeq: 1 } },
        { new: true }
      ).lean().exec()
      if (terminal) {
        const machinePrefix = terminal.orderPrefix || ''
        const seq = String(terminal.orderSeq).padStart(4, '0')
        // 堂食 / 外賣前綴
        let zonePrefix = ''
        try {
          const setting = await PosSetting.findOne().lean().exec()
          if (setting) {
            zonePrefix = zonePrefixOf(setting, data.zone || (isDineIn ? '堂食' : '外賣'))
          }
        } catch (e) {}
        const parts = []
        if (zonePrefix) parts.push(zonePrefix)
        if (machinePrefix) parts.push(machinePrefix)
        parts.push(seq)
        data.orderNo = parts.join('')
        data.orderSeq = seq
      } else {
        data.orderNo = moment(Date.now()).format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 8999 + 1000)
      }
    } catch (e) {
      console.log('[Order] 收銀機流水號更新失敗：' + e.message)
      data.orderNo = moment(Date.now()).format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 8999 + 1000)
    }
  } else {
    data.orderNo = moment(Date.now()).format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 8999 + 1000)
  }

  // 自動綁定當前營業日（每日開始由 cutoff 決定，首筆訂單自動建立）
  data.businessDayId = await getOrCreateBusinessDayId()

  // 外賣叫號：非堂食（外賣/外賣枱，deskNo=0）產生每日遞增叫號
  if (!isDineIn) {
    data.takeawayNo = await getNextTakeawayNo()
  }

  // 為每個商品項補充 categoryName 和 categoryNo（冗餘寫入，報表聚合用）
  if (Array.isArray(data.order)) {
    try {
      const categories = await Category.find().exec()
      const catMap = {}
      const catIdMap = {}
      categories.forEach(c => { catMap[c.cName] = c; catIdMap[String(c._id)] = c })

      for (const item of data.order) {
        let cat = null
        if (item.categoryId) cat = catIdMap[item.categoryId]
        if (!cat && item.category) cat = catMap[item.category]
        if (cat) {
          if (!item.categoryName) item.categoryName = cat.cName
          if (!item.categoryNo) item.categoryNo = cat.no
          if (!item.categoryId) item.categoryId = String(cat._id)
        }
        if (item.contents && Array.isArray(item.contents)) {
          for (const sub of item.contents) {
            let subCat = null
            if (sub.categoryId) subCat = catIdMap[sub.categoryId]
            if (!subCat && sub.category) subCat = catMap[sub.category]
            if (subCat) {
              if (!sub.categoryName) sub.categoryName = subCat.cName
              if (!sub.categoryNo) sub.categoryNo = subCat.no
              if (!sub.categoryId) sub.categoryId = String(subCat._id)
            }
          }
        }
      }
    } catch (e) {
      console.log('[Order] 補充分類資訊失敗：' + e.message)
    }
  }

  // 為每個商品項補充 department（部門管理，每日報表依部門匯總用）
  if (Array.isArray(data.order)) {
    try {
      const commodities = await Commodity.find().exec()
      const comMap = {}
      commodities.forEach(c => { comMap[String(c._id)] = c })
      const enrichDept = (item) => {
        if (!item) return
        const id = item.commodityId || item._id
        const com = id ? comMap[String(id)] : null
        if (!item.department && com && com.department) item.department = com.department
        // 檔口路由：套餐內容若未帶 station/stations，改用底層貨品的 station/stations（避免落到「通用」→ 第一個廚房檔口）
        if (com && !item.station && !(item.stations && item.stations.length)) {
          item.station = com.station || ''
          if (com.stations && com.stations.length) item.stations = com.stations
        }
        if (item.contents && Array.isArray(item.contents)) {
          let lastStation = ''
          let lastStations = null
          item.contents.forEach(sub => {
            if (!sub) return
            enrichDept(sub)
            const isModLine = typeof sub.name === 'string' && sub.name.indexOf('　· ') === 0
            if (isModLine) {
              // QR 改碼行（　· 開頭）無自身檔口時，繼承前一主品項的檔口
              if (!sub.station && !(sub.stations && sub.stations.length)) {
                if (lastStation) sub.station = lastStation
                if (lastStations && lastStations.length) sub.stations = lastStations
              }
            } else {
              if (sub.station) lastStation = sub.station
              if (sub.stations && sub.stations.length) lastStations = sub.stations
            }
          })
        }
      }
      data.order.forEach(enrichDept)
    } catch (e) {
      console.log('[Order] 補充部門資訊失敗：' + e.message)
    }
  }

  // 正規化 commodityId 與改碼（KDS 一致性 + Modifier Master 價格）
  if (Array.isArray(data.order)) {
    await normalizeOrderItems(data.order)
  }

  // 權威重算撞餐跟餐價：以 MatchingRule / BundleGroup 主檔為準，覆寫前端送來的跟餐價
  if (Array.isArray(data.order)) {
    const bundleResult = await bundle.recomputeBundlePricing(data.order)
    if (bundleResult.delta !== 0) {
      data.totalPrice = Math.round(((data.totalPrice || 0) + bundleResult.delta) * 100) / 100
    }
  }

  // 為每個品項補上入單時間（供菜品明細2 顯示入單時間）與送單員工（項目明細追蹤送單來源）
  if (Array.isArray(data.order)) {
    const now = new Date()
    for (const item of data.order) {
      if (item && !item.addTime) item.addTime = now
      if (item && data.waiter && !item.waiter) item.waiter = data.waiter
    }
  }

  try {
    const { enabled, holidays, rules } = await getJumpContext()
    let order = null
    let isAdd = false
    let existing = null
    // 堂食：該桌已有未完成訂單時，加單（合併 order + 總價），保留資料直到結帳
    if (isDineIn) {
      existing = await Order.findOne(Object.assign({ state: 0 }, deskNoQuery(data.deskNo))).exec()
    }
    // 跳價錢設定：入單計=當下入單時間；開枱計=該枱首次開枱時間
    const openDate = (existing && existing.date) ? existing.date : new Date()
    const jumpMode = data.zone || (isDineIn ? '堂食' : '外賣')
    const orderJumpDelta = await applyJumpPrice(data.order, new Date(), holidays, 'order', enabled ? rules : [], jumpMode)
    const openJumpDelta = await applyJumpPrice(data.order, openDate, holidays, 'open', enabled ? rules : [], jumpMode)
    if (orderJumpDelta !== 0 || openJumpDelta !== 0) {
      data.totalPrice = Math.round(((data.totalPrice || 0) + orderJumpDelta + openJumpDelta) * 100) / 100
    }
    if (existing) {
      const newItems = data.order || []
      existing.order = mergeOrderItems(existing.order, newItems)
      // 撞餐一配一防線：加單合併後對稱重算（跟餐多→復原原價，主食多→重新撞餐）
      existing.order = await rebalanceBundlePairs(existing.order)
      existing.totalPrice = Math.round(existing.order.reduce((sum, i) => sum + itemSubtotal(i), 0) * 100) / 100
      if (data.remark) existing.remark = data.remark
      if (data.source === 'qr' || data.source === 'extension' || data.source === 'kiosk') existing.source = data.source
      // 人數：每次送單同步最新人數（後廚小票於下單時列印，需於加單前帶上 pax）
      if (data.pax !== undefined) existing.pax = data.pax
      // 開單員工：首次送品項入廚房者（工作站鎖枱空單未帶 waiter，於第一次送單補上並保留，不隨加單覆蓋）
      if (data.waiter && !existing.waiter) existing.waiter = data.waiter
      // 工作站鎖定空單（businessDayId 為空）加單時補綁當前營業日，避免結算漏計
      if (data.businessDayId && !existing.businessDayId) existing.businessDayId = data.businessDayId
      await existing.save()
      order = existing
      isAdd = true
    }
    if (!order) {
      order = await Order.create(data)
    }
    await Order.updateOne({ _id: order._id }, { $set: { printed: !!data.printed } }).exec()
    await decrementStock(data.order)
    autoPrint(order, data.order, isAdd, !!req.body.print || data.source === 'qr' || data.source === 'kiosk', data.source === 'qr' || data.source === 'kiosk')
    if (io) { io.emit('tableUpdate'); io.emit('menuChanged') }
    logAction(req, 'order', isAdd ? '加單' : '下單', {
      staffName: data.waiter || '',
      deskNo: data.deskNo || '',
      orderNo: order.orderNo || '',
      amount: data.totalPrice || 0,
      detail: (data.order || []).map(it => (it.name || '') + 'x' + (it.count || 1)).join('、')
    })
    if (data.source === 'kiosk') {
      return res.json({ orderNo: order.orderNo, totalPrice: order.totalPrice, isAdd })
    }
    res.send(isAdd ? '加單成功！' : '下單成功店家正在處理您的訂單請耐心等待...')
  } catch (err) {
    // 訂單號碰撞自動重試一次
    if (err && err.code === 11000 && err.keyPattern && err.keyPattern.orderNo) {
      try {
        data.orderNo = moment(Date.now()).format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 8999 + 1000)
        const retryOrder = await Order.create(data)
        await decrementStock(data.order)
        autoPrint(retryOrder, data.order, false, !!req.body.print || data.source === 'qr' || data.source === 'kiosk', data.source === 'qr' || data.source === 'kiosk')
        if (io) { io.emit('tableUpdate'); io.emit('menuChanged') }
        if (data.source === 'kiosk') {
          return res.json({ orderNo: retryOrder.orderNo, totalPrice: retryOrder.totalPrice, isAdd: false })
        }
        return res.send('下單成功店家正在處理您的訂單請耐心等待...')
      } catch (retryErr) {
        console.log(retryErr)
      }
    }
    console.log(err)
    res.status(400).send('訂單提交失敗請重試！')
  }
})

// $route GET api/order/unfinished
// @desc 查询未完成订单信息，返回json数据
// @access private
router.get(
  '/unfinished',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    Order.find({ state: 0 })
      .sort({ date: -1 })
      .then(result => {
        res.send(result)
      })
      .catch(err => {
        res.status(400).send('查询失败，请重试！')
      })
  }
)

// $route POST api/order/finished
// @desc 查询已完成订单信息，返回json数据
// @access private
router.post(
  '/finished',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      let page = req.body
      let query = {}
      if (page.search) {
        page.search = moment(page.search).format('YYYY-MM-DD')
        query = {
          $and: [
            {
              date: {
                $gte: new Date(page.search + ' 00:00:00'),
                $lte: new Date(page.search + ' 23:59:59')
              }
            },
            {
              state: 1
            }
          ]
        }
      } else {
        query = { state: 1 }
        // 「往日單據」只顯示過往日子的訂單，排除今天（依營業日 cutoff 判定）的訂單
        try {
          let cutoff = '03:00'
          const posSetting = await PosSetting.findOne().lean().exec()
          if (posSetting && posSetting.businessDayCutoff) cutoff = posSetting.businessDayCutoff
          const now = moment()
          const [h, m] = cutoff.split(':').map(Number)
          const cutoffMinutes = (h || 0) * 60 + (m || 0)
          const currentMinutes = now.hour() * 60 + now.minute()
          const bizDate = currentMinutes < cutoffMinutes ? now.clone().subtract(1, 'day').format('YYYY-MM-DD') : now.format('YYYY-MM-DD')
          const bd = await BusinessDay.findOne({ date: bizDate }).lean().exec()
          if (bd) query.businessDayId = { $ne: bd._id }
        } catch (e) { /* ignore */ }
      }
      const total = await Order.countDocuments(query).exec()
      const result = await Order.find(query)
        .sort({ date: -1 })
        .limit(page.size)
        .skip(page.size * (page.index - 1))
      res.json({ total, result })
    } catch (err) {
      console.log(err)
    }
  }
)

// $route POST api/order/finish
// @desc 提交已完成订单信息，返回json数据
// @access private
router.post(
  '/finish',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      let _id = req.body._id
      const order = await Order.findById(_id).exec()
      if (!order) {
        res.status(400).send('訂單不存在！')
        return
      }

      // 埋單計跳價：結帳時依當下時間重新套用規格價
      const { enabled, holidays, rules } = await getJumpContext()
      const jumpMode = order.zone || (order.deskNo && String(order.deskNo) !== '0' ? '堂食' : '外賣')
      const jumpDelta = await applyJumpPrice(order.order, new Date(), holidays, 'checkout', enabled ? rules : [], jumpMode)

      order.state = 1
      order.settledAt = new Date()
      if (req.body.totalPrice !== undefined) order.totalPrice = req.body.totalPrice
      if (req.body.serviceCharge !== undefined) order.serviceCharge = req.body.serviceCharge
      if (req.body.discount !== undefined) order.discount = req.body.discount
      if (req.body.rounding !== undefined) order.rounding = req.body.rounding
      if (req.body.pax !== undefined) order.pax = req.body.pax
      if (req.body.waiter !== undefined && !order.waiter) order.waiter = req.body.waiter
      if (req.body.cashier !== undefined) order.cashier = req.body.cashier
      if (req.body.payMethod !== undefined) order.payMethod = req.body.payMethod
      if (req.body.tip !== undefined) order.tip = req.body.tip
      if (req.body.terminalCode !== undefined) order.terminalCode = req.body.terminalCode

      if (jumpDelta !== 0) {
        const baseTotal = Math.round(((order.totalPrice || 0) + jumpDelta) * 100) / 100
        const discount = Number(req.body.discount) || 0
        let serviceCharge = Number(req.body.serviceCharge) || 0
        try {
          const setting = await PosSetting.findOne().lean().exec()
          if (setting && setting.serviceChargeEnabled) {
            const scBase = setting.serviceChargePreDiscount !== false ? baseTotal : Math.max(0, baseTotal - discount)
            serviceCharge = Math.round(scBase * (setting.serviceChargeRate || 0) / 100 * 100) / 100
          }
        } catch (e) {}
        order.totalPrice = Math.max(0, Math.round((baseTotal - discount + serviceCharge) * 100) / 100)
        order.serviceCharge = serviceCharge
        order.discount = discount
        order.markModified('order')
      }
      await order.save()

      // 子枱（搭枱）付款後立即刪除，釋出字母 A/B/C/D 供當日重複使用
      try {
        if (order.deskNo) {
          const sub = await Table.findOne({ no: String(order.deskNo), shareSuffix: { $exists: true, $ne: '' } })
          if (sub) {
            await Table.findOneAndRemove({ _id: sub._id })
            if (io) io.emit('tableLayoutChanged')
          }
        }
      } catch (e) {
        console.log('[Order] 清除子枱失敗：' + e.message)
      }

      // 錢箱觸發：根據 terminalCode 對應的收銀機觸發彈開
      const terminalCode = req.body.terminalCode || ''
      const payMethod = req.body.payMethod || ''
      if (terminalCode && /現金|cash/i.test(payMethod)) {
        escpos.openDrawerByTerminal(terminalCode).catch(err => {
          console.log('[Printer] 錢箱觸發失敗：' + err.message)
        })
      }
      if (io) io.emit('tableUpdate')
      logAction(req, 'checkout', '結帳', {
        deskNo: order.deskNo || '',
        orderNo: order.orderNo || '',
        amount: order.totalPrice || 0,
        detail: order.payMethod || ''
      })
      res.send('订单已完成！')
    } catch (err) {
      console.log(err)
      res.status(400).send('订单操作失败，请重试！')
    }
  }
)

// $route POST api/order/pax
// @desc 更新未結訂單人數（茶位自動同步）
// @access private
router.post(
  '/pax',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const _id = req.body._id
      const pax = Number(req.body.pax)
      if (!_id) {
        res.status(400).send('缺少訂單編號')
        return
      }
      await Order.updateOne({ _id }, { $set: { pax } }).exec()
      if (io) io.emit('tableUpdate')
      res.send('人數已更新')
    } catch (err) {
      console.log(err)
      res.status(400).send('人數更新失敗，請重試！')
    }
  }
)

// $route POST api/order/changePayment
// @desc 更改已結帳單的付款方式（只重新列示付款，不改品項）
// @access private
router.post(
  '/changePayment',
  passport.authenticate('jwt', { session: false }),
  requireLevel(3),
  async (req, res) => {
    try {
      const order = await Order.findById(req.body._id).exec()
      if (!order || order.state !== 1) {
        res.status(400).send('訂單不存在或尚未結帳！')
        return
      }
      order.payMethod = req.body.payMethod || ''
      await order.save()
      logAction(req, 'changePayment', '更改付款方式', {
        deskNo: order.deskNo || '',
        orderNo: order.orderNo || '',
        payMethod: order.payMethod || '',
        amount: order.totalPrice || 0
      })
      res.send('付款方式已更改！')
    } catch (err) {
      console.log(err)
      res.status(400).send('更改付款失敗，請重試！')
    }
  }
)

// $route POST api/order/callDish
// @desc 叫起：標記訂單中指定品項為「已叫起」狀態
// @access private
router.post(
  '/callDish',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const { deskNo, indexes } = req.body
      if (!deskNo || !Array.isArray(indexes) || !indexes.length) {
        return res.status(400).send('請選擇要叫起的品項！')
      }
      const order = await Order.findOne(Object.assign({ state: 0 }, deskNoQuery(deskNo))).exec()
      if (!order) return res.status(400).send('該枱沒有未結訂單！')
      const items = order.order || []
      let count = 0
      indexes.forEach(idx => {
        if (idx >= 0 && idx < items.length) {
          const it = items[idx]
          it.dishStatus = 'called'
          count++
          if (it.contents && it.contents.length) {
            it.contents.forEach(c => {
              if (c.dishStatus !== 'served') c.dishStatus = 'called'
            })
          }
        }
      })
      order.order = items
      order.markModified('order')
      await order.save()
      if (io) io.emit('tableUpdate')
      res.send('已叫起 ' + count + ' 道菜！')
    } catch (err) {
      console.log(err)
      res.status(400).send('叫起失敗，請重試！')
    }
  }
)

// $route POST api/order/serveDish
// @desc 起菜：標記訂單中指定品項為「已起菜」狀態
// @access private
router.post(
  '/serveDish',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      // 支援多訂單格式 { orders: [{ orderNo, deskNo, indexes, contents }] }，
      // 並向下相容舊格式 { deskNo, indexes, contents }
      let orderEntries
      const rawOrders = Array.isArray(req.body.orders) ? req.body.orders : null
      if (rawOrders && rawOrders.length) {
        orderEntries = rawOrders
          .map(o => ({
            orderNo: String(o.orderNo || ''),
            deskNo: o.deskNo,
            indexes: Array.isArray(o.indexes) ? o.indexes : [],
            contents: Array.isArray(o.contents) ? o.contents : []
          }))
          .filter(o => o.indexes.length || o.contents.length)
      } else {
        orderEntries = [{
          orderNo: '',
          deskNo: req.body.deskNo,
          indexes: Array.isArray(req.body.indexes) ? req.body.indexes : [],
          contents: Array.isArray(req.body.contents) ? req.body.contents : []
        }]
      }
      if (!orderEntries.length) {
        return res.status(400).send('請選擇要起菜的品項！')
      }

      const serveItems = []
      let count = 0
      let firstOrder = null

      for (const entry of orderEntries) {
        const query = entry.orderNo
          ? { orderNo: entry.orderNo, state: 0 }
          : Object.assign({ state: 0 }, deskNoQuery(entry.deskNo))
        const order = await Order.findOne(query).exec()
        if (!order) continue
        if (!firstOrder) firstOrder = order
        // 送單（起菜）前防禦性校正撞餐跟餐價
        await normalizeAndPersistBundlePricing(order)
        const items = order.order || []
        // 1) 一般品項（非套餐，或整份套餐）逐項起菜
        entry.indexes.forEach(idx => {
          if (idx >= 0 && idx < items.length && items[idx].dishStatus === 'called') {
            items[idx].dishStatus = 'served'
            count++
            serveItems.push(items[idx])
          }
        })
        // 2) 套餐內容品項逐項起菜（front-end 展開套餐 contents）
        const touchedCombos = {}
        entry.contents.forEach(({ idx, ci }) => {
          const item = items[idx]
          if (!item || !Array.isArray(item.contents) || !item.contents[ci]) return
          const c = item.contents[ci]
          if (c.dishStatus === 'served') return
          c.dishStatus = 'served'
          count++
          serveItems.push(Object.assign({}, c, { _comboName: item.name, _comboCount: item.count || 1 }))
          touchedCombos[idx] = true
        })
        // 套餐內容全部起菜後，標記整份套餐為已起菜
        Object.keys(touchedCombos).forEach(idx => {
          const item = items[idx]
          if (item && (item.contents || []).every(c => c.dishStatus === 'served')) {
            item.dishStatus = 'served'
          }
        })
        order.order = items
        order.markModified('order')
        await order.save()
      }

      if (!count) return res.status(400).send('沒有可起菜的品項！')

      // 起菜後列印到後廚（只列印起菜的品項）
      try {
        const printerSetting = await Printer.findOne().exec()
        if (printerSetting && serveItems.length && firstOrder) {
          const printOrder = Object.assign({}, firstOrder.toObject(), { order: serveItems, _printLabel: '【起菜】' })
          const tickets = escpos.buildKitchenByStation(printerSetting, printOrder)
          for (const t of tickets) {
            await printQueue.enqueuePrint(printerSetting, t.printer, t.data, printOrder)
            console.log('[Printer] 起菜列印[' + t.station + '] 枱號：' + firstOrder.deskNo)
          }
        }
      } catch (printErr) {
        console.log('[Printer] 起菜列印失敗：' + printErr.message)
      }
      if (io) io.emit('tableUpdate')
      res.send('已起菜 ' + count + ' 道！')
    } catch (err) {
      console.log(err)
      res.status(400).send('起菜失敗，請重試！')
    }
  }
)

// $route POST api/order/shareTable
// @desc 搭枱：在物理枱上建立子枱號（A/B/C/D），各自獨立點餐結帳
// @access private
router.post(
  '/shareTable',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const deskNo = String(req.body.deskNo)
      if (!deskNo) return res.status(400).send('請指定枱號！')
      const physical = await Table.findOne({ no: deskNo })
      if (!physical) return res.status(400).send('找不到該枱！')
      if (physical.shareSuffix) return res.status(400).send('只能在實體枱上搭枱！')
      const existingLinks = await Table.find({ physicalNo: deskNo, no: { $ne: deskNo } })
      const suffixes = ['A', 'B', 'C', 'D']
      const usedSuffixes = existingLinks.map(t => t.shareSuffix).filter(Boolean)
      const nextSuffix = suffixes.find(s => usedSuffixes.indexOf(s) < 0)
      if (!nextSuffix) return res.status(400).send('此枱已滿 4 組搭枱！')
      const newNo = deskNo + nextSuffix
      const exist = await Table.findOne({ no: newNo })
      if (exist) return res.status(400).send('該搭枱號已存在！')
      const newTable = await Table.create({
        no: newNo,
        name: newNo,
        seats: physical.seats,
        zone: physical.zone || '堂食',
        enabled: true,
        physicalNo: deskNo,
        shareSuffix: nextSuffix
      })
      res.json({ success: true, table: newTable, message: '搭枱 ' + nextSuffix + ' 已建立！' })
    } catch (err) {
      console.log(err)
      res.status(400).send('搭枱失敗，請重試！')
    }
  }
)

// $route POST api/order/reprint
// @desc 重印單據：重新打印最新一筆訂單（自動加印「重印」二字）
// @access private
router.post(
  '/reprint',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      // 重印最近一筆結帳（已結）單據；可選傳 _id / orderNo 指定特定訂單
      let order = null
      if (req.body._id) {
        order = await Order.findById(req.body._id).exec()
      } else if (req.body.orderNo) {
        order = await Order.findOne({ orderNo: String(req.body.orderNo) }).exec()
      } else {
        order = await Order.findOne({ state: 1 }).sort({ date: -1 }).exec()
      }
      if (!order) return res.status(400).send('沒有可重印的結帳單據！')
      const printerSetting = await Printer.findOne().exec()
      if (!printerSetting) return res.status(400).send('請先設置打印機！')
      const reprintOrder = Object.assign({}, order.toObject(), { _printLabel: '【重印】' })
      try {
        const receipt = escpos.resolveTicketPrinter(printerSetting, 'reprint')
        if (receipt && receipt.ip) {
          await printQueue.enqueuePrint(printerSetting, receipt, await escpos.buildReceipt(receipt, reprintOrder, { invoiceNo: order.orderNo, payMethod: order.payMethod }), reprintOrder)
        }
      } catch (printErr) {
        console.log('[Printer] 重印收據失敗：' + printErr.message)
      }
      res.send('重印成功！' + (order.orderNo ? '（單號：' + order.orderNo + '）' : ''))
    } catch (err) {
      console.log(err)
      res.status(400).send('重印失敗，請重試！')
    }
  }
)

// $route POST api/order/cancel
// @desc 删除/取消订单信息，返回json数据
// @access private
router.post(
  '/cancel',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const _id = req.body._id
      const order = await Order.findById(_id).exec()
      if (!order) {
        res.status(400).send('訂單不存在！')
        return
      }
      const op = operatorOf(req)
      // 不刪單：標記整單取消（voidStatus=1、state=2 取消終態），供取消報表追溯
      order.voidStatus = 1
      order.voidReason = req.body.reason || ''
      order.voidDate = new Date()
      order.voidBy = op.staffName || op.staffNo || ''
      order.state = 2
      await order.save()
      // 整單取消自動印單：收銀機（收據印表機）固定出單，廚房出單依 PosSetting.cancelAllPrint.kitchen 開關
      try {
        const printerSetting = await Printer.findOne().exec()
        if (printerSetting) {
          const posSetting = await PosSetting.findOne().lean().exec()
          const cancelAllPrint = (posSetting && posSetting.cancelAllPrint) || {}
          const kitchenOn = cancelAllPrint.kitchen !== false
          const ticketOrder = order.toObject()
          const ticketOpts = {
            order: ticketOrder,
            reason: order.voidReason || '',
            waiter: order.voidBy || order.waiter || ''
          }
          const receiptPrinter = escpos.resolveTicketPrinter(printerSetting, 'receipt')
          if (receiptPrinter && escpos.hasTarget(receiptPrinter)) {
            printQueue.enqueuePrint(printerSetting, receiptPrinter, escpos.buildCancelAllTicket(receiptPrinter, ticketOpts), ticketOrder)
              .catch(err => console.log('[cancel] 收銀整單取消小票列印失敗：' + (err && err.message)))
          }
          if (kitchenOn) {
            const kitchenPrinter = escpos.resolveTicketPrinter(printerSetting, 'kitchen') || escpos.resolvePrinter(printerSetting, 'kitchen')
            if (kitchenPrinter && escpos.hasTarget(kitchenPrinter)) {
              printQueue.enqueuePrint(printerSetting, kitchenPrinter, escpos.buildCancelAllTicket(kitchenPrinter, ticketOpts), ticketOrder)
                .catch(err => console.log('[cancel] 廚房整單取消小票列印失敗：' + (err && err.message)))
            }
          }
        }
      } catch (e) {
        console.log('[cancel] 整單取消印單失敗：' + (e && e.message))
      }
      if (io) io.emit('tableUpdate')
      logAction(req, 'cancel', '取消訂單', {
        deskNo: order.deskNo || '',
        orderNo: order.orderNo || '',
        amount: order.totalPrice || 0
      })
      res.send('订单已取消！')
    } catch (err) {
      console.log(err)
      res.status(400).send('订单操作失败，请重试！')
    }
  }
)

// $route POST api/order/print
// @desc 手动打印订单小票（kitchen=后厨小票 / receipt=结账小票）
// @access private
router.post(
  '/print',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const setting = await Printer.findOne().exec()
      if (!setting) {
        res.status(400).send('请先在「打印机设置」里配置打印机！')
        return
      }
      const order = await Order.findById(req.body._id).exec()
      if (!order) {
        res.status(400).send('订单不存在！')
        return
      }
      // 列印前防禦性校正撞餐跟餐價（主檔已調價時，小票顯示最新跟餐價）
      if (await normalizeAndPersistBundlePricing(order)) {
        await order.save()
      }
      // 依 terminalCode 載入本機收銀機設定（本機收據/上菜紙/印單專屬印表機）
      let terminal = null
      if (req.body.terminalCode) {
        try {
          terminal = await require('../../models/PosTerminal').findOne({ code: req.body.terminalCode }).lean().exec()
        } catch (e) {}
      }
      if (req.body.type === 'receipt') {
        // 结账小票 → 本機收據印表機 > 座位分区收银台 > 默认收银台
        const zone = (setting.zones || []).find(z => (z.desks || []).map(String).indexOf(order.deskNo) >= 0)
        let printer = terminal ? escpos.resolveTerminalPrinter(setting, terminal.receipt) : null
        if (!printer && zone) {
          if (zone.cashierIp) printer = Object.assign({}, escpos.resolveTicketPrinter(setting, 'receipt'), { ip: zone.cashierIp, port: zone.cashierPort || 9100 })
        }
        if (!printer) printer = escpos.resolveTicketPrinter(setting, 'receipt')
        await printQueue.enqueuePrint(setting, printer, await escpos.buildReceipt(printer, order, { invoiceNo: req.body.invoiceNo, payMethod: req.body.payMethod }), order)
      } else if (req.body.type === 'serving') {
        // 上菜纸：本機上菜紙印表機 > 全域傳菜印表機（不重複送廚房）
        let printer = terminal ? escpos.resolveTerminalPrinter(setting, terminal.serving) : null
        if (!printer) printer = escpos.resolveTicketPrinter(setting, 'serving')
        await printQueue.enqueuePrint(setting, printer, await escpos.buildServingOrder(printer, order, Number(req.body.newCount) || 0), order)
      } else if (req.body.type === 'print') {
        // 印单小票：中央埋單 > 本機印單印表機 > 全域印單印表機
        // 計算重印次數與重印員工（首次印單不算重印；已印單後再次印單即為重印）
        const isReprint = !!order.printed
        order.reprintCount = isReprint ? (Number(order.reprintCount || 0) + 1) : 0
        order.reprintBy = isReprint ? (req.body.printer || '') : ''
        // 印單小票在埋單前列印，order.serviceCharge 尚未計算；依加一設定即時推算（僅供列印顯示，不寫回資料庫）
        if (!Number(order.serviceCharge)) {
          try {
            const posSetting = await PosSetting.findOne().lean().exec()
            if (posSetting && posSetting.serviceChargeEnabled && posSetting.serviceChargeRate) {
              const baseTotal = Number(order.totalPrice) || 0
              order.serviceCharge = Math.round(baseTotal * (Number(posSetting.serviceChargeRate) || 0) / 100 * 100) / 100
              order.totalPrice = Math.round((baseTotal + order.serviceCharge) * 100) / 100
            }
          } catch (e) {}
        }
        let printer = null
        if (req.body.central) printer = escpos.resolveTerminalPrinter(setting, setting.centralPrint)
        if (!printer && terminal) printer = escpos.resolveTerminalPrinter(setting, terminal.print)
        if (!printer) printer = escpos.resolveTicketPrinter(setting, 'print')
        // 印單小票印製次數：依堂食/外賣後台設定套用
        if (printer) {
          try {
            const posSetting = await PosSetting.findOne().lean().exec()
            const isDineIn = order.zone !== '外賣' && order.zone !== '外賣枱'
            const copies = Math.max(1, Number(isDineIn ? (posSetting && posSetting.dineInPrintCopies) : (posSetting && posSetting.takeawayPrintCopies)) || 1)
            printer = Object.assign({}, printer, { copies })
          } catch (e) {}
        }
        await printQueue.enqueuePrint(setting, printer, await escpos.buildPrintOrder(printer, order), order)
      } else if (req.body.type === 'qrcode') {
        // 二维码小票 → 本機印單印表機 > 全域二維碼印表機
        let printer = terminal ? escpos.resolveTerminalPrinter(setting, terminal.print) : null
        if (!printer) printer = escpos.resolveTicketPrinter(setting, 'qrcode')
        await printQueue.enqueuePrint(setting, printer, await escpos.buildQrcodeOrder(printer, order), order)
      } else {
        // 后厨小票 → 指定目标打印机（或按档口路由）
        const kitchenTarget = escpos.resolveTicketPrinter(setting, 'kitchen')
        if (kitchenTarget) {
          await printQueue.enqueuePrint(setting, kitchenTarget, escpos.buildKitchenOrder(kitchenTarget, order, kitchenTarget.name), order)
        } else {
          const tickets = escpos.buildKitchenByStation(setting, order)
          for (const t of tickets) {
            await printQueue.enqueuePrint(setting, t.printer, t.data, order)
          }
        }
      }
      // 只有「印單」才標記已印單（上菜紙/後廚/結賬/二維碼不改變枱況顏色）
      const updateFields = { printed: req.body.type === 'print', printer: req.body.printer || '' }
      if (req.body.type === 'print') {
        updateFields.reprintCount = Number(order.reprintCount || 0)
        updateFields.reprintBy = order.reprintBy || ''
      }
      await Order.updateOne({ _id: order._id }, { $set: updateFields }).exec()
      res.send('打印已发送！')
    } catch (err) {
      console.log(err)
      if (req.body.type === 'print') {
        try {
          await Order.updateOne({ _id: req.body._id }, { $set: { printed: true } }).exec()
        } catch (updateErr) {
          console.log(updateErr)
        }
      }
      res.status(400).send('打印失败：' + err.message)
    }
  }
)

// 計算單一品項小計（與點餐端 calcUnit 一致）
function itemSubtotal (item) {
  if (item && item.voidStatus === 1) return 0
  const base = item.free ? 0 : (item.customPrice > 0 ? item.customPrice : (item.price || 0))
  const unit = base * (item.discount || 1)
  return Math.round(unit * (item.count || 1) * 100) / 100
}

// 品項合併鍵：同貨品、同價（含跟餐價/改價）、同贈送/折扣、同檔口、同起菜狀態才可合併
function orderItemMergeKey (it) {
  return [
    String(it._id || ''),
    Number(it.price) || 0,
    it.bundlePrice ? '1' : '0',
    it.bundleMain ? '1' : '0',
    String(it.bundleGroupId || ''),
    Number(it.customPrice) || 0,
    it.free ? '1' : '0',
    Number(it.discount) || 1,
    String(it.dishStatus || '')
  ].join('|')
}

// 加單合併：把新送品項併入既有訂單，同貨品且同價（無改碼、無套餐內容）累加數量為一列，
// 避免多次送單時相同貨品拆成多列（印單/顯示會一列顯示）。
// 只在「既有品項」上累加數量或於尾端追加，既有品項索引不變，repriceItem 等依索引操作不受影響。
function mergeOrderItems (existing, newItems) {
  const out = (existing || []).slice()
  const idxByKey = {}
  out.forEach((it, i) => {
    if (!it || (it.mods && it.mods.length) || (it.contents && it.contents.length)) return
    idxByKey[orderItemMergeKey(it)] = i
  })
  ;(newItems || []).forEach(it => {
    if (!it || (it.mods && it.mods.length) || (it.contents && it.contents.length)) {
      out.push(it)
      return
    }
    const key = orderItemMergeKey(it)
    const idx = idxByKey[key]
    if (idx !== undefined) {
      out[idx].count = (out[idx].count || 0) + (it.count || 1)
    } else {
      idxByKey[key] = out.length
      out.push(it)
    }
  })
  return out
}

// 分單/轉桌/合併/退菜/加單防線：對稱重算撞餐（一配一）
// 跟餐多於主食 → 復原多餘跟餐；主食多於跟餐 → 重新撞餐
async function rebalanceBundlePairs (items) {
  return bundle.rebalanceBundlePairs(items)
}

// 防禦性校正：列印/送單前對已存訂單重算撞餐跟餐價；價錢有變則同步總價並回傳 true（由呼叫方 save）
async function normalizeAndPersistBundlePricing (order) {
  if (!order || !Array.isArray(order.order)) return false
  const hasBundle = order.order.some(it => it && it.bundlePrice)
  if (!hasBundle) return false
  const { items, delta } = await bundle.recomputeBundlePricing(order.order)
  order.order = items
  if (delta !== 0) {
    order.totalPrice = Math.round(((order.totalPrice || 0) + delta) * 100) / 100
  }
  if (order.markModified) order.markModified('order')
  return delta !== 0
}

// $route POST api/order/transfer
// @desc 換桌/轉桌：把來源桌未結訂單搬到目標桌（目標桌已有未結單則合併）
// @access private
router.post(
  '/transfer',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const from = String(req.body.from)
      const to = String(req.body.to)
      const action = req.body.action || 'transfer'
      if (!from || !to || from === to) {
        res.status(400).send('來源桌與目標桌無效！')
        return
      }
      const source = await Order.findOne(Object.assign({ state: 0 }, deskNoQuery(from))).exec()
      if (!source) {
        res.status(400).send(`桌號 ${from} 沒有未結訂單可轉移！`)
        return
      }
      const target = await Order.findOne(Object.assign({ state: 0 }, deskNoQuery(to))).exec()
      if (target) {
        target.order = await rebalanceBundlePairs((target.order || []).concat(source.order || []))
        target.totalPrice = Math.round(target.order.reduce((sum, i) => sum + itemSubtotal(i), 0) * 100) / 100
        target.transferredFrom = from
        target.fromAction = action
        await target.save()
        await Order.deleteOne({ _id: source._id }).exec()
      } else {
        source.deskNo = to
        source.transferredFrom = from
        source.fromAction = action
        // 轉枱後解除工作站鎖定：避免目標枱被標記為「使用中」
        if (source.source === 'extension') {
          source.source = 'pos'
          source.terminalCode = ''
        }
        await source.save()
      }
      if (io) io.emit('tableUpdate')
      logAction(req, action === 'merge' ? 'merge' : 'transfer', action === 'merge' ? '合併枱' : '轉桌', {
        deskNo: from + ' → ' + to,
        orderNo: source.orderNo || '',
        amount: source.totalPrice || 0
      })
      res.send(`已將桌號 ${from} 轉移到桌號 ${to}！`)
    } catch (err) {
      console.log(err)
      res.status(400).send('轉桌失敗，請重試！')
    }
  }
)

// $route POST api/order/split
// @desc 分單：把來源桌未結訂單的部分品項搬到目標桌（目標桌已有未結單則合併）
// @access private
router.post(
  '/split',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const from = String(req.body.from)
      const to = String(req.body.to)
      const indexes = (req.body.indexes || []).map(Number)
      if (!from || !to || from === to) {
        res.status(400).send('來源桌與目標桌無效！')
        return
      }
      const source = await Order.findOne(Object.assign({ state: 0 }, deskNoQuery(from))).exec()
      if (!source) {
        res.status(400).send(`桌號 ${from} 沒有未結訂單可分單！`)
        return
      }
      const items = source.order || []

      // 解析搬移內容：支援 moves [{ i, count }]（部分數量）與舊 indexes [i]
      let moves = []
      if (Array.isArray(req.body.moves) && req.body.moves.length) {
        moves = req.body.moves.map(m => ({ i: Number(m.i), count: Number(m.count) || 0 }))
      } else if (Array.isArray(indexes)) {
        moves = indexes.map(i => ({ i: Number(i), count: 0 }))
      }

      // 合併同 index 的搬移數量，並 clamp 到可用數量
      const movedCount = {}
      moves.forEach(m => {
        if (m.i < 0 || m.i >= items.length) return
        const total = items[m.i] ? (items[m.i].count || 1) : 0
        const want = m.count > 0 ? m.count : total
        movedCount[m.i] = Math.min((movedCount[m.i] || 0) + want, total)
      })

      const remaining = []
      const toMove = []
      items.forEach((it, i) => {
        const total = it.count || 1
        const moved = movedCount[i] || 0
        const left = total - moved
        if (moved > 0) {
          toMove.push(Object.assign({}, it, { count: moved }))
        }
        if (left > 0) {
          remaining.push(Object.assign({}, it, { count: left }))
        }
      })

      if (!toMove.length) {
        res.status(400).send('沒有可分出的品項！')
        return
      }
      // 撞餐一配一防線：跟餐脫離主食時復原為原價
      await rebalanceBundlePairs(remaining)
      await rebalanceBundlePairs(toMove)
      const movedTotal = Math.round(toMove.reduce((s, it) => s + itemSubtotal(it), 0) * 100) / 100
      source.order = remaining
      source.totalPrice = Math.round(remaining.reduce((s, it) => s + itemSubtotal(it), 0) * 100) / 100
      await source.save()
      const target = await Order.findOne(Object.assign({ state: 0 }, deskNoQuery(to))).exec()
      if (target) {
        target.order = await rebalanceBundlePairs((target.order || []).concat(toMove))
        target.totalPrice = Math.round(target.order.reduce((s, it) => s + itemSubtotal(it), 0) * 100) / 100
        target.transferredFrom = from
        target.fromAction = 'split'
        await target.save()
      } else {
        await Order.create({
          orderNo: moment(Date.now()).format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 8999 + 1000),
          deskNo: to,
          order: toMove,
          totalPrice: movedTotal,
          zone: source.zone || '堂食',
          state: 0,
          transferredFrom: from,
          fromAction: 'split'
        })
      }
      if (io) io.emit('tableUpdate')
      logAction(req, 'split', '分單', {
        deskNo: from + ' → ' + to,
        orderNo: source.orderNo || '',
        amount: movedTotal
      })
      res.send(`已分單到桌號 ${to}！`)
    } catch (err) {
      console.log(err)
      res.status(400).send('分單失敗，請重試！')
    }
  }
)

// $route POST api/order/setDeptSplit
// @desc 部門分帳：手動把某品項（套餐）的金額拆到各部門（支援未結與已結帳單）
// @access private
router.post(
  '/setDeptSplit',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const orderNo = String(req.body.orderNo || '')
      const itemIndex = Number(req.body.itemIndex)
      const departmentSplit = Array.isArray(req.body.departmentSplit) ? req.body.departmentSplit : []
      if (!orderNo || isNaN(itemIndex) || itemIndex < 0) {
        res.status(400).send('參數錯誤：缺少單號或品項索引！')
        return
      }
      const order = await Order.findOne({ orderNo }).exec()
      if (!order) {
        res.status(400).send('找不到該單據！')
        return
      }
      if (order.state === 1 && staffLevel(req) < 3) {
        res.status(403).json({ msg: '權限不足：修改已結賬單需要經理以上權限' })
        return
      }
      const item = (order.order || [])[itemIndex]
      if (!item || !item.comboId) {
        res.status(400).send('該品項不是套餐，無法分帳！')
        return
      }
      const cleaned = departmentSplit
        .filter(d => d && d.department && String(d.department).trim() !== '')
        .map(d => ({ department: String(d.department).trim(), amount: Math.round((Number(d.amount) || 0) * 100) / 100 }))
      if (!cleaned.length) {
        res.status(400).send('請至少填寫一個部門！')
        return
      }
      const total = Math.round(cleaned.reduce((s, d) => s + d.amount, 0) * 100) / 100
      const expect = itemSubtotal(item)
      if (Math.abs(total - expect) > 0.01) {
        res.status(400).send(`分帳金額合計 $${total.toFixed(2)} 不等於該套餐小計 $${expect.toFixed(2)}！`)
        return
      }
      order.order[itemIndex].departmentSplit = cleaned
      order.markModified('order')
      await order.save()
      if (io) io.emit('tableUpdate')
      logAction(req, 'deptSplit', '部門分帳', {
        deskNo: order.deskNo || '',
        orderNo: order.orderNo || '',
        item: item.name || '',
        amount: total,
        department: cleaned.map(d => d.department + ' $' + d.amount.toFixed(2)).join('、')
      })
      res.send('部門分帳已儲存！')
    } catch (err) {
      console.log(err)
      res.status(400).send('部門分帳失敗，請重試！')
    }
  }
)

// $route POST api/order/copyOrder
// @desc 複印單據：把來源桌未結訂單的品項複製到目標桌（目標桌已有未結單則合併）
// @access private
router.post(
  '/copyOrder',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const from = String(req.body.from)
      const to = String(req.body.to)
      if (!from || !to || from === to) {
        res.status(400).send('來源桌與目標桌無效！')
        return
      }
      const source = await Order.findOne(Object.assign({ state: 0 }, deskNoQuery(from))).exec()
      if (!source) {
        res.status(400).send(`桌號 ${from} 沒有未結訂單可複印！`)
        return
      }
      const copied = (source.order || []).map(it => {
        const c = JSON.parse(JSON.stringify(it))
        delete c._id
        delete c._idx
        c.sent = false
        c.dishStatus = ''
        return c
      })
      if (!copied.length) {
        res.status(400).send('來源桌沒有可複印的品項！')
        return
      }
      const copiedTotal = Math.round(copied.reduce((s, it) => s + itemSubtotal(it), 0) * 100) / 100
      const target = await Order.findOne(Object.assign({ state: 0 }, deskNoQuery(to))).exec()
      if (target) {
        target.order = (target.order || []).concat(copied)
        target.totalPrice = Math.round(((target.totalPrice || 0) + copiedTotal) * 100) / 100
        await target.save()
      } else {
        await Order.create({
          orderNo: moment(Date.now()).format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 8999 + 1000),
          deskNo: to,
          order: copied,
          totalPrice: copiedTotal,
          zone: source.zone || '堂食',
          state: 0
        })
      }
      if (io) io.emit('tableUpdate')
      logAction(req, 'copyOrder', '複印單據', {
        deskNo: from + ' → ' + to,
        orderNo: source.orderNo || '',
        amount: copiedTotal
      })
      res.send(`已複印桌號 ${from} 的品項到桌號 ${to}！`)
    } catch (err) {
      console.log(err)
      res.status(400).send('複印單據失敗，請重試！')
    }
  }
)

// $route POST api/order/chase
// @desc 追單：選擇指定品項列印追單到後廚
// @access private
router.post(
  '/chase',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const deskNo = String(req.body.deskNo)
      const indexes = req.body.indexes
      if (!deskNo) {
        res.status(400).send('枱號無效！')
        return
      }
      const order = await Order.findOne(Object.assign({ state: 0 }, deskNoQuery(deskNo))).exec()
      if (!order) {
        res.status(400).send(`枱號 ${deskNo} 沒有未結訂單！`)
        return
      }
      const items = order.order || []
      let chaseItems = items
      if (Array.isArray(indexes) && indexes.length) {
        chaseItems = indexes.filter(i => i >= 0 && i < items.length).map(i => items[i])
      }
      if (!chaseItems.length) {
        res.status(400).send('沒有可追單的品項！')
        return
      }
      order.chasedAt = new Date()
      await order.save()
      // 列印追單到後廚
      try {
        const printerSetting = await Printer.findOne().exec()
        if (printerSetting) {
          const chaseOrder = Object.assign({}, order.toObject(), { order: chaseItems })
          const tickets = escpos.buildChaseByStation(printerSetting, chaseOrder)
          for (const t of tickets) {
            await printQueue.enqueuePrint(printerSetting, t.printer, t.data, chaseOrder)
            console.log('[Printer] 追單列印[' + t.station + '] 枱號：' + deskNo)
          }
        }
      } catch (printErr) {
        console.log('[Printer] 追單列印失敗：' + printErr.message)
      }
      if (io) io.emit('tableUpdate')
      res.send('追單成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('追單失敗，請重試！')
    }
  }
)

// $route POST api/order/voidItem
// @desc 退菜：從未結訂單移除一個品項並重算總價
// @access private
router.post(
  '/voidItem',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const order = await Order.findById(req.body._id).exec()
      if (!order || order.state !== 0) {
        res.status(400).send('訂單不存在或已結帳！')
        return
      }
      const idx = Number(req.body.index)
      const items = order.order || []
      if (idx < 0 || idx >= items.length) {
        res.status(400).send('品項索引無效！')
        return
      }
      const itemName = items[idx].name || ''
      const beforeCount = Number(items[idx].count) || 1
      const qty = Math.floor(Number(req.body.qty) || 0)
      const canceledQty = qty > 0 ? qty : beforeCount
      const op = operatorOf(req)
      const reason = req.body.reason || ''
      const voidFields = {
        voidStatus: 1,
        voidQty: canceledQty,
        voidReason: reason,
        voidDate: new Date(),
        voidBy: op.staffName || op.staffNo || ''
      }
      if (qty > 0 && qty < beforeCount) {
        // 部分退菜：原品項扣減數量，另追加一筆退菜記錄
        items[idx].count = beforeCount - qty
        items.push(Object.assign({}, items[idx], voidFields, { count: canceledQty }))
      } else {
        // 全退：原位標記退菜（不刪除，供取消報表追溯）
        Object.assign(items[idx], voidFields)
      }
      order.order = await rebalanceBundlePairs(items)
      order.markModified('order')
      order.totalPrice = Math.round(items.reduce((sum, i) => sum + itemSubtotal(i), 0) * 100) / 100
      await order.save()
      logAction(req, 'voidItem', '退菜', {
        deskNo: order.deskNo || '',
        orderNo: order.orderNo || '',
        itemName,
        canceledQty,
        reason
      })
      if (io) io.emit('tableUpdate')
      res.send('退菜成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('退菜失敗，請重試！')
    }
  }
)

// $route POST api/order/repriceItem
// @desc 跟餐價回寫：把已送單的跟餐品項改成跟餐價並重算總價（撞餐規則：主食後加時飲品改跟餐價）
// @access private
router.post(
  '/repriceItem',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const order = await Order.findById(req.body._id).exec()
      if (!order || order.state !== 0) {
        res.status(400).send('訂單不存在或已結帳！')
        return
      }
      const idx = Number(req.body.index)
      const items = order.order || []
      if (idx < 0 || idx >= items.length) {
        res.status(400).send('品項索引無效！')
        return
      }
      const newPrice = Number(req.body.price)
      if (isNaN(newPrice) || newPrice < 0) {
        res.status(400).send('跟餐價無效！')
        return
      }
      const itemName = items[idx].name || ''
      // 保留跟餐原價（若前端未帶，則以目前價為原價），供分單一配一復原
      if (!(Number(items[idx].bundleOrigPrice) > 0)) {
        items[idx].bundleOrigPrice = Number(items[idx].price) || 0
      }
      items[idx].price = Math.round(newPrice * 100) / 100
      items[idx].customPrice = 0
      items[idx].bundlePrice = true
      order.order = items
      order.markModified('order')
      order.totalPrice = Math.round(items.reduce((sum, i) => sum + itemSubtotal(i), 0) * 100) / 100
      await order.save()
      logAction(req, 'repriceItem', '跟餐價', {
        deskNo: order.deskNo || '',
        orderNo: order.orderNo || '',
        itemName,
        newPrice
      })
      if (io) io.emit('tableUpdate')
      res.send('跟餐價已更新！')
    } catch (err) {
      console.log(err)
      res.status(400).send('跟餐價更新失敗，請重試！')
    }
  }
)

// $route POST api/order/printCancelItems
// @desc 列印「取消項目小票」（退菜後）：依 PosSetting.cancelItemPrint 決定廚房/工作站出單
// @access private
router.post(
  '/printCancelItems',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const order = await Order.findById(req.body._id).exec()
      if (!order) {
        res.status(400).send('訂單不存在！')
        return
      }
      const items = Array.isArray(req.body.items)
        ? req.body.items.filter(it => it && Number(it.count) > 0).map(it => ({ name: it.name || '', count: Number(it.count) || 0 }))
        : []
      if (!items.length) {
        res.status(400).send('沒有要列印的取消項目！')
        return
      }
      const reason = req.body.reason || ''
      const waiter = req.body.printer || order.waiter || ''
      const setting = await Printer.findOne().exec()
      const posSetting = await PosSetting.findOne().lean().exec()
      const cancelPrint = (posSetting && posSetting.cancelItemPrint) || {}
      const kitchenOn = cancelPrint.kitchen !== false
      const workstationOn = cancelPrint.workstation === true

      const ticketOpts = { order: order.toObject(), items, reason, waiter }

      if (kitchenOn && setting) {
        const kitchenPrinter = escpos.resolveTicketPrinter(setting, 'kitchen') || escpos.resolvePrinter(setting, 'kitchen')
        if (kitchenPrinter && kitchenPrinter.ip) {
          // 退菜不阻塞：取消小票列印改為背景執行，避免打印機離線（8s 逾時+重試）拖慢退菜按鍵
          printQueue.enqueuePrint(setting, kitchenPrinter, escpos.buildCancelItemTicket(kitchenPrinter, ticketOpts), ticketOpts.order)
            .catch(err => console.log('[printCancelItems] 廚房取消小票列印失敗：' + (err && err.message)))
        }
      }
      if (workstationOn && setting) {
        let terminal = null
        if (req.body.terminalCode) {
          try {
            terminal = await require('../../models/PosTerminal').findOne({ code: req.body.terminalCode }).lean().exec()
          } catch (e) {}
        }
        let wsPrinter = terminal ? escpos.resolveTerminalPrinter(setting, terminal.print) : null
        if (!wsPrinter) wsPrinter = escpos.resolveTicketPrinter(setting, 'print')
        if (wsPrinter && wsPrinter.ip) {
          printQueue.enqueuePrint(setting, wsPrinter, escpos.buildCancelItemTicket(wsPrinter, ticketOpts), ticketOpts.order)
            .catch(err => console.log('[printCancelItems] 工作站取消小票列印失敗：' + (err && err.message)))
        }
      }
      if (io) io.emit('tableUpdate')
      res.send('取消項目小票已列印！')
    } catch (err) {
      console.log(err)
      res.status(400).send('列印取消項目失敗：' + (err.message || '請重試'))
    }
  }
)

// $route POST api/order/refund
// @desc 反結賬（Un-settle / Re-open）：沖銷付款、把已結帳訂單退回未結並重新上枱（原枱被佔則轉「原桌號Z」）
//       日結（Z-Report）封鎖後禁止，須改用歷史退貨／紅字沖銷
// @access private
router.post(
  '/refund',
  passport.authenticate('jwt', { session: false }),
  requireLevel(3),
  async (req, res) => {
    try {
      const order = await Order.findById(req.body._id).exec()
      if (!order || order.state !== 1) {
        res.status(400).send('訂單不存在或尚未結帳！')
        return
      }
      // 日結封鎖檢查：訂單所屬營業日已日結（Z-Report）時禁止反結賬
      if (order.businessDayId) {
        const bd = await BusinessDay.findById(order.businessDayId).lean().exec()
        if (bd && bd.status === 'closed') {
          res.status(400).send('該營業日已日結（Z-Report），禁止反結賬，請改用歷史退貨或紅字沖銷！')
          return
        }
      }
      const originalDeskNo = String(order.deskNo)
      // 原桌是否空枱：存在未結訂單（含工作站鎖定空單）即視為佔用
      const occupied = await Order.findOne(Object.assign({ state: 0 }, deskNoQuery(originalDeskNo))).exec()
      let targetDeskNo = originalDeskNo
      let zName = ''
      if (occupied) {
        // 原桌被佔用 → 建立/取用「原桌號Z」虛擬枱
        zName = originalDeskNo + 'Z'
        let zTable = await Table.findOne({ name: zName })
        if (!zTable) {
          const original = await Table.findOne({ no: originalDeskNo })
          const last = await Table.findOne({}, { sort: { no: -1 } })
          const lastNoNum = parseInt(last && last.no) || 0
          const deskNoNum = parseInt(originalDeskNo) || 0
          const newNo = String(lastNoNum ? lastNoNum + 1 : (deskNoNum * 100 + 1))
          zTable = await Table.create({
            no: newNo,
            name: zName,
            seats: (original && original.seats) || 4,
            zone: (original && original.zone) || (order.zone || '堂食'),
            enabled: true
          })
        }
        targetDeskNo = zTable.no
      }
      const op = operatorOf(req)
      order.deskNo = targetDeskNo
      order.state = 0
      order.paymentCancelAt = order.settledAt || null
      order.settledAt = null
      order.relisted = true
      order.source = 'pos'
      order.refundReason = req.body.reason || ''
      order.refundDate = new Date()
      order.unsettledAt = new Date()
      order.unsettledBy = op.staffNo || op.staffName || ''
      order.unsettleCount = (order.unsettleCount || 0) + 1
      await order.save()
      // 非現金付款需人工在支付端發起 Reversal/Void（本系統無支付閘道整合）
      const needManualReversal = order.payMethod && !/現金|cash/i.test(order.payMethod)
      logAction(req, 'unsettle', '反結賬', {
        deskNo: order.deskNo || '',
        orderNo: order.orderNo || '',
        amount: order.totalPrice || 0,
        detail: (order.refundReason || '') + (needManualReversal ? '（請人工沖銷' + order.payMethod + '）' : '')
      })
      if (io) io.emit('tableUpdate')
      const reversalHint = needManualReversal ? '；' + order.payMethod + ' 請於支付端人工發起 Reversal/Void' : ''
      res.send((zName ? ('枱號 ' + originalDeskNo + ' 佔用中，品項已轉到 ' + zName + ' 枱！') : ('反結賬成功，品項已重新上枱到原桌 ' + originalDeskNo + '！')) + reversalHint)
    } catch (err) {
      console.log(err)
      res.status(400).send('反結賬失敗，請重試！')
    }
  }
)

// $route GET api/order/current
// @desc 取得指定桌號的當前未結帳單（QR 用戶查賬用，無需認證）
// @access public
router.get('/current', async (req, res) => {
  try {
    const deskNo = String(req.query.deskNo || '')
    if (!deskNo) {
      return res.json(null)
    }
    const order = await Order.findOne(Object.assign({ state: 0 }, deskNoQuery(deskNo))).exec()
    res.json(order || null)
  } catch (err) {
    console.log(err)
    res.json(null)
  }
})

// $route GET api/order/tableQr/validate
// @desc 驗證枱面點餐碼是否有效（客人掃碼進入時檢查；僅未結帳單有效）
// @access public
router.get('/tableQr/validate', async (req, res) => {
  try {
    const t = String(req.query.t || '').trim()
    if (!t) return res.json({ valid: false })
    const order = await Order.findOne({ qrToken: t, state: 0 }).lean().exec()
    if (!order) return res.json({ valid: false })
    res.json({ valid: true, deskNo: order.deskNo, orderNo: order.orderNo })
  } catch (err) {
    console.log(err)
    res.json({ valid: false })
  }
})

// $route POST api/order/tableQr/print
// @desc 印枱面點餐碼：綁定 token 到該枱未結訂單並列印 QR（重印沿用原 token；只有新訂單才產生新碼，點餐碼隨訂單有效，直至結帳才失效）
// @access private
router.post(
  '/tableQr/print',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const deskNo = String(req.body.deskNo || '').trim()
      if (!deskNo) return res.status(400).send('請先選擇枱號！')

      // 找到（或建立）該枱未結訂單，把 token 綁上去
      let order = await Order.findOne(Object.assign({ state: 0 }, deskNoQuery(deskNo))).exec()
      if (!order) {
        const orderNo = await genTerminalOrderNo(req.body.terminalCode || '', '堂食')
        const businessDayId = await getOrCreateBusinessDayId()
        order = await Order.create({
          orderNo,
          deskNo,
          order: [],
          totalPrice: 0,
          state: 0,
          source: 'pos',
          zone: '堂食',
          terminalCode: req.body.terminalCode || '',
          businessDayId,
          date: new Date()
        })
      }

      // 重印沿用原 token；只有新建立的訂單才產生新碼（點餐碼隨訂單有效，直至結帳才失效）
      if (!order.qrToken) {
        order.qrToken = crypto.randomBytes(16).toString('hex')
        await order.save()
      }
      const token = order.qrToken

      // 組合公開網址（優先 QrSetting.baseUrl，否則回退目前請求的 host）
      let baseUrl = ''
      try {
        const qr = await QrSetting.findOne().lean().exec()
        if (qr && qr.baseUrl) baseUrl = qr.baseUrl
      } catch (e) {}
      if (!baseUrl) baseUrl = req.protocol + '://' + req.get('host')
      const url = baseUrl.replace(/\/+$/, '') + '/index/' + deskNo + '?t=' + token

      // 列印（本機印單印表機 > 全域「點餐碼」小票印表機 > 「二維碼」小票印表機 > 收據印表機）
      const printerSetting = await Printer.findOne().exec()
      let printer = null
      if (printerSetting && req.body.terminalCode) {
        try {
          const terminal = await require('../../models/PosTerminal').findOne({ code: req.body.terminalCode }).lean().exec()
          printer = terminal ? escpos.resolveTerminalPrinter(printerSetting, terminal.print) : null
        } catch (e) {}
      }
      const tableqrTarget = printerSetting && printerSetting.ticketTargets && printerSetting.ticketTargets.tableqr
      if ((!printer || !printer.ip) && tableqrTarget) printer = escpos.resolvePrinter(printerSetting, tableqrTarget)
      if (!printer || !printer.ip) printer = printerSetting ? escpos.resolveTicketPrinter(printerSetting, 'qrcode') : null
      if ((!printer || !printer.ip) && printerSetting) printer = escpos.resolveTicketPrinter(printerSetting, 'receipt')
      if (!printer || !printer.ip) return res.status(400).send('請先設置「點餐碼」、「二維碼」或「收據」打印機！')
      await printQueue.enqueuePrint(printerSetting, printer, await escpos.buildTableQrOrder(printer, order, url), order)

      logAction(req, 'tableQr', '印枱面點餐碼', {
        deskNo: order.deskNo || '',
        orderNo: order.orderNo || '',
        detail: url
      })
      res.json({ url, token, deskNo: order.deskNo, orderNo: order.orderNo })
    } catch (err) {
      console.log(err)
      res.status(400).send('印點餐碼失敗：' + (err.message || '請重試'))
    }
  }
)

// $route GET api/order/settledToday
// @desc 查詢今天已結帳訂單（查看單據-已付款）
// @access private
router.get(
  '/settledToday',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      let cutoff = '03:00'
      const posSetting = await PosSetting.findOne().lean().exec()
      if (posSetting && posSetting.businessDayCutoff) cutoff = posSetting.businessDayCutoff
      const now = moment()
      const [h, m] = cutoff.split(':').map(Number)
      const cutoffMinutes = (h || 0) * 60 + (m || 0)
      const currentMinutes = now.hour() * 60 + now.minute()
      const bizDate = currentMinutes < cutoffMinutes ? now.clone().subtract(1, 'day').format('YYYY-MM-DD') : now.format('YYYY-MM-DD')
      let bd = await BusinessDay.findOne({ date: bizDate }).lean().exec()
      // 當天尚無營業日時，回退到最近一個已存在的營業日
      if (!bd) {
        bd = await BusinessDay.findOne({}).sort({ date: -1 }).lean().exec()
      }
      if (!bd) return res.send([])
      const orders = await Order.find({ state: 1, businessDayId: bd._id }).sort({ date: -1 }).exec()
      res.send(orders)
    } catch (err) {
      res.status(400).send('查询失败')
    }
  }
)

// $route POST api/order/forceUnlock
// @desc 強制解鎖：刪除指定枱號的未結訂單（管理員專用）
// @access private
router.post(
  '/forceUnlock',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const deskNo = String(req.body.deskNo)
      if (!deskNo) {
        res.status(400).send('請指定枱號！')
        return
      }
      const orders = await Order.find(Object.assign({ state: 0 }, deskNoQuery(deskNo))).exec()
      if (!orders.length) {
        res.send('該枱沒有未結訂單，無需解鎖。')
        return
      }
      await Order.deleteMany({ _id: { $in: orders.map(o => o._id) } }).exec()
      if (io) io.emit('tableUpdate')
      res.send(`已強制解鎖枱號 ${deskNo}（已刪除 ${orders.length} 筆未結訂單）`)
    } catch (err) {
      console.log(err)
      res.status(400).send('強制解鎖失敗，請重試！')
    }
  }
)

// $route POST api/order/lockTable
// @desc 鎖定枱號：工作站進入枱號時標記「使用中」（extension），其他工作站顯示使用中並禁止進入
// @access private（QR 下單不受此鎖影響，仍可加單並自動改為 qr 來源）
router.post(
  '/lockTable',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const deskNo = String(req.body.deskNo || '')
      if (!deskNo) return res.status(400).send('請指定枱號！')
      const terminalCode = req.body.terminalCode || ''
      const existing = await Order.findOne(Object.assign({ state: 0 }, deskNoQuery(deskNo))).exec()
      if (existing) {
        // 僅把堂食單標記為使用中；QR / 自助機單保持原來源，不被工作站鎖定
        if (existing.source === 'pos') {
          existing.source = 'extension'
          if (terminalCode) existing.terminalCode = terminalCode
          existing.lockedAt = new Date()
          await existing.save()
        } else if (existing.source === 'extension') {
          // 已有工作站鎖：同工作站續用，或鎖已過期（呆鎖）時由本工作站接管；否則維持原鎖
          const stale = existing.lockedAt && (Date.now() - new Date(existing.lockedAt).getTime() > LOCK_TTL_MS)
          if (stale || String(existing.terminalCode || '') === String(terminalCode || '')) {
            if (terminalCode) existing.terminalCode = terminalCode
            existing.lockedAt = new Date()
            await existing.save()
          }
        }
      } else {
        const orderNo = await genTerminalOrderNo(terminalCode, '堂食')
        const businessDayId = await getOrCreateBusinessDayId()
        await Order.create({
          orderNo,
          deskNo,
          order: [],
          totalPrice: 0,
          state: 0,
          source: 'extension',
          zone: '堂食',
          terminalCode,
          lockedAt: new Date(),
          businessDayId,
          date: new Date()
        })
      }
      if (io) io.emit('tableUpdate')
      res.send('枱號已標記使用中')
    } catch (err) {
      console.log(err)
      res.status(400).send('鎖定枱號失敗！')
    }
  }
)

// $route POST api/order/unlockTable
// @desc 解除枱號鎖定：工作站離開枱號時，空鎖定單刪除；有品項的 extension 單還原為堂食單
// @access private
router.post(
  '/unlockTable',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const deskNo = String(req.body.deskNo || '')
      if (!deskNo) return res.status(400).send('請指定枱號！')
      const orders = await Order.find(Object.assign({ state: 0 }, deskNoQuery(deskNo))).exec()
      for (const o of orders) {
        if (o.source !== 'extension') continue
        if (!o.order || !o.order.length) {
          await Order.deleteOne({ _id: o._id }).exec()
        } else {
          o.source = 'pos'
          o.terminalCode = ''
          o.lockedAt = null
          await o.save()
        }
      }
      if (io) io.emit('tableUpdate')
      res.send('枱號已解除使用中')
    } catch (err) {
      console.log(err)
      res.status(400).send('解除枱號鎖定失敗！')
    }
  }
)

// $route POST api/order/releaseTable
// @desc 解除枱號狀態：把「使用中」（extension 加單）還原為之前的堂食狀態（不刪單）
// @access private
router.post(
  '/releaseTable',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const deskNo = String(req.body.deskNo)
      if (!deskNo) {
        res.status(400).send('請指定枱號！')
        return
      }
      const orders = await Order.find(Object.assign({ state: 0 }, deskNoQuery(deskNo))).exec()
      if (!orders.length) {
        res.send('該枱沒有未結訂單。')
        return
      }
      let released = false
      for (const o of orders) {
        if (o.source === 'extension') {
          o.source = 'pos'
          released = true
        }
      }
      if (!released) {
        res.send('該枱目前不是「使用中」狀態，無需解除。')
        return
      }
      await Promise.all(orders.map(o => o.save()))
      if (io) io.emit('tableUpdate')
      logAction(req, 'releaseTable', '解除枱號狀態', {
        deskNo,
        orderNo: orders.map(o => o.orderNo).join('、'),
        amount: orders.reduce((s, o) => s + (o.totalPrice || 0), 0)
      })
      res.send(`已解除枱號 ${deskNo} 的使用中狀態，還原為之前的枱號狀況`)
    } catch (err) {
      console.log(err)
      res.status(400).send('解除枱號狀態失敗，請重試！')
    }
  }
)

// $route GET api/order/findByNo
// @desc 以單號查詢訂單是否存在（僅回傳必要欄位，供 POS 判斷是否往日單據）
// @access private
router.get(
  '/findByNo',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const orderNo = String(req.query.orderNo || '').trim().replace(/\s+/g, '')
      if (!orderNo) return res.status(400).send('請輸入單號！')
      const order = await Order.findOne({ orderNo }).lean().exec()
      if (!order) return res.json({ found: false })
      res.json({ found: true, orderNo: order.orderNo, date: order.date, deskNo: order.deskNo, state: order.state })
    } catch (err) {
      console.log(err)
      res.status(400).send('查詢失敗，請重試！')
    }
  }
)

// $route GET api/order/lookup
// @desc 修改往日單據：以單號查詢訂單（可選日期篩選）
// @access private（管理員 level 4）
router.get(
  '/lookup',
  passport.authenticate('jwt', { session: false }),
  requireLevel(4),
  async (req, res) => {
    try {
      const orderNo = String(req.query.orderNo || '').trim().replace(/\s+/g, '')
      if (!orderNo) {
        res.status(400).send('請輸入單號！')
        return
      }
      const query = { orderNo }
      if (req.query.date) {
        const d = moment(req.query.date).startOf('day')
        if (d.isValid()) {
          query.date = { $gte: d.toDate(), $lt: d.clone().add(1, 'day').toDate() }
        }
      }
      const order = await Order.findOne(query).lean().exec()
      if (!order) {
        res.status(404).send('找不到該單據！')
        return
      }
      res.json(order)
    } catch (err) {
      console.log(err)
      res.status(400).send('查詢失敗，請重試！')
    }
  }
)

// $route POST api/order/update
// @desc 修改往日單據：更改日期 / 付款方式，並重新綁定營業日
// @access private（管理員 level 4）
router.post(
  '/update',
  passport.authenticate('jwt', { session: false }),
  requireLevel(4),
  async (req, res) => {
    try {
      const orderNo = String(req.body.orderNo || '').trim().replace(/\s+/g, '')
      if (!orderNo) {
        res.status(400).send('請輸入單號！')
        return
      }
      const order = await Order.findOne({ orderNo }).exec()
      if (!order) {
        res.status(404).send('找不到該單據！')
        return
      }

      const update = {}
      const changes = []

      // 更改付款方式
      if (req.body.payMethod !== undefined && req.body.payMethod !== null) {
        const newPay = String(req.body.payMethod).trim()
        if (newPay !== (order.payMethod || '')) {
          changes.push(`付款方式 ${order.payMethod || '（空）'} → ${newPay || '（空）'}`)
          update.payMethod = newPay
        }
      }

      // 更改日期（同時重新綁定營業日）
      if (req.body.date !== undefined && req.body.date !== null && String(req.body.date).trim() !== '') {
        const dateStr = String(req.body.date).trim()
        let newDate = moment(dateStr)
        if (!newDate.isValid()) {
          res.status(400).send('日期格式不正確！')
          return
        }
        // 只給日期（YYYY-MM-DD）時，保留原單時間；給完整日期時間則直接採用
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const orig = moment(order.date)
          if (orig.isValid()) newDate = newDate.hour(orig.hour()).minute(orig.minute()).second(orig.second())
        }
        const orig = moment(order.date)
        changes.push(`日期 ${orig.isValid() ? orig.format('YYYY-MM-DD HH:mm') : ''} → ${newDate.format('YYYY-MM-DD HH:mm')}`)
        update.date = newDate.toDate()
        const bizDate = newDate.format('YYYY-MM-DD')
        const bd = await BusinessDay.findOneAndUpdate(
          { date: bizDate },
          { $setOnInsert: { date: bizDate, startingCash: 0, status: 'open', openedBy: '系統自動' } },
          { upsert: true, new: true }
        ).exec()
        update.businessDayId = bd._id
      }

      if (!Object.keys(update).length) {
        res.send('沒有變更需要儲存。')
        return
      }

      await Order.updateOne({ _id: order._id }, { $set: update }).exec()
      logAction(req, 'modifyOrder', '修改往日單據', {
        orderNo: order.orderNo || '',
        deskNo: order.deskNo || '',
        amount: order.totalPrice || 0,
        changes: changes.join('；')
      })
      res.send('單據修改成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('修改失敗，請重試！')
    }
  }
)

module.exports = router
