const express = require('express')
const router = express.Router()
const passport = require('passport')
const MenuSetting = require('../../models/MenuSetting')

const DEFAULTS = {
  showImages: true,
  showPrice: true,
  showDescribe: false,
  showSoldOut: true,
  autoRotate: true,
  rotateInterval: 8,
  columns: 4,
  fontScale: 1,
  categoryIds: [],
  themeColor: ''
}

// $route GET api/emenu/setting
// @desc 取得電子菜單（大螢幕）顯示設定
// @access public（牆上大螢幕也要讀）
router.get('/setting', (req, res) => {
  MenuSetting.findOne()
    .then(result => {
      res.json(Object.assign({}, DEFAULTS, result ? result.toObject() : {}))
    })
    .catch(err => {
      console.log(err)
      res.json(DEFAULTS)
    })
})

// $route POST api/emenu/save
// @desc 保存電子菜單設定（單例 upsert）
// @access private
router.post(
  '/save',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const data = req.body || {}
      delete data._id
      delete data.date
      const count = await MenuSetting.countDocuments().exec()
      if (count === 0) {
        await MenuSetting.create(data)
      } else {
        await MenuSetting.findOneAndUpdate({}, { $set: data }).exec()
      }
      res.send('電子菜單設定保存成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('保存失敗，請重試！')
    }
  }
)

module.exports = router
