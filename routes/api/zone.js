const express = require('express')
const router = express.Router()
const passport = require('passport')
const Zone = require('../../models/Zone')
const socketio = require('../../plugins/SocketIO')

// $route GET api/zone/all
// @desc 获取所有区域（后台）
// @access private
router.get(
  '/all',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    Zone.find()
      .sort({ sort: 1, date: 1 })
      .then(result => res.json(result))
      .catch(err => {
        console.log(err)
        res.status(400).send('獲取區域失敗！')
      })
  }
)

// $route GET api/zone/list
// @desc 点餐端/前台获取区域列表
// @access public
router.get('/list', (req, res) => {
  Zone.find()
    .sort({ sort: 1, date: 1 })
    .then(result => res.json(result))
    .catch(err => {
      console.log(err)
      res.json([])
    })
})

// $route POST api/zone/add
// @desc 添加区域
// @access private
router.post(
  '/add',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const name = (req.body.name || '').trim()
    if (!name) {
      res.status(400).send('區域名不能為空！')
      return
    }
    const zone = new Zone({ name, sort: req.body.sort || 0 })
    zone
      .save()
      .then(() => {
        res.send('區域添加成功！')
        try {
          const io = socketio.getIO()
          if (io) io.emit('zoneChanged')
        } catch (e) {}
      })
      .catch(err => {
        console.log(err)
        res.status(400).send('添加失敗，請重試！')
      })
  }
)

// $route POST api/zone/del
// @desc 删除区域
// @access private
router.post(
  '/del',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    Zone.findOneAndRemove({ _id: req.body._id })
      .then(() => {
        res.send('區域刪除成功！')
        try {
          const io = socketio.getIO()
          if (io) io.emit('zoneChanged')
        } catch (e) {}
      })
      .catch(err => {
        console.log(err)
        res.status(400).send('刪除失敗，請重試！')
      })
  }
)

module.exports = router
