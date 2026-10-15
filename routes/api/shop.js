const express = require('express')
const router = express.Router()
const passport = require('passport')
const fs = require('fs')
const path = require('path')
const formidable = require('formidable')
const Shop = require('../../models/Shop')
const config = require('../../config/config')

// $route GET api/shop/get
// @desc 获取店铺信息，返回json数据
// @access public
router.get('/get', async (req, res) => {
  try {
    const profiles = await Shop.findOne()
    res.json(profiles)
  } catch (err) {
    console.log(err)
    res.status(400).send('獲取店鋪信息失敗！')
  }
})

// $route POST api/shop/edit
// @desc 修改店铺信息，返回json数据
// @access private
router.post(
  '/edit',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const shopInfo = req.body
      await Shop.findByIdAndUpdate(shopInfo.id, { $set: shopInfo })
      res.send('店铺信息修改成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('店铺信息修改失败！')
    }
  }
)

// $route post api/shop/create
// @desc 创建店铺信息，返回json数据
// @access public
router.post('/create', async (req, res) => {
  try {
    const count = await Shop.countDocuments()
    if (count !== 0) {
      res.status(400).send('系统已存在店铺信息，请勿重复初始化！')
      return
    }
    await Shop.create(req.body)
    res.send('店铺信息初始化成功！')
  } catch (err) {
    console.log(err)
    res.status(400).send('店铺信息初始化失败！')
  }
})

// $route POST api/shop/upload
// @desc 上传店铺照片，返回json数据
// @access public
router.post('/upload', (req, res) => {
  let form = new formidable.IncomingForm()
  const shopDir = path.join(config.publicDir, 'shop')
  fs.mkdirSync(shopDir, { recursive: true })
  form.uploadDir = shopDir
  form.parse(req, (err, fields, files) => {
    fs.rename(
      files.file.path,
      path.join(shopDir, files.file.name),
      err => {
        if (err) throw err
        let url = `/shop/${files.file.name}`
        res.json({ status: 'ok', url })
      }
    )
  })
})

module.exports = router
