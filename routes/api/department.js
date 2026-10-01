const express = require('express')
const router = express.Router()
const passport = require('passport')
const Department = require('../../models/Department')

// $route GET api/department/all
// @desc 获取所有部门（后台）
// @access private
router.get(
  '/all',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    Department.find()
      .sort({ sort: 1, date: 1 })
      .then(result => res.json(result))
      .catch(err => {
        console.log(err)
        res.status(400).send('獲取部門失敗！')
      })
  }
)

// $route GET api/department/list
// @desc 获取部门列表（前台可用）
// @access public
router.get('/list', (req, res) => {
  Department.find()
    .sort({ sort: 1, date: 1 })
    .then(result => res.json(result))
    .catch(err => {
      console.log(err)
      res.json([])
    })
})

// $route POST api/department/add
// @desc 添加部门
// @access private
router.post(
  '/add',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const name = (req.body.name || '').trim()
    if (!name) {
      res.status(400).send('部門名不能為空！')
      return
    }
    const dept = new Department({
      name,
      code: (req.body.code || '').trim(),
      sort: req.body.sort || 0,
      active: req.body.active !== false,
      showInSplit: req.body.showInSplit !== false
    })
    dept
      .save()
      .then(() => res.send('部門添加成功！'))
      .catch(err => {
        console.log(err)
        res.status(400).send('添加失敗，請重試！')
      })
  }
)

// $route POST api/department/update
// @desc 更新部门
// @access private
router.post(
  '/update',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const id = req.body._id
    if (!id) {
      res.status(400).send('缺少部門 ID！')
      return
    }
    const update = {}
    if (req.body.name !== undefined) update.name = req.body.name
    if (req.body.code !== undefined) update.code = req.body.code
    if (req.body.sort !== undefined) update.sort = req.body.sort
    if (req.body.active !== undefined) update.active = req.body.active
    if (req.body.showInSplit !== undefined) update.showInSplit = req.body.showInSplit
    Department.findByIdAndUpdate(id, { $set: update }, { new: true })
      .then(dept => {
        if (!dept) { res.status(400).send('找不到該部門！'); return }
        res.send('部門更新成功！')
      })
      .catch(err => {
        console.log(err)
        res.status(400).send('更新失敗，請重試！')
      })
  }
)

// $route POST api/department/reorder
// @desc 拖曳/上下移動更新部門排序
// @access private
router.post(
  '/reorder',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const ids = Array.isArray(req.body.ids) ? req.body.ids : []
      await Promise.all(ids.map((id, index) => Department.updateOne({ _id: id }, { $set: { sort: index } })))
      res.send('排序更新成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('排序更新失敗，請重試！')
    }
  }
)

// $route POST api/department/del
// @desc 删除部门
// @access private
router.post(
  '/del',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    Department.findOneAndRemove({ _id: req.body._id })
      .then(() => res.send('部門刪除成功！'))
      .catch(err => {
        console.log(err)
        res.status(400).send('刪除失敗，請重試！')
      })
  }
)

module.exports = router
