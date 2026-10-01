const express = require('express')
const router = express.Router()
const passport = require('passport')
const MatchingRule = require('../../models/MatchingRule')
const socketio = require('../../plugins/SocketIO')

function emitMenuChanged () {
  const io = socketio.getIO()
  if (io) io.emit('menuChanged')
}

// $route GET api/matchingrule/all
// @desc 获取所有撞餐規則（後台管理）
// @access private
router.get(
  '/all',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    MatchingRule.find()
      .sort({ date: -1 })
      .then(result => res.json(result))
      .catch(err => {
        console.log(err)
        res.status(400).send('获取撞餐規則失败！')
      })
  }
)

// $route GET api/matchingrule/list
// @desc 获取所有撞餐規則（點餐端／菜單讀取，公開）
// @access public
router.get('/list', (req, res) => {
  MatchingRule.find()
    .sort({ date: -1 })
    .lean()
    .then(result => res.json(result))
    .catch(err => {
      console.log(err)
      res.json([])
    })
})

// $route POST api/matchingrule/add
// @desc 添加撞餐規則
// @access private
router.post(
  '/add',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const rule = new MatchingRule(req.body)
    rule
      .save()
      .then(() => { emitMenuChanged(); res.send('撞餐規則添加成功！') })
      .catch(err => {
        console.log(err)
        res.status(400).send('添加失败，请重试！')
      })
  }
)

// $route POST api/matchingrule/edit
// @desc 修改撞餐規則
// @access private
router.post(
  '/edit',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const _id = req.body._id
    const data = Object.assign({}, req.body)
    delete data._id
    MatchingRule.findOneAndUpdate({ _id }, { $set: data }, { new: true })
      .then(() => { emitMenuChanged(); res.send('撞餐規則修改成功！') })
      .catch(err => {
        console.log(err)
        res.status(400).send('修改失败，请重试！')
      })
  }
)

// $route POST api/matchingrule/del
// @desc 删除撞餐規則
// @access private
router.post(
  '/del',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    MatchingRule.findOneAndRemove({ _id: req.body._id })
      .then(() => { emitMenuChanged(); res.send('撞餐規則删除成功！') })
      .catch(err => {
        console.log(err)
        res.status(400).send('删除失败，请重试！')
      })
  }
)

module.exports = router
