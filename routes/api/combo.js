const express = require('express')
const router = express.Router()
const passport = require('passport')
const Combo = require('../../models/Combo')
const AddonGroup = require('../../models/AddonGroup')
const socketio = require('../../plugins/SocketIO')

function emitMenuChanged () {
  const io = socketio.getIO()
  if (io) io.emit('menuChanged')
}

// 驗證收入分帳：總和必須等於套餐價格（有分帳時）
function validateSplit (body) {
  const split = (Array.isArray(body.departmentSplit) ? body.departmentSplit : [])
    .filter(d => d && d.department && String(d.department).trim() !== '')
  if (!split.length) return null
  const price = Number(body.price) || 0
  const total = split.reduce((s, d) => s + (Number(d.amount) || 0), 0)
  const diff = Math.round((price - total) * 100) / 100
  if (Math.abs(diff) > 0.005) {
    const dir = diff > 0 ? '未分完' : '超出'
    return `收入分帳總和（$${Math.round(total * 100) / 100}）與套餐價格（$${price}）不符，差額 $${Math.abs(diff)}（${dir}），請修正後再存入`
  }
  return null
}

// $route GET api/combo/all
// @desc 获取所有套餐
// @access private
router.get(
  '/all',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    Combo.find()
      .sort({ date: -1 })
      .then(result => res.json(result))
      .catch(err => {
        console.log(err)
        res.status(400).send('获取套餐失败！')
      })
  }
)

// $route POST api/combo/add
// @desc 添加套餐
// @access private
router.post(
  '/add',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const reason = validateSplit(req.body)
    if (reason) {
      res.status(400).send(reason)
      return
    }
    const combo = new Combo(req.body)
    combo
      .save()
      .then(() => { emitMenuChanged(); res.send('套餐添加成功！') })
      .catch(err => {
        console.log(err)
        res.status(400).send('添加失败，请重试！')
      })
  }
)

// $route POST api/combo/edit
// @desc 修改套餐
// @access private
router.post(
  '/edit',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const reason = validateSplit(req.body)
    if (reason) {
      res.status(400).send(reason)
      return
    }
    const _id = req.body._id
    const data = Object.assign({}, req.body)
    delete data._id
    Combo.findOneAndUpdate({ _id }, { $set: data }, { new: true })
      .then(() => { emitMenuChanged(); res.send('套餐修改成功！') })
      .catch(err => {
        console.log(err)
        res.status(400).send('修改失败，请重试！')
      })
  }
)

// $route POST api/combo/del
// @desc 删除套餐
// @access private
router.post(
  '/del',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    Combo.findOneAndRemove({ _id: req.body._id })
      .then(() => { emitMenuChanged(); res.send('套餐删除成功！') })
      .catch(err => {
        console.log(err)
        res.status(400).send('删除失败，请重试！')
      })
  }
)

// 將可重用跟餐組（AddonGroup）轉為點餐端所需的分組結構（唯讀）
function materializeAddonGroup (g) {
  if (!g) return null
  return {
    name: g.name || '',
    min: g.min != null ? g.min : 1,
    max: g.max != null ? g.max : 1,
    allowRepeat: !!g.allowRepeat,
    fixed: false,
    station: g.station || '',
    uniformUpgradeEnabled: !!g.uniformUpgradeEnabled,
    uniformUpgrade: Number(g.uniformUpgrade) || 0,
    groupPrice: Number(g.groupPrice) || 0,
    items: (g.items || []).map(i => ({
      commodityId: i.commodityId || '',
      name: i.name || '',
      price: i.price || 0,
      upgradePrice: i.upgradePrice || 0,
      modCategories: i.modCategories || []
    }))
  }
}

// 整組同價：uniformUpgradeEnabled 時，將分組內所有品項的加價統一為 uniformUpgrade
// 並將 addonGroupIds 引用的跟餐組展開為額外分組
// 僅在點餐端呈現（唯讀），不寫回資料庫；後台 /api/combo/all 仍回傳原始分組結構供編輯
function materializeCombo (combo, addonGroupMap) {
  if (!combo) return combo
  let groups = Array.isArray(combo.groups) ? combo.groups : []
  const addonIds = Array.isArray(combo.addonGroupIds) ? combo.addonGroupIds : []
  addonIds.forEach(id => {
    const g = addonGroupMap && addonGroupMap[String(id)]
    if (g) groups.push(materializeAddonGroup(g))
  })
  groups = groups.map(g => {
    if (!g || !g.uniformUpgradeEnabled) return g
    const up = Number(g.uniformUpgrade) || 0
    return Object.assign({}, g, { items: (g.items || []).map(i => Object.assign({}, i, { upgradePrice: up })) })
  })
  return Object.assign({}, combo, { groups })
}

// $route GET api/combo/menu
// @desc 点餐端获取在售套餐（?channel=pos|qr 可依渠道過濾顯示）
// @access public
router.get('/menu', async (req, res) => {
  const channel = req.query.channel === 'qr' ? 'qr' : (req.query.channel === 'pos' ? 'pos' : null)
  const query = { soldOut: false }
  if (channel === 'qr') query.showOnQr = { $ne: false }
  else if (channel === 'pos') query.showOnPos = { $ne: false }
  try {
    const [result, addons] = await Promise.all([
      Combo.find(query).sort({ date: -1 }).lean().exec(),
      AddonGroup.find().lean().exec()
    ])
    const addonGroupMap = {}
    addons.forEach(a => { addonGroupMap[String(a._id)] = a })
    res.json(result.map(c => materializeCombo(c, addonGroupMap)))
  } catch (err) {
    console.log(err)
    res.json([])
  }
})

module.exports = router
