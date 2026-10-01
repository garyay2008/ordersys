const express = require('express')
const router = express.Router()
const passport = require('passport')
const moment = require('moment')
const QueueSetting = require('../../models/QueueSetting')
const QueueTicket = require('../../models/QueueTicket')
const socketio = require('../../plugins/SocketIO')

const pad = (n, w = 3) => String(n || 0).padStart(w, '0')

function today () {
  return moment().format('YYYY-MM-DD')
}

function emitQueueChanged (extra) {
  try {
    const io = socketio.getIO()
    if (io) io.emit('queueChanged', Object.assign({}, extra))
  } catch (e) { /* ignore */ }
}

// 取得設定（無則回預設，不落庫）
async function getSetting () {
  const s = await QueueSetting.findOne().lean().exec()
  return s || QueueSetting.getDefault()
}

// 取得某分類的狀態（目前叫號、下一組、等候數、等候清單）
async function buildState () {
  const setting = await getSetting()
  const date = today()
  const cats = setting.categories || []
  const tickets = await QueueTicket.find({ date }).sort({ createdAt: 1 }).lean().exec()
  const categories = cats.map(c => {
    const list = tickets.filter(t => t.category === c.prefix)
    const waiting = list.filter(t => t.status === 'waiting')
    const called = list.filter(t => t.status === 'called').sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt))
    const current = called[0] || null
    const next = waiting[0] || null
    return {
      prefix: c.prefix,
      label: c.label,
      color: c.color,
      current,
      next,
      waitingCount: waiting.length,
      waitingList: waiting.slice(0, 8)
    }
  })
  // 全場最近叫號（用於大屏橫幅）
  const allCalled = tickets.filter(t => t.status === 'called').sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt))
  return {
    date,
    title: setting.title,
    subtitle: setting.subtitle,
    voiceEnabled: setting.voiceEnabled,
    categories,
    lastCalled: allCalled[0] || null,
    totalWaiting: tickets.filter(t => t.status === 'waiting').length
  }
}

// $route GET api/queue/setting
// @desc 取得叫號設定（公開）
router.get('/setting', async (req, res) => {
  try {
    res.json(await getSetting())
  } catch (err) {
    console.log(err)
    res.status(400).send('取得叫號設定失敗！')
  }
})

// $route POST api/queue/setting
// @desc 儲存叫號設定（後台）
router.post(
  '/setting',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const data = req.body || {}
      const count = await QueueSetting.countDocuments().exec()
      const doc = {
        enabled: data.enabled !== false,
        voiceEnabled: data.voiceEnabled !== false,
        title: data.title || '排隊叫號',
        subtitle: data.subtitle || '請取票後在候餐區等候',
        categories: Array.isArray(data.categories) && data.categories.length ? data.categories : QueueSetting.getDefault().categories,
        updatedAt: new Date()
      }
      if (count === 0) await QueueSetting.create(doc)
      else await QueueSetting.findOneAndUpdate({}, { $set: doc }).exec()
      emitQueueChanged()
      res.send('叫號設定已儲存！')
    } catch (err) {
      console.log(err)
      res.status(400).send('儲存失敗，請重試！')
    }
  }
)

// $route GET api/queue/state
// @desc 取得即時叫號狀態（公開，供顯示屏）
router.get('/state', async (req, res) => {
  try {
    res.json(await buildState())
  } catch (err) {
    console.log(err)
    res.status(400).send('取得叫號狀態失敗！')
  }
})

// $route POST api/queue/take
// @desc 取票（公開，自助取票機 / 前台代出票）
router.post('/take', async (req, res) => {
  try {
    const setting = await getSetting()
    const cats = setting.categories || []
    let cat = cats.find(c => c.prefix === (req.body.category || ''))
    if (!cat && req.body.pax) {
      const pax = Number(req.body.pax) || 1
      cat = cats.find(c => pax >= c.minPax && pax <= c.maxPax)
    }
    if (!cat) return res.status(400).send('請選擇有效的取票分類')
    const date = today()
    const last = await QueueTicket.findOne({ date, category: cat.prefix }).sort({ number: -1 }).lean().exec()
    const number = (last ? last.number : 0) + 1
    const ticketNo = cat.prefix + pad(number)
    const pax = Number(req.body.pax) || cat.minPax || 1
    const ticket = await QueueTicket.create({ date, category: cat.prefix, number, ticketNo, pax, status: 'waiting' })
    emitQueueChanged()
    res.json({ success: true, ticketNo, category: cat.prefix, label: cat.label, pax })
  } catch (err) {
    console.log(err)
    res.status(400).send('取票失敗，請重試！')
  }
})

// $route POST api/queue/callNext
// @desc 叫下一號（後台）
router.post(
  '/callNext',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const date = today()
      const category = req.body.category
      if (!category) return res.status(400).send('請指定分類')
      const next = await QueueTicket.findOne({ date, category, status: 'waiting' }).sort({ createdAt: 1 }).exec()
      if (!next) return res.status(400).send('該分類已無等候票')
      next.status = 'called'
      next.calledAt = new Date()
      await next.save()
      emitQueueChanged({ lastCalled: { ticketNo: next.ticketNo, category: next.category } })
      res.json({ success: true, ticketNo: next.ticketNo, category: next.category })
    } catch (err) {
      console.log(err)
      res.status(400).send('叫號失敗，請重試！')
    }
  }
)

// $route POST api/queue/recall
// @desc 重叫（重新廣播目前叫號，後台）
router.post(
  '/recall',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const date = today()
      const category = req.body.category
      const filter = { date, status: 'called' }
      if (category) filter.category = category
      const current = await QueueTicket.findOne(filter).sort({ calledAt: -1 }).exec()
      if (!current) return res.status(400).send('目前沒有已叫號的票')
      emitQueueChanged({ recall: true, lastCalled: { ticketNo: current.ticketNo, category: current.category } })
      res.json({ success: true, ticketNo: current.ticketNo, category: current.category })
    } catch (err) {
      console.log(err)
      res.status(400).send('重叫失敗，請重試！')
    }
  }
)

// $route POST api/queue/updateStatus
// @desc 更新票狀態：seated/skipped/cancelled（後台）
router.post(
  '/updateStatus',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const { ticketNo, status } = req.body
      if (!ticketNo || ['seated', 'skipped', 'cancelled'].indexOf(status) < 0) {
        return res.status(400).send('參數錯誤')
      }
      const date = today()
      const ticket = await QueueTicket.findOne({ date, ticketNo }).exec()
      if (!ticket) return res.status(400).send('找不到該票號')
      ticket.status = status
      if (status === 'seated') ticket.seatedAt = new Date()
      await ticket.save()
      emitQueueChanged()
      res.json({ success: true, ticketNo, status })
    } catch (err) {
      console.log(err)
      res.status(400).send('更新失敗，請重試！')
    }
  }
)

// $route GET api/queue/history
// @desc 今日叫號紀錄（後台）
router.get(
  '/history',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const date = today()
      const list = await QueueTicket.find({ date }).sort({ createdAt: 1 }).lean().exec()
      res.json({ total: list.length, list })
    } catch (err) {
      console.log(err)
      res.status(400).send('查詢失敗！')
    }
  }
)

module.exports = router
