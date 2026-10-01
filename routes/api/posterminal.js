const express = require('express')
const router = express.Router()
const passport = require('passport')
const PosTerminal = require('../../models/PosTerminal')

// $route GET /api/posterminal/all
// @desc 取得所有收銀機 / 工作站
// @access public
router.get('/all', (req, res) => {
  PosTerminal.find().sort({ code: 1 })
    .then(result => res.json(result))
    .catch(err => {
      console.log(err)
      res.status(400).send('獲取收銀機列表失敗！')
    })
})

// $route GET /api/posterminal/enabled
// @desc 取得啟用中的收銀機（POS 登入用）
// @access public
router.get('/enabled', (req, res) => {
  PosTerminal.find({ enabled: true }).sort({ code: 1 })
    .then(result => res.json(result))
    .catch(err => {
      console.log(err)
      res.status(400).send('獲取收銀機列表失敗！')
    })
})

// $route POST /api/posterminal/add
// @desc 新增收銀機
// @access public
router.post(
  '/add',
  async (req, res) => {
    try {
      const code = (req.body.code || '').trim()
      if (!code) return res.status(400).send('收銀機編號不能為空！')
      const exist = await PosTerminal.findOne({ code }).exec()
      if (exist) return res.status(400).send('收銀機編號已存在！')
      const terminal = new PosTerminal({
        code,
        name: req.body.name || code,
        location: req.body.location || '',
        type: req.body.type || 'cashier',
        orderPrefix: req.body.orderPrefix || '',
        printerIp: req.body.printerIp || '',
        printerPort: req.body.printerPort || 9100,
        cashDrawer: !!req.body.cashDrawer,
        receipt: req.body.receipt || undefined,
        serving: req.body.serving || undefined,
        print: req.body.print || undefined,
        enabled: req.body.enabled !== false
      })
      await terminal.save()
      res.send('收銀機添加成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('添加失敗，請重試！')
    }
  }
)

// $route POST /api/posterminal/edit
// @desc 編輯收銀機
// @access public
router.post(
  '/edit',
  async (req, res) => {
    try {
      const id = req.body._id
      if (!id) return res.status(400).send('缺少收銀機 ID！')
      const update = {}
      const fields = ['code', 'name', 'location', 'type', 'orderPrefix', 'printerIp', 'printerPort', 'cashDrawer', 'receipt', 'serving', 'print', 'enabled', 'maxPermissionLevel', 'allowedFunctions']
      fields.forEach(f => {
        if (req.body[f] !== undefined) update[f] = req.body[f]
      })
      // 檢查 code 唯一性
      if (update.code) {
        const exist = await PosTerminal.findOne({ code: update.code, _id: { $ne: id } }).exec()
        if (exist) return res.status(400).send('收銀機編號已存在！')
      }
      await PosTerminal.findByIdAndUpdate(id, { $set: update }).exec()
      res.send('收銀機更新成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('更新失敗，請重試！')
    }
  }
)

// $route POST /api/posterminal/del
// @desc 刪除收銀機
// @access public
router.post(
  '/del',
  async (req, res) => {
    try {
      await PosTerminal.findOneAndRemove({ _id: req.body._id }).exec()
      res.send('收銀機已刪除！')
    } catch (err) {
      console.log(err)
      res.status(400).send('刪除失敗，請重試！')
    }
  }
)

// $route POST /api/posterminal/resetSeq
// @desc 重設流水號（Z-Report 後歸零）
// @access public
router.post(
  '/resetSeq',
  async (req, res) => {
    try {
      const { _id, terminalCode } = req.body
      const filter = _id ? { _id } : (terminalCode ? { code: terminalCode } : null)
      if (!filter) return res.status(400).send('缺少收銀機識別碼！')
      await PosTerminal.findOneAndUpdate(filter, { $set: { orderSeq: 1 } }).exec()
      res.send('流水號已重設！')
    } catch (err) {
      console.log(err)
      res.status(400).send('重設失敗，請重試！')
    }
  }
)

// $route POST /api/posterminal/incrementSeq
// @desc 遞增流水號（下單時自動調用）
// @access public
router.post(
  '/incrementSeq',
  async (req, res) => {
    try {
      const { terminalCode } = req.body
      if (!terminalCode) return res.status(400).send('缺少收銀機編號！')
      const terminal = await PosTerminal.findOneAndUpdate(
        { code: terminalCode },
        { $inc: { orderSeq: 1 } },
        { new: true }
      ).exec()
      if (!terminal) return res.status(400).send('找不到收銀機！')
      res.json({
        terminalCode: terminal.code,
        orderPrefix: terminal.orderPrefix || '',
        orderSeq: terminal.orderSeq
      })
    } catch (err) {
      console.log(err)
      res.status(400).send('流水號更新失敗！')
    }
  }
)

module.exports = router
