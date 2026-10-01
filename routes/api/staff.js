const express = require('express')
const router = express.Router()
const passport = require('passport')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const Staff = require('../../models/Staff')
const { secretKey } = require('../../config/config')
const { requireLevel } = require('../../middleware/auth')

// $route GET api/staff/all
// @desc 获取所有用户
// @access private
router.get(
  '/all',
  passport.authenticate('jwt', { session: false }), requireLevel(4),
  (req, res) => {
    Staff.find()
      .sort({ no: 1, date: 1 })
      .then(result => res.json(result))
      .catch(err => {
        console.log(err)
        res.status(400).send('獲取用戶失敗！')
      })
  }
)

// $route GET api/staff/list
// @desc 前台获取用户列表
// @access public
router.get('/list', (req, res) => {
  Staff.find({ enabled: true })
    .sort({ no: 1, date: 1 })
    .then(result => res.json(result))
    .catch(err => {
      console.log(err)
      res.json([])
    })
})

// $route POST api/staff/login
// @desc 员工登录（编号 + 密码）
// @access public
router.post('/login', async (req, res) => {
  try {
    const no = (req.body.no || '').trim()
    const password = req.body.password || ''
    const staff = await Staff.findOne({ no, enabled: true }).exec()
    if (!staff) {
      res.status(400).send('用戶編號錯誤或已停用！')
      return
    }
    if (!staff.password || !bcrypt.compareSync(password, staff.password)) {
      res.status(400).send('密碼錯誤！')
      return
    }
    const rules = { id: staff.id, no: staff.no, name: staff.name, role: staff.role, kind: 'staff' }
    jwt.sign(rules, secretKey, { expiresIn: 36000 }, (err, token) => {
      if (err) {
        res.status(400).send('登入失敗！')
        return
      }
      res.json({
        success: true,
        no: staff.no,
        name: staff.name,
        role: staff.role,
        permissionLevel: staff.permissionLevel || 1,
        permissions: staff.permissions || [],
        defaultTerminal: staff.defaultTerminal || '',
        token: 'Bearer ' + token
      })
    })
  } catch (err) {
    console.log(err)
    res.status(400).send('登入失敗！')
  }
})

// $route POST api/staff/add
// @desc 添加用户
// @access private
router.post(
  '/add',
  passport.authenticate('jwt', { session: false }), requireLevel(4),
  async (req, res) => {
    try {
      const no = (req.body.no || '').trim()
      if (no) {
        const exist = await Staff.findOne({ no }).exec()
        if (exist) {
          res.status(400).send('用戶編號已存在！')
          return
        }
      }
      const data = Object.assign({}, req.body)
      if (data.password) data.password = bcrypt.hashSync(data.password, 10)
      // 更新 defaultTerminal
      if (req.body.defaultTerminal !== undefined) data.defaultTerminal = req.body.defaultTerminal
      const staff = new Staff(data)
      await staff.save()
      res.send('用戶添加成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('添加失敗，請重試！')
    }
  }
)

// $route POST api/staff/edit
// @desc 修改用户
// @access private
router.post(
  '/edit',
  passport.authenticate('jwt', { session: false }), requireLevel(4),
  (req, res) => {
    const data = Object.assign({}, req.body)
    delete data._id
    if (data.password) data.password = bcrypt.hashSync(data.password, 10)
    else delete data.password
    // 白名單：只允許更新的欄位
    const allowed = ['name', 'no', 'role', 'permissionLevel', 'permissions', 'password', 'enabled', 'defaultTerminal']
    const update = {}
    allowed.forEach(f => { if (data[f] !== undefined) update[f] = data[f] })
    Staff.findOneAndUpdate({ _id: req.body._id }, { $set: update }, { new: true })
      .then(() => res.send('用戶修改成功！'))
      .catch(err => {
        console.log(err)
        res.status(400).send('修改失敗，請重試！')
      })
  }
)

// $route POST api/staff/del
// @desc 删除用户
// @access private
router.post(
  '/del',
  passport.authenticate('jwt', { session: false }), requireLevel(4),
  (req, res) => {
    Staff.findOneAndRemove({ _id: req.body._id })
      .then(() => res.send('用戶刪除成功！'))
      .catch(err => {
        console.log(err)
        res.status(400).send('刪除失敗，請重試！')
      })
  }
)

// $route POST api/staff/changePassword
// @desc 更改員工密碼
// @access public
router.post('/changePassword', async (req, res) => {
  try {
    const { no, oldPassword, newPassword } = req.body
    if (!no || !oldPassword || !newPassword) return res.status(400).send('請填寫完整資料！')
    const staff = await Staff.findOne({ no }).exec()
    if (!staff) return res.status(400).send('員工不存在！')
    const isMatch = await bcrypt.compare(oldPassword, staff.password)
    if (!isMatch) return res.status(400).send('舊密碼不正確！')
    staff.password = bcrypt.hashSync(newPassword, 10)
    await staff.save()
    res.json({ success: true, message: '密碼更改成功！' })
  } catch (err) {
    console.log(err)
    res.status(400).send('更改失敗，請重試！')
  }
})

module.exports = router
