const express = require('express')
const router = express.Router()
const passport = require('passport')
const fs = require('fs')
const path = require('path')
const formidable = require('formidable')
const QrSetting = require('../../models/QrSetting')
const config = require('../../config/config')

const DEFAULTS = {
  showImages: true,
  showDescribe: true,
  showStock: false,
  showModPrices: true,
  showSoldOutItems: true,
  showNotice: true,
  showDetail: true,
  showDiscount: true,
  fontScale: 1,
  theme: 'orange',
  baseUrl: '',
  welcomeImage: '',
  showSpecs: false,
  qrEnabled: true
}

// $route GET api/qrsetting/get
// @desc 获取 QR 點餐版面功能設定
// @access public（客人手機頁也要讀）
router.get('/get', (req, res) => {
  QrSetting.findOne()
    .then(result => {
      res.json(Object.assign({}, DEFAULTS, result ? result.toObject() : {}))
    })
    .catch(err => {
      console.log(err)
      res.json(DEFAULTS)
    })
})

// $route POST api/qrsetting/save
// @desc 保存 QR 功能設定（單例 upsert）
// @access private
router.post(
  '/save',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const data = req.body || {}
      delete data._id
      delete data.date
      const count = await QrSetting.countDocuments().exec()
      if (count === 0) {
        await QrSetting.create(data)
      } else {
        await QrSetting.findOneAndUpdate({}, { $set: data }).exec()
      }
      res.send('QR 功能設置保存成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('保存失敗，請重試！')
    }
  }
)

// $route POST api/qrsetting/upload
// @desc 上傳 QR 登入畫面背景圖
// @access private
router.post(
  '/upload',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const form = new formidable.IncomingForm()
    const dir = path.join(config.publicDir, 'qr')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    form.uploadDir = dir
    form.parse(req, (err, fields, files) => {
      if (err) return res.status(400).send('上傳失敗，請重試！')
      const file = files.file
      if (!file) return res.status(400).send('請選擇圖片！')
      const ext = path.extname(file.name || '') || '.jpg'
      const name = 'welcome-' + Date.now() + ext
      fs.rename(file.path, path.join(dir, name), err2 => {
        if (err2) return res.status(400).send('上傳失敗，請重試！')
        const url = `/qr/${name}`
        res.json({ status: 'ok', url })
      })
    })
  }
)

module.exports = router
