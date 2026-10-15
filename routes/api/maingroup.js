const express = require('express')
const router = express.Router()
const passport = require('passport')
const MainGroup = require('../../models/MainGroup')
const Category = require('../../models/Category')
const Commodity = require('../../models/Commodity')
const Combo = require('../../models/Combo')
const socketio = require('../../plugins/SocketIO')

function emitMenuChanged () {
  const io = socketio.getIO()
  if (io) io.emit('menuChanged')
}

// $route GET api/maingroup/all
// @desc 获取所有主菜組別（後台管理）
// @access private
router.get(
  '/all',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const result = await MainGroup.find({}, { sort: { sort: 1, date: 1 } })
      res.json(result)
    } catch (err) {
      console.log(err)
      res.status(400).send('獲取主菜組別失敗！')
    }
  }
)

// $route GET api/maingroup/list
// @desc 获取所有主菜組別（點餐端／菜單讀取，公開）
// @access public
router.get('/list', async (req, res) => {
  try {
    const result = await MainGroup.find({}, { sort: { sort: 1, date: 1 } })
    res.json(result)
  } catch (err) {
    console.log(err)
    res.json([])
  }
})

// $route POST api/maingroup/add
// @desc 添加主菜組別
// @access private
router.post(
  '/add',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const name = (req.body.name || '').trim()
      if (!name) {
        res.status(400).send('組別名不能為空！')
        return
      }
      const saved = await MainGroup.create({
        name,
        sort: Number(req.body.sort) || 0,
        active: req.body.active !== false
      })
      emitMenuChanged()
      res.json(saved)
    } catch (err) {
      console.log(err)
      res.status(400).send('添加失敗，請重試！')
    }
  }
)

// $route POST api/maingroup/edit
// @desc 修改主菜組別
// @access private
router.post(
  '/edit',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const _id = req.body._id
      if (!_id) {
        res.status(400).send('缺少組別 ID！')
        return
      }
      const update = {}
      if (req.body.name !== undefined) update.name = (req.body.name || '').trim()
      if (req.body.sort !== undefined) update.sort = Number(req.body.sort) || 0
      if (req.body.active !== undefined) update.active = req.body.active
      const group = await MainGroup.findByIdAndUpdate(_id, { $set: update })
      if (!group) { res.status(400).send('找不到該組別！'); return }
      emitMenuChanged()
      res.send('主菜組別修改成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('修改失敗，請重試！')
    }
  }
)

// $route POST api/maingroup/setItems
// @desc 指派貨品/套餐至主菜組別（選中者設 mainGroupId，其餘清空）
// @access private
router.post(
  '/setItems',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const _id = req.body._id
      if (!_id) {
        res.status(400).send('缺少組別 ID！')
        return
      }
      const commodityIds = Array.isArray(req.body.commodityIds) ? req.body.commodityIds : []
      const comboIds = Array.isArray(req.body.comboIds) ? req.body.comboIds : []
      // 清空原屬此組別的貨品／套餐
      await Commodity.updateMany({ mainGroupId: String(_id) }, { $set: { mainGroupId: '' } })
      await Combo.updateMany({ mainGroupId: String(_id) }, { $set: { mainGroupId: '' } })
      // 指派新選中貨品／套餐
      if (commodityIds.length) {
        await Commodity.updateMany({ _id: { $in: commodityIds } }, { $set: { mainGroupId: String(_id) } })
      }
      if (comboIds.length) {
        await Combo.updateMany({ _id: { $in: comboIds } }, { $set: { mainGroupId: String(_id) } })
      }
      emitMenuChanged()
      res.send('貨品/套餐指派成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('貨品/套餐指派失敗，請重試！')
    }
  }
)

// $route POST api/maingroup/reorder
// @desc 拖曳/上下移動更新主菜組別排序
// @access private
router.post(
  '/reorder',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const ids = Array.isArray(req.body.ids) ? req.body.ids : []
      await Promise.all(ids.map((id, index) => MainGroup.updateOne({ _id: id }, { $set: { sort: index } })))
      emitMenuChanged()
      res.send('排序更新成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('排序更新失敗，請重試！')
    }
  }
)

// $route POST api/maingroup/del
// @desc 删除主菜組別
// @access private
router.post(
  '/del',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      await MainGroup.findOneAndRemove({ _id: req.body._id })
      emitMenuChanged()
      res.send('主菜組別刪除成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('刪除失敗，請重試！')
    }
  }
)

// $route POST api/maingroup/syncFromCategories
// @desc 從現有「分類」複印一份到主菜組別（同名不重複建，並把貨品依分類指入組別）
// @access private
router.post(
  '/syncFromCategories',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const cats = await Category.find({}).sort({ rootOrder: 1, no: 1 }).lean()
      const coms = await Commodity.find({}).lean()

      // 分類 -> 主菜組別 對照
      const groupByCatId = {}
      let sort = 0
      const createdNames = []

      for (const c of cats) {
        // 跳過沒有任何貨品的分類
        const hasCom = coms.some(x => x.categoryId && String(x.categoryId) === String(c._id))
        if (!hasCom) continue

        const code = c.code ? String(c.code).trim() : ''
        const cName = c.cName || ''
        const name = (code ? code + ' ' : '') + cName
        let group = await MainGroup.findOne({ name })
        if (!group) {
          group = await MainGroup.create({ name, sort, active: true })
          createdNames.push(name)
        }
        groupByCatId[String(c._id)] = String(group._id)
        sort++
      }

      // 依貨品 categoryId 指派主菜組別
      for (const x of coms) {
        if (!x.categoryId) continue
        const gid = groupByCatId[String(x.categoryId)]
        if (!gid) continue
        if (String(x.mainGroupId || '') !== gid) {
          await Commodity.updateOne({ _id: x._id }, { $set: { mainGroupId: gid } })
        }
      }

      emitMenuChanged()
      res.json({ created: createdNames.length, groups: createdNames })
    } catch (err) {
      console.log(err)
      res.status(400).send('複印分類失敗，請重試！')
    }
  }
)

module.exports = router
