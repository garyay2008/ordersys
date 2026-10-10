const express = require('express')
const router = express.Router()
const passport = require('passport')
const Combo = require('../../models/Combo')
const socketio = require('../../plugins/SocketIO')

function emitMenuChanged () {
  const io = socketio.getIO()
  if (io) io.emit('menuChanged')
}

// 驗證收入分帳：總和必須等於套餐價格（有分帳時）
function validateSplit (body) {
  const split = (Array.isArray(body.departmentSplit) ? body.departmentSplit : [])
    .filter(d => d && d.department && String(d.department).trim() !== '')
  if (!split.length) return null
  const price = Number(body.price) || 0
  const total = split.reduce((s, d) => s + (Number(d.amount) || 0), 0)
  const diff = Math.round((price - total) * 100) / 100
  if (Math.abs(diff) > 0.005) {
    const dir = diff > 0 ? '未分完' : '超出'
    return `收入分帳總和（$${Math.round(total * 100) / 100}）與套餐價格（$${price}）不符，差額 $${Math.abs(diff)}（${dir}），請修正後再存入`
  }
  return null
}

// $route GET api/combo/all
// @desc 获取所有套餐
// @access private
router.get(
  '/all',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    Combo.find()
      .sort({ date: -1 })
      .then(result => res.json(result))
      .catch(err => {
        console.log(err)
        res.status(400).send('获取套餐失败！')
      })
  }
)

// $route POST api/combo/add
// @desc 添加套餐
// @access private
router.post(
  '/add',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const reason = validateSplit(req.body)
    if (reason) {
      res.status(400).send(reason)
      return
    }
    const combo = new Combo(req.body)
    combo
      .save()
      .then(() => { emitMenuChanged(); res.send('套餐添加成功！') })
      .catch(err => {
        console.log(err)
        res.status(400).send('添加失败，请重试！')
      })
  }
)

// $route POST api/combo/edit
// @desc 修改套餐
// @access private
router.post(
  '/edit',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const reason = validateSplit(req.body)
    if (reason) {
      res.status(400).send(reason)
      return
    }
    const _id = req.body._id
    const data = Object.assign({}, req.body)
    delete data._id
    Combo.findOneAndUpdate({ _id }, { $set: data }, { new: true })
      .then(() => { emitMenuChanged(); res.send('套餐修改成功！') })
      .catch(err => {
        console.log(err)
        res.status(400).send('修改失败，请重试！')
      })
  }
)

// $route POST api/combo/del
// @desc 删除套餐
// @access private
router.post(
  '/del',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    Combo.findOneAndRemove({ _id: req.body._id })
      .then(() => { emitMenuChanged(); res.send('套餐删除成功！') })
      .catch(err => {
        console.log(err)
        res.status(400).send('删除失败，请重试！')
      })
  }
)

// 整組同價：uniformUpgradeEnabled 時，將分組內所有品項的加價統一為 uniformUpgrade
// 僅在點餐端呈現（唯讀），不寫回資料庫；後台 /api/combo/all 仍回傳原始分組結構供編輯
function materializeCombo (combo) {
  if (!combo) return combo
  const groups = (Array.isArray(combo.groups) ? combo.groups : []).map(g => {
    if (!g || !g.uniformUpgradeEnabled) return g
    const up = Number(g.uniformUpgrade) || 0
    return Object.assign({}, g, { items: (g.items || []).map(i => Object.assign({}, i, { upgradePrice: up })) })
  })
  return Object.assign({}, combo, { groups })
}

// $route POST api/combo/soldout
// @desc 沽清/重售套餐（POS 前台長按使用）
// @access private
router.post(
  '/soldout',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    Combo.findByIdAndUpdate(
      req.body._id,
      { $set: { soldOut: !!req.body.soldOut } },
      { new: true }
    )
      .then(combo => {
        if (!combo) {
          res.status(400).send('找不到該套餐！')
          return
        }
        emitMenuChanged()
        res.send(combo.soldOut ? '套餐已沽清！' : '套餐已重售！')
      })
      .catch(err => {
        console.log(err)
        res.status(400).send('更新失败，请重试！')
      })
  }
)

// $route GET api/combo/menu
// @desc 点餐端获取在售套餐（?channel=pos|qr 可依渠道過濾顯示）
// @access public
router.get('/menu', async (req, res) => {
  const channel = req.query.channel === 'qr' ? 'qr' : (req.query.channel === 'pos' ? 'pos' : null)
  const query = { soldOut: false }
  if (channel === 'qr') query.showOnQr = { $ne: false }
  else if (channel === 'pos') query.showOnPos = { $ne: false }
  try {
    const result = await Combo.find(query).sort({ date: -1 }).lean().exec()
    const stamped = await Combo.stampItemsSoldOut(result)
    res.json(stamped.map(c => {
      const combo = materializeCombo(c)
      // QR 端：顯示名改用 qrName，原 name 保留到 name2 供廚房單印 POS 名
      if (channel === 'qr' && combo.qrName) {
        combo.name2 = combo.name
        combo.name = combo.qrName
      }
      return combo
    }))
  } catch (err) {
    console.log(err)
    res.json([])
  }
})

module.exports = router
