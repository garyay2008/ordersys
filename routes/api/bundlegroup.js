const express = require('express')
const router = express.Router()
const passport = require('passport')
const BundleGroup = require('../../models/BundleGroup')
const Commodity = require('../../models/Commodity')
const socketio = require('../../plugins/SocketIO')

function emitMenuChanged () {
  const io = socketio.getIO()
  if (io) io.emit('menuChanged')
}

// $route GET api/bundlegroup/all
// @desc 获取所有跟餐組別（後台管理）
// @access private
router.get(
  '/all',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const result = await BundleGroup.find({}, { sort: { sort: 1, date: 1 } })
      res.json(result)
    } catch (err) {
      console.log(err)
      res.status(400).send('獲取跟餐組別失敗！')
    }
  }
)

// $route GET api/bundlegroup/list
// @desc 获取所有跟餐組別（點餐端／菜單讀取，公開）
// @access public
router.get('/list', async (req, res) => {
  try {
    const result = await BundleGroup.find({}, { sort: { sort: 1, date: 1 } })
    res.json(result)
  } catch (err) {
    console.log(err)
    res.json([])
  }
})

// $route POST api/bundlegroup/add
// @desc 添加跟餐組別
// @access private
router.post(
  '/add',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const name = (req.body.name || '').trim()
      if (!name) {
        res.status(400).send('組別名不能為空！')
        return
      }
      const saved = await BundleGroup.create({
        name,
        price: Number(req.body.price) || 0,
        sort: Number(req.body.sort) || 0,
        active: req.body.active !== false
      })
      emitMenuChanged()
      res.json(saved)
    } catch (err) {
      console.log(err)
      res.status(400).send('添加失敗，請重試！')
    }
  }
)

// $route POST api/bundlegroup/edit
// @desc 修改跟餐組別
// @access private
router.post(
  '/edit',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const _id = req.body._id
      if (!_id) {
        res.status(400).send('缺少組別 ID！')
        return
      }
      const update = {}
      if (req.body.name !== undefined) update.name = (req.body.name || '').trim()
      if (req.body.price !== undefined) update.price = Number(req.body.price) || 0
      if (req.body.sort !== undefined) update.sort = Number(req.body.sort) || 0
      if (req.body.active !== undefined) update.active = req.body.active
      const group = await BundleGroup.findByIdAndUpdate(_id, { $set: update })
      if (!group) { res.status(400).send('找不到該組別！'); return }
      emitMenuChanged()
      res.send('跟餐組別修改成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('修改失敗，請重試！')
    }
  }
)

// $route POST api/bundlegroup/setItems
// @desc 指派貨品至跟餐組別（選中者設 bundleGroupId，其餘清空）
// @access private
router.post(
  '/setItems',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const _id = req.body._id
      if (!_id) {
        res.status(400).send('缺少組別 ID！')
        return
      }
      const ids = Array.isArray(req.body.commodityIds) ? req.body.commodityIds : []
      // 清空原屬此組別的貨品
      await Commodity.updateMany({ bundleGroupId: String(_id) }, { $set: { bundleGroupId: '' } })
      // 指派新選中貨品
      if (ids.length) {
        await Commodity.updateMany({ _id: { $in: ids } }, { $set: { bundleGroupId: String(_id) } })
      }
      emitMenuChanged()
      res.send('貨品指派成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('貨品指派失敗，請重試！')
    }
  }
)

// $route POST api/bundlegroup/reorder
// @desc 拖曳/上下移動更新跟餐組別排序
// @access private
router.post(
  '/reorder',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const ids = Array.isArray(req.body.ids) ? req.body.ids : []
      await Promise.all(ids.map((id, index) => BundleGroup.updateOne({ _id: id }, { $set: { sort: index } })))
      emitMenuChanged()
      res.send('排序更新成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('排序更新失敗，請重試！')
    }
  }
)

// $route POST api/bundlegroup/del
// @desc 删除跟餐組別
// @access private
router.post(
  '/del',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      await BundleGroup.findOneAndRemove({ _id: req.body._id })
      emitMenuChanged()
      res.send('跟餐組別刪除成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('刪除失敗，請重試！')
    }
  }
)

module.exports = router
