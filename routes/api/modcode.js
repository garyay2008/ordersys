const express = require('express')
const router = express.Router()
const passport = require('passport')
const ModCode = require('../../models/ModCode')
const ModCodeCategory = require('../../models/ModCodeCategory')
const socketio = require('../../plugins/SocketIO')

function emitModcodeChanged () {
  const io = socketio.getIO()
  if (io) io.emit('modcodeChanged')
}

// 渠道過濾：舊資料沒有 channels 欄位時視為適用所有渠道
function channelFilter (channel) {
  if (!channel) return {}
  return {
    $or: [
      { channels: channel },
      { channels: { $exists: false } },
      { channels: { $size: 0 } }
    ]
  }
}

// $route GET api/modcode/all
// @desc 获取所有口味改码（点餐端 public 也可用，这里分开）
// @access private
router.get(
  '/all',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    ModCode.find(channelFilter(req.query.channel))
      .sort({ sort: 1, date: 1 })
      .then(result => res.json(result))
      .catch(err => {
        console.log(err)
        res.status(400).send('获取改码失败！')
      })
  }
)

// $route GET api/modcode/list
// @desc 点餐端获取改码列表（可帶 ?channel=pos|qr 過濾渠道）
// @access public
router.get('/list', (req, res) => {
  ModCode.find(channelFilter(req.query.channel))
    .sort({ sort: 1, date: 1 })
    .then(result => res.json(result))
    .catch(err => {
      console.log(err)
      res.json([])
    })
})

// $route GET api/modcode/categories
// @desc 获取改码类别列表（独立类别实体）
// @access public
router.get('/categories', (req, res) => {
  ModCodeCategory.find()
    .sort({ sort: 1, date: 1 })
    .then(result => res.json(result))
    .catch(err => {
      console.log(err)
      res.json([])
    })
})

// $route POST api/modcode/category/add
// @desc 添加改码类别
// @access private
router.post(
  '/category/add',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const name = (req.body.name || '').trim()
    if (!name) {
      res.status(400).send('类别名不能为空！')
      return
    }
    const cat = new ModCodeCategory({ name, code: (req.body.code || '').trim(), sort: req.body.sort || 0, mandatory: req.body.mandatory === true || req.body.mandatory === 'true' })
    cat
      .save()
      .then(() => { emitModcodeChanged(); res.send('改码类别添加成功！') })
      .catch(err => {
        console.log(err)
        res.status(400).send('添加失败，请重试！')
      })
  }
)

// $route POST api/modcode/category/update
// @desc 更新改碼類別（名稱/編號）
// @access private
router.post(
  '/category/update',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const id = req.body._id
    if (!id) {
      res.status(400).send('缺少類別 ID！')
      return
    }
    const update = {}
    if (req.body.name !== undefined) update.name = req.body.name
    if (req.body.code !== undefined) update.code = req.body.code
    if (req.body.sort !== undefined) update.sort = req.body.sort
    if (req.body.mandatory !== undefined) update.mandatory = req.body.mandatory === true || req.body.mandatory === 'true'
    ModCodeCategory.findByIdAndUpdate(id, { $set: update }, { new: true })
      .then(cat => {
        if (!cat) { res.status(400).send('找不到該類別！'); return }
        emitModcodeChanged()
        res.send('改碼類別更新成功！')
      })
      .catch(err => {
        console.log(err)
        res.status(400).send('更新失敗，請重試！')
      })
  }
)

// $route POST api/modcode/category/del
// @desc 删除改码类别
// @access private
router.post(
  '/category/del',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const cat = await ModCodeCategory.findById(req.body._id).lean().exec()
      if (!cat) return res.status(400).send('找不到該類別！')
      const count = await ModCode.countDocuments({ category: cat.name })
      if (count > 0) return res.status(400).send('此類別下仍有 ' + count + ' 個改碼，請先移除或改類別')
      await ModCodeCategory.findOneAndRemove({ _id: req.body._id })
      emitModcodeChanged()
      res.send('改码类别删除成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('删除失败，请重试！')
    }
  }
)

// 白名單：只允許寫入 Modifier Master 定義的欄位
function sanitizeMod (body) {
  const out = {}
  const fields = ['name', 'code', 'category', 'sort', 'price', 'specs', 'channels', 'mandatory', 'maxSelect', 'station', 'quickKey']
  fields.forEach(f => {
    if (body[f] !== undefined) out[f] = body[f]
  })
  return out
}

// $route POST api/modcode/add
// @desc 添加改码
// @access private
router.post(
  '/add',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const mod = new ModCode({ code: req.body.code || '', ...sanitizeMod(req.body) })
    mod
      .save()
      .then(() => { emitModcodeChanged(); res.send('改码添加成功！') })
      .catch(err => {
        console.log(err)
        res.status(400).send('添加失败，请重试！')
      })
  }
)

// $route POST api/modcode/update
// @desc 更新改码（價格/渠道/必選/站別/快捷鍵等）
// @access private
router.post(
  '/update',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const id = req.body._id
    if (!id) {
      res.status(400).send('缺少改码 ID！')
      return
    }
    const update = sanitizeMod(req.body)
    delete update._id
    ModCode.findByIdAndUpdate(id, { $set: update }, { new: true })
      .then(mod => {
        if (!mod) {
          res.status(400).send('找不到該改码！')
          return
        }
        emitModcodeChanged()
        res.send('改码更新成功！')
      })
      .catch(err => {
        console.log(err)
        res.status(400).send('更新失败，请重试！')
      })
  }
)

// $route POST api/modcode/reorder
// @desc 拖曳更新改碼排序
// @access private
router.post(
  '/reorder',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const ids = Array.isArray(req.body.ids) ? req.body.ids : []
      await Promise.all(ids.map((id, index) => ModCode.updateOne({ _id: id }, { $set: { sort: index } })))
      emitModcodeChanged()
      res.send('排序更新成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('排序更新失敗，請重試！')
    }
  }
)

// $route POST api/modcode/del
// @desc 删除改码
// @access private
router.post(
  '/del',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    ModCode.findOneAndRemove({ _id: req.body._id })
      .then(() => { emitModcodeChanged(); res.send('改码删除成功！') })
      .catch(err => {
        console.log(err)
        res.status(400).send('删除失败，请重试！')
      })
  }
)

module.exports = router
