const express = require('express')
const router = express.Router()
const passport = require('passport')
const Printer = require('../../models/Printer')
const escpos = require('../../plugins/Printer')

// $route GET api/printer/get
// @desc 获取打印机设置
// @access private
router.get(
  '/get',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const setting = await Printer.findOne().exec()
      res.json(setting || {})
    } catch (err) {
      console.log(err)
      res.status(400).send('获取打印机设置失败！')
    }
  }
)

// $route POST api/printer/save
// @desc 保存打印机设置
// @access private
router.post(
  '/save',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const data = req.body
      delete data._id
      const count = await Printer.countDocuments().exec()
      if (count === 0) {
        await Printer.create(data)
      } else {
        await Printer.findOneAndUpdate({}, { $set: data }).exec()
      }
      res.send('打印机设置保存成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('保存失败，请重试！')
    }
  }
)

// $route POST api/printer/test
// @desc 测试打印
// @access private
router.post(
  '/test',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const setting = req.body
      const data = escpos.buildTestTicket(setting)
      await escpos.print(setting, data)
      res.send('测试打印已发送！')
    } catch (err) {
      console.log(err)
      res.status(400).send('测试打印失败：' + err.message)
    }
  }
)

// $route POST api/printer/openDrawer
// @desc 開啟收銀銀櫃
// @access private
router.post(
  '/openDrawer',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const terminalCode = req.body.terminalCode || ''
      if (!terminalCode) {
        return res.status(400).send('未設置收銀機編號')
      }
      const result = await escpos.openDrawerByTerminal(terminalCode)
      if (result) {
        res.send('銀櫃已開啟')
      } else {
        res.status(400).send('銀櫃開啟失敗，請檢查打印機連接')
      }
    } catch (err) {
      console.log('[Printer] 銀櫃觸發失敗：' + err.message)
      res.status(400).send('銀櫃開啟失敗：' + err.message)
    }
  }
)

module.exports = router
