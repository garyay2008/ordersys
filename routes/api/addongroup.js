const express = require('express')
const router = express.Router()
const passport = require('passport')
const AddonGroup = require('../../models/AddonGroup')
const socketio = require('../../plugins/SocketIO')

function emitMenuChanged () {
  const io = socketio.getIO()
  if (io) io.emit('menuChanged')
}

// $route GET api/addongroup/all
// @desc 获取所有跟餐組（後台管理）
// @access private
router.get(
  '/all',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    AddonGroup.find()
      .sort({ date: -1 })
      .then(result => res.json(result))
      .catch(err => {
        console.log(err)
        res.status(400).send('获取跟餐組失败！')
      })
  }
)

// $route GET api/addongroup/list
// @desc 获取所有跟餐組（點餐端／菜單讀取，公開）
// @access public
router.get('/list', (req, res) => {
  AddonGroup.find()
    .sort({ date: -1 })
    .lean()
    .then(result => res.json(result))
    .catch(err => {
      console.log(err)
      res.json([])
    })
})

// $route POST api/addongroup/add
// @desc 添加跟餐組
// @access private
router.post(
  '/add',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const addonGroup = new AddonGroup(req.body)
    addonGroup
      .save()
      .then(() => { emitMenuChanged(); res.send('跟餐組添加成功！') })
      .catch(err => {
        console.log(err)
        res.status(400).send('添加失败，请重试！')
      })
  }
)

// $route POST api/addongroup/edit
// @desc 修改跟餐組
// @access private
router.post(
  '/edit',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const _id = req.body._id
    const data = Object.assign({}, req.body)
    delete data._id
    AddonGroup.findOneAndUpdate({ _id }, { $set: data }, { new: true })
      .then(() => { emitMenuChanged(); res.send('跟餐組修改成功！') })
      .catch(err => {
        console.log(err)
        res.status(400).send('修改失败，请重试！')
      })
  }
)

// $route POST api/addongroup/del
// @desc 删除跟餐組
// @access private
router.post(
  '/del',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    AddonGroup.findOneAndRemove({ _id: req.body._id })
      .then(() => { emitMenuChanged(); res.send('跟餐組删除成功！') })
      .catch(err => {
        console.log(err)
        res.status(400).send('删除失败，请重试！')
      })
  }
)

module.exports = router
