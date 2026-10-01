const express = require('express')
const router = express.Router()
const passport = require('passport')
const Table = require('../../models/Table')
const socketio = require('../../plugins/SocketIO')

// $route GET api/table/all
// @desc 获取所有桌号
// @access private
router.get(
  '/all',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    Table.find()
      .sort({ no: 1 })
      .then(result => res.json(result))
      .catch(err => {
        console.log(err)
        res.status(400).send('获取桌号失败！')
      })
  }
)

// $route POST api/table/add
// @desc 添加桌号
// @access private
router.post(
  '/add',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const no = String(req.body.no)
      const exist = await Table.findOne({ no }).exec()
      if (exist) {
        res.status(400).send('桌号已存在！')
        return
      }
      const suffixMatch = no.match(/^(\d+)([A-Z])$/i)
      const data = Object.assign({}, req.body)
      if (suffixMatch) {
        const parentNo = suffixMatch[1]
        const suffix = suffixMatch[2].toUpperCase()
        const parent = await Table.findOne({ no: parentNo }).exec()
        if (parent) {
          data.physicalNo = parentNo
          data.shareSuffix = suffix
          data.name = no
          data.seats = data.seats || parent.seats
          data.zone = data.zone || parent.zone
        } else {
          data.physicalNo = ''
          data.shareSuffix = ''
          data.name = ''
        }
      } else {
        data.physicalNo = ''
        data.shareSuffix = ''
        data.name = ''
      }
      const table = new Table(data)
      await table.save()
      res.send('桌号添加成功！')
      try {
        const io = socketio.getIO()
        if (io) io.emit('tableLayoutChanged')
      } catch (e) {}
    } catch (err) {
      console.log(err)
      res.status(400).send('添加失败，请重试！')
    }
  }
)

// $route POST api/table/edit
// @desc 修改桌号
// @access private
router.post(
  '/edit',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const _id = req.body._id
    const data = Object.assign({}, req.body)
    delete data._id
    Table.findOneAndUpdate({ _id }, { $set: data }, { new: true })
      .then(() => {
        res.send('桌号修改成功！')
        try {
          const io = socketio.getIO()
          if (io) io.emit('tableLayoutChanged')
        } catch (e) {}
      })
      .catch(err => {
        console.log(err)
        res.status(400).send('修改失败，请重试！')
      })
  }
)

// $route POST api/table/layout
// @desc 儲存桌位版面（x/y 座標）
// @access private
router.post(
  '/layout',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const tables = req.body.tables || []
      await Promise.all(tables.map(t => {
        if (!t._id) return Promise.resolve()
        return Table.updateOne({ _id: t._id }, { $set: { x: t.x, y: t.y } }).exec()
      }))
      res.send('桌位版面儲存成功！')
      try {
        const io = socketio.getIO()
        if (io) io.emit('tableLayoutChanged')
      } catch (e) {}
    } catch (err) {
      console.log(err)
      res.status(400).send('儲存版面失敗，請重試！')
    }
  }
)

// $route POST api/table/del
// @desc 删除桌号
// @access private
router.post(
  '/del',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    Table.findOneAndRemove({ _id: req.body._id })
      .then(() => {
        res.send('桌号删除成功！')
        try {
          const io = socketio.getIO()
          if (io) io.emit('tableLayoutChanged')
        } catch (e) {}
      })
      .catch(err => {
        console.log(err)
        res.status(400).send('删除失败，请重试！')
      })
  }
)

module.exports = router
