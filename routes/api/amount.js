const express = require('express')
const router = express.Router()
const passport = require('passport')
const Amount = require('../../models/Amount')

// GET api/amount/list
// 取得所有設定（key=value 分組）
router.get('/list', async (req, res) => {
  try {
    const items = await Amount.find().sort({ date: 1 }).exec()
    res.json(items)
  } catch (err) {
    console.log(err)
    res.json([])
  }
})

// GET api/amount/:key
// 取得指定 key 的值
router.get('/:key', async (req, res) => {
  try {
    const items = await Amount.find({ key: req.params.key }).sort({ date: 1 }).exec()
    res.json(items)
  } catch (err) {
    console.log(err)
    res.json([])
  }
})

// POST api/amount/save
// 新增一筆設定 { key, value }
router.post(
  '/save',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const { key, value } = req.body
      if (!key || !value) {
        return res.status(400).send('參數不完整')
      }
      const item = new Amount({ key, value: value.trim() })
      await item.save()
      res.json(item)
    } catch (err) {
      console.log(err)
      res.status(400).send('新增失敗')
    }
  }
)

// POST api/amount/delete
// 刪除一筆設定 { _id }
router.post(
  '/delete',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      await Amount.findOneAndRemove({ _id: req.body._id }).exec()
      res.send('刪除成功')
    } catch (err) {
      console.log(err)
      res.status(400).send('刪除失敗')
    }
  }
)

module.exports = router
