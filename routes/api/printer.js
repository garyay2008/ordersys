const express = require('express')
const router = express.Router()
const passport = require('passport')
const fs = require('fs')
const path = require('path')
const formidable = require('formidable')
const Printer = require('../../models/Printer')
const escpos = require('../../plugins/Printer')
const printQueue = require('../../plugins/printQueue')
const config = require('../../config/config')

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

// $route POST api/printer/uploadLogo
// @desc 上傳小票 Logo 圖片
// @access private
router.post(
  '/uploadLogo',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const dir = path.join(config.publicDir, 'logo')
    fs.mkdirSync(dir, { recursive: true })
    const form = new formidable.IncomingForm()
    form.uploadDir = dir
    form.parse(req, (err, fields, files) => {
      if (err) return res.status(400).json({ status: 'error', message: err.message })
      const file = files.file
      if (!file) return res.status(400).json({ status: 'error', message: '未收到檔案' })
      const ext = (path.extname(file.name) || '.png').toLowerCase()
      const filename = 'logo_' + Date.now() + ext
      fs.rename(file.path, path.join(dir, filename), err2 => {
        if (err2) return res.status(400).json({ status: 'error', message: err2.message })
        res.json({ status: 'ok', logo: 'logo/' + filename })
      })
    })
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

// $route POST api/printer/testFallback
// @desc 測試備援打印：直接把測試小票送到該檔口設定的備援機
// @access private
router.post(
  '/testFallback',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const setting = req.body
      const stationName = (req.body.stationName || '').trim()
      if (!stationName) return res.status(400).send('未指定檔口')
      const primary = escpos.resolvePrinter(setting, stationName)
      const fbName = (primary && primary.fallbackTo) || ''
      if (!fbName) return res.status(400).send('該檔口未設置備援機')
      const fb = escpos.resolvePrinter(setting, fbName)
      if (!fb || !fb.ip) return res.status(400).send(`備援機「${fbName}」未設置 IP`)
      const data = escpos.buildTestTicket(fb)
      await escpos.print(fb, data)
      res.send(`測試備援已發送到「${fbName}」`)
    } catch (err) {
      console.log('[Printer] 測試備援失敗：' + err.message)
      res.status(400).send('測試備援失敗：' + err.message)
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

// $route POST api/printer/printReport
// @desc 列印營業報表（80mm 熱敏 IP 打印機）
// @access private
router.post(
  '/printReport',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const setting = await Printer.findOne().exec()
      if (!setting) {
        return res.status(400).send('请先在「打印机设置」里配置打印机！')
      }
      const report = req.body || {}
      const printer = escpos.resolveTicketPrinter(setting, 'receipt')
      if (!printer || !printer.ip) {
        return res.status(400).send('未設置收銀/報表打印機！')
      }
      const data = escpos.buildReportTicket(printer, report)
      await escpos.print(printer, data)
      res.send('報表已列印！')
    } catch (err) {
      console.log('[Printer] 報表列印失敗：' + err.message)
      res.status(400).send('報表列印失敗：' + err.message)
    }
  }
)

// $route POST api/printer/pantryMessage
// @desc 班地厘訊息（打柯單）：自由文字訊息送到班地厘/出品部打印機
// @access private
router.post(
  '/pantryMessage',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const setting = await Printer.findOne().exec()
      if (!setting) {
        return res.status(400).send('请先在「打印机设置」里配置打印机！')
      }
      const message = String(req.body.message || '').trim()
      if (!message) {
        return res.status(400).send('請輸入訊息內容！')
      }
      const printer = escpos.resolveTicketPrinter(setting, 'pantry')
      if (!printer || !printer.ip) {
        return res.status(400).send('未設置班地厘打印機（廚房檔口）！')
      }
      const data = escpos.buildPantryMessage(printer, {
        message,
        deskNo: req.body.deskNo || '',
        orderNo: req.body.orderNo || '',
        waiter: req.body.waiter || ''
      })
      await printQueue.enqueuePrint(setting, printer, data, { deskNo: req.body.deskNo || '', orderNo: req.body.orderNo || '' })
      res.send('班地厘訊息已發送！')
    } catch (err) {
      console.log('[Printer] 班地厘訊息失敗：' + err.message)
      res.status(400).send('班地厘訊息發送失敗：' + err.message)
    }
  }
)

module.exports = router
