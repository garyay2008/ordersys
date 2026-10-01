const express = require('express')
const router = express.Router()
const passport = require('passport')
const moment = require('moment')
const Hold = require('../../models/Hold')
const Order = require('../../models/Order')
const socketio = require('../../plugins/SocketIO')

function operatorOf (req) {
  const u = req.user
  if (!u) return { staffNo: '', staffName: '' }
  if (u.no !== undefined) return { staffNo: u.no || '', staffName: u.name || '' }
  return { staffNo: u.account || u.username || '', staffName: u.name || '' }
}

function emitHoldChanged () {
  try {
    const io = socketio.getIO()
    if (io) io.emit('holdChanged')
  } catch (e) { /* ignore */ }
}

function deskNoQuery (deskNo) {
  const s = String(deskNo)
  if (/^\d+$/.test(s)) return { deskNo: { $in: [s, Number(s)] } }
  return { deskNo: s }
}

function buildLabel (zone, deskNo) {
  const t = moment().format('HH:mm')
  if (zone === '堂食' && deskNo) return `枱 ${deskNo} ${t}`
  return `${zone} ${t}`
}

// $route GET api/hold/holds
// @desc 取得所有掛單（多工作站共用）
// @access private
router.get(
  '/holds',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const list = await Hold.find({}).sort({ createdAt: 1 }).lean().exec()
      res.json(list)
    } catch (err) {
      console.log(err)
      res.status(400).send('取得掛單失敗！')
    }
  }
)

// $route POST api/hold/hold
// @desc 掛單：把未下單品項暫存到後端
// @access private
router.post(
  '/hold',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const zone = req.body.zone || '堂食'
      const deskNo = zone === '堂食' ? String(req.body.deskNo || '') : ''
      const items = Array.isArray(req.body.items) ? req.body.items : []
      if (!items.length) return res.status(400).send('沒有品項可掛單！')
      const op = operatorOf(req)
      const hold = await Hold.create({
        label: buildLabel(zone, deskNo),
        zone,
        deskNo,
        items,
        remark: req.body.remark || '',
        terminalCode: req.body.terminalCode || '',
        staffNo: op.staffNo,
        staffName: op.staffName
      })
      emitHoldChanged()
      res.json({ success: true, hold })
    } catch (err) {
      console.log(err)
      res.status(400).send('掛單失敗，請重試！')
    }
  }
)

// $route POST api/hold/recall
// @desc 叫回掛單：原子取得並刪除，避免多工作站重複叫回；堂食會檢查枱號是否被其他分機佔用
// @access private
router.post(
  '/recall',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const id = req.body.id
      if (!id) return res.status(400).send('請指定掛單！')
      const hold = await Hold.findById(id).lean().exec()
      if (!hold) return res.status(400).send('掛單不存在或已被叫回！')

      // 堂食掛單：若目標枱已被其他分機鎖定（extension），禁止叫回
      if (hold.deskNo) {
        const lock = await Order.findOne(Object.assign({ state: 0, source: 'extension' }, deskNoQuery(hold.deskNo))).lean().exec()
        if (lock && String(lock.terminalCode || '') !== String(req.body.terminalCode || '')) {
          const terminal = lock.terminalCode || ''
          const msg = terminal ? `此枱由分機 ${terminal} 使用中，無法叫回掛單` : '此枱由其他分機使用中，無法叫回掛單'
          return res.status(400).send(msg)
        }
      }

      // 原子刪除，先取先得；被其他工作站搶先時回傳 null
      const claimed = await Hold.findOneAndDelete({ _id: id }).exec()
      if (!claimed) return res.status(400).send('掛單已被其他工作站叫回！')
      emitHoldChanged()
      res.json({ success: true, hold: claimed })
    } catch (err) {
      console.log(err)
      res.status(400).send('叫回失敗，請重試！')
    }
  }
)

// $route POST api/hold/delete
// @desc 刪除掛單
// @access private
router.post(
  '/delete',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const id = req.body.id
      if (!id) return res.status(400).send('請指定掛單！')
      const deleted = await Hold.findByIdAndDelete(id).exec()
      if (!deleted) return res.status(400).send('掛單不存在！')
      emitHoldChanged()
      res.json({ success: true })
    } catch (err) {
      console.log(err)
      res.status(400).send('刪除掛單失敗！')
    }
  }
)

module.exports = router
