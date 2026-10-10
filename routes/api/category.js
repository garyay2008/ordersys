const express = require('express')
const router = express.Router()
const Category = require('../../models/Category')
const CategoryItem = require('../../models/CategoryItem')
const passport = require('passport')
const Commodity = require('../../models/Commodity')
const Combo = require('../../models/Combo')
const ModCode = require('../../models/ModCode')
const ModCodeCategory = require('../../models/ModCodeCategory')
const socketio = require('../../plugins/SocketIO')

function emitMenuChanged () {
  const io = socketio.getIO()
  if (io) io.emit('menuChanged')
}

function isEffectiveNow (et) {
  if (!et || et.type === 'permanent') return true
  if (et.type === 'disabled') return false
  const now = new Date()
  if (et.type === 'dateRange') {
    if (et.startDate) {
      const start = new Date(et.startDate)
      if (now < start) return false
    }
    if (et.endDate) {
      const end = new Date(et.endDate)
      end.setHours(23, 59, 59, 999)
      if (now > end) return false
    }
  }
  if (et.type === 'weekly') {
    const dow = now.getDay() === 0 ? 7 : now.getDay()
    if (Array.isArray(et.weekdays) && !et.weekdays.includes(dow)) return false
    if (Array.isArray(et.holidays) && et.holidays.length) {
      const today = now.toISOString().slice(0, 10)
      if (et.holidays.includes(today)) return false
    }
  }
  if (et.startTime && et.endTime) {
    const hhmm = now.toTimeString().slice(0, 5)
    if (hhmm < et.startTime || hhmm > et.endTime) return false
  }
  return true
}

const DEFAULT_SERVICE_MODES = ['堂食', '外賣', '自取']

// $route POST api/category/add
// @desc 添加分类信息
// @access private
router.post(
  '/add',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    Category.countDocuments({}).then(count => {
      const category = new Category({
        code: req.body.code || '',
        cName: req.body.cName,
        describe: req.body.describe || '',
        department: req.body.department || '',
        reportGroup: req.body.reportGroup || '',
        no: count,
        active: req.body.active !== false,
        serviceModes: Array.isArray(req.body.serviceModes) && req.body.serviceModes.length ? req.body.serviceModes : DEFAULT_SERVICE_MODES,
        channels: Array.isArray(req.body.channels) && req.body.channels.length ? req.body.channels : ['pos', 'qr'],
        slots: Array.isArray(req.body.slots) ? req.body.slots.filter(s => s && s.name && s.start && s.end) : [],
        modCategories: Array.isArray(req.body.modCategories) ? req.body.modCategories : [],
        effectiveTime: req.body.effectiveTime || { pos: { type: 'permanent' }, qr: { type: 'permanent' } },
        parentId: req.body.parentId || null,
        colorFrom: req.body.colorFrom || '',
        colorTo: req.body.colorTo || '',
        textColor: req.body.textColor || '#ffffff'
      })
      return category.save()
    })
      .then(result => {
        emitMenuChanged()
        res.send('添加成功！')
      })
      .catch(err => res.status(400).send('添加失败，请重试！'))
  }
)

// $route POST api/category/edit
// @desc 修改分类信息
// @access private
router.post(
  '/edit',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const update = {}
    if (req.body.code !== undefined) update.code = req.body.code
    if (req.body.cName !== undefined) update.cName = req.body.cName
    if (req.body.describe !== undefined) update.describe = req.body.describe || ''
    if (req.body.department !== undefined) update.department = req.body.department || ''
    if (req.body.reportGroup !== undefined) update.reportGroup = req.body.reportGroup || ''
    if (req.body.active !== undefined) update.active = !!req.body.active
    if (req.body.serviceModes !== undefined) update.serviceModes = Array.isArray(req.body.serviceModes) && req.body.serviceModes.length ? req.body.serviceModes : DEFAULT_SERVICE_MODES
    if (req.body.channels !== undefined) update.channels = Array.isArray(req.body.channels) && req.body.channels.length ? req.body.channels : ['pos', 'qr']
    if (req.body.slots !== undefined) update.slots = Array.isArray(req.body.slots) ? req.body.slots.filter(s => s && s.name && s.start && s.end) : []
    if (req.body.modCategories !== undefined) update.modCategories = Array.isArray(req.body.modCategories) ? req.body.modCategories : []
    if (req.body.no !== undefined) update.no = req.body.no
    if (req.body.effectiveTime !== undefined) update.effectiveTime = req.body.effectiveTime
    if (req.body.parentId !== undefined) update.parentId = req.body.parentId || null
    if (req.body.colorFrom !== undefined) update.colorFrom = req.body.colorFrom || ''
    if (req.body.colorTo !== undefined) update.colorTo = req.body.colorTo || ''
    if (req.body.textColor !== undefined) update.textColor = req.body.textColor || '#ffffff'
    Category.findOneAndUpdate(
      { _id: req.body._id },
      { $set: update },
      { new: true }
    )
      .then(result => {
        emitMenuChanged()
        res.send('修改成功！')
      })
      .catch(err => res.status(400).send('修改失败，请重试！'))
  }
)

// $route POST api/category/move
// @desc 拖曳搬移分類到新父分類
// @access private
router.post('/move', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { id, newParentId } = req.body
    if (!id) return res.status(400).send('缺少分類 ID')
    if (id === newParentId) return res.status(400).send('不能將分類移動到自身')

    const cat = await Category.findById(id).lean().exec()
    if (!cat) return res.status(404).send('分類不存在')

    if (newParentId) {
      const parent = await Category.findById(newParentId).lean().exec()
      if (!parent) return res.status(404).send('父分類不存在')

      const MAX_DEPTH = 5
      let depth = 1
      let cur = parent
      while (cur && cur.parentId) {
        depth++
        if (depth >= MAX_DEPTH) return res.status(400).send('最多支援 ' + MAX_DEPTH + ' 層分類')
        cur = await Category.findById(cur.parentId).lean().exec()
      }

      let checkId = newParentId
      while (checkId) {
        if (String(checkId) === String(id)) return res.status(400).send('不能移動到自己的子分類（循環引用）')
        const node = await Category.findById(checkId).lean().exec()
        checkId = node ? node.parentId : null
      }
    }

    await Category.findByIdAndUpdate(id, { $set: { parentId: newParentId || null } })
    emitMenuChanged()
    res.send('搬移成功！')
  } catch (err) {
    console.log(err)
    res.status(500).send('搬移失敗，請重試！')
  }
})

// $route POST api/category/reorder
// @desc 更新分類排序
router.post('/reorder', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : []
    await Promise.all(ids.map((id, index) => Category.updateOne({ _id: id }, { $set: { no: index } })))
    emitMenuChanged()
    res.send('排序更新成功！')
  } catch (err) {
    res.status(400).send('排序更新失敗，請重試！')
  }
})

// $route POST api/category/swapOrder
// @desc 交換兩個分類的排序值（no）
// @access private
router.post('/swapOrder', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { id1, id2 } = req.body
    if (!id1 || !id2) return res.status(400).send('缺少分類 ID')
    const [a, b] = await Promise.all([
      Category.findById(id1).lean().exec(),
      Category.findById(id2).lean().exec()
    ])
    if (!a || !b) return res.status(400).send('分類不存在')
    await Category.findByIdAndUpdate(id1, { $set: { no: b.no } })
    await Category.findByIdAndUpdate(id2, { $set: { no: a.no } })
    emitMenuChanged()
    res.send('排序已更新！')
  } catch (err) {
    console.log(err)
    res.status(500).send('排序更新失敗，請重試！')
  }
})

// $route POST api/category/randomColors
// @desc 一鍵為所有分類（含子分類）隨機套用漸變色（HSL 隨機色相，固定飽和度/亮度）
// @access private
function hslToHex (h, s, l) {
  s /= 100
  l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const toHex = x => Math.round(255 * x).toString(16).padStart(2, '0')
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`
}

router.post('/randomColors', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const all = await Category.find({}).lean().exec()
    if (!all.length) return res.send('沒有分類可配色')

    // 子分類繼承父分類色相（略偏移），頂層分類各自隨機色相
    const roots = all.filter(c => c.parentId == null || c.rootOrder != null)
    const rootList = roots.length ? roots : all
    const n = rootList.length

    // 均勻分布色相 + 打亂，避免相鄰分類同色
    const hues = []
    for (let i = 0; i < n; i++) hues.push(Math.round((i * 360 / n) + (Math.random() * 60 - 30)))
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const t = hues[i]; hues[i] = hues[j]; hues[j] = t
    }

    const hueByRoot = new Map()
    rootList.forEach((cat, i) => {
      hueByRoot.set(String(cat._id), ((hues[i] % 360) + 360) % 360)
    })

    // 子分類依父分類色相偏移，維持同類分組視覺一致
    const hueOf = (cat) => {
      let cur = cat
      let depth = 0
      while (cur && depth < 20) {
        const key = String(cur._id)
        if (hueByRoot.has(key)) {
          const base = hueByRoot.get(key)
          return (((base + depth * 18) % 360) + 360) % 360
        }
        cur = all.find(p => p._id && String(p._id) === String(cur.parentId))
        depth++
      }
      return ((Math.random() * 360) % 360 + 360) % 360
    }

    const ops = all.map((cat) => {
      const h = hueOf(cat)
      return {
        updateOne: {
          filter: { _id: cat._id },
          update: { $set: { colorFrom: hslToHex(h, 58, 52), colorTo: hslToHex(h, 58, 40), textColor: '#ffffff' } }
        }
      }
    })
    await Category.bulkWrite(ops)
    emitMenuChanged()
    res.send(`已為 ${all.length} 個分類隨機配色！`)
  } catch (err) {
    console.log(err)
    res.status(500).send('隨機配色失敗，請重試！')
  }
})

// $route POST api/category/del
// @desc 删除分类信息
// @access private
router.post(
  '/del',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const id = req.body._id
      if (!id) return res.status(400).send('缺少分類 ID！')
      const category = await Category.findById(id).lean().exec()
      if (!category) return res.status(400).send('分類不存在！')

      const childCount = await Category.countDocuments({ parentId: id })
      if (childCount > 0) return res.status(400).send('此分類下仍有 ' + childCount + ' 個子分類，請先移除或搬移子分類')

      const itemCount = await CategoryItem.countDocuments({ categoryId: id })
      if (itemCount > 0) return res.status(400).send('此分類下仍有 ' + itemCount + ' 個項目，請先移除內容')

      await Category.findOneAndRemove({ _id: id })
      emitMenuChanged()
      res.send('删除成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send(err.message || '删除失败，请重试！')
    }
  }
)

// $route GET api/category/all?channel=pos|qr
// @desc 获取所有分类信息（可按渠道筛选生效狀態）
// @access public
router.get('/all', (req, res) => {
  const channel = req.query.channel
  Category.find()
    .sort({ no: 1, _id: 1 })
    .lean()
    .then(result => {
      if (!result) {
        return res.json({})
      }
      if (channel && (channel === 'pos' || channel === 'qr')) {
        result = result.filter(c => isEffectiveNow((c.effectiveTime || {})[channel]))
      }
      res.json(result)
    })
    .catch(err => {
      console.log(err)
      res.status(500).send('獲取分類失敗')
    })
})

// $route GET api/category/tree
// @desc 獲取分類樹狀結構
// @access public
router.get('/tree', (req, res) => {
  const channel = req.query.channel
  Category.find()
    .sort({ no: 1, _id: 1 })
    .lean()
    .then(all => {
      if (!all) return res.json([])
      if (channel && (channel === 'pos' || channel === 'qr')) {
        all = all.filter(c => isEffectiveNow((c.effectiveTime || {})[channel]))
      }
      const map = {}
      all.forEach(c => { c.children = []; map[String(c._id)] = c })
      const roots = []
      all.forEach(c => {
        if (c.parentId && map[String(c.parentId)]) {
          map[String(c.parentId)].children.push(c)
        } else {
          roots.push(c)
        }
      })
      res.json(roots)
    })
    .catch(err => {
      console.log(err)
      res.status(500).send('獲取分類樹失敗')
    })
})

// $route GET api/category/:id/children
// @desc 獲取指定分類的子分類
// @access private
router.get('/:id/children', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const children = await Category.find({ parentId: req.params.id }).sort({ no: 1 }).lean().exec()
    res.json(children)
  } catch (err) {
    console.log(err)
    res.status(500).send('獲取子分類失敗！')
  }
})

// $route GET api/category/:id/commodities
// @desc 获取分類內的商品列表（按 commodityOrder 排序）
router.get('/:id/commodities', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean().exec()
    if (!category) return res.status(404).send('分類不存在！')
    const allCommodities = await Commodity.find({
      $or: [
        { categoryId: category._id },
        { category: category.cName }
      ]
    }).lean().exec()
    const order = (category.commodityOrder || []).map(id => String(id))
    const ordered = []
    const remaining = []
    for (const c of allCommodities) {
      const idx = order.indexOf(String(c._id))
      if (idx >= 0) {
        ordered[idx] = c
      } else {
        remaining.push(c)
      }
    }
    const result = ordered.filter(Boolean).concat(remaining)
    res.json(result)
  } catch (err) {
    console.log(err)
    res.status(500).send('獲取商品列表失敗！')
  }
})

// $route POST api/category/:id/saveCommodities
// @desc 保存分類內的商品排序與列表
router.post('/:id/saveCommodities', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const categoryId = req.params.id
    const commodityIds = Array.isArray(req.body.commodityIds) ? req.body.commodityIds : []
    await Category.findByIdAndUpdate(categoryId, { $set: { commodityOrder: commodityIds } })
    emitMenuChanged()
    res.send('商品列表已更新！')
  } catch (err) {
    console.log(err)
    res.status(500).send('保存失敗，請重試！')
  }
})

// $route POST api/category/:id/addCommodity
// @desc 將商品加入分類（設定 categoryId）
router.post('/:id/addCommodity', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean().exec()
    if (!category) return res.status(404).send('分類不存在！')
    const commodity = await Commodity.findById(req.body.commodityId).lean().exec()
    if (!commodity) return res.status(404).send('商品不存在！')
    await Commodity.findByIdAndUpdate(req.body.commodityId, { $set: { categoryId: category._id, category: category.cName } })
    // 追加到 commodityOrder
    const order = (category.commodityOrder || []).map(id => String(id))
    if (!order.includes(String(req.body.commodityId))) {
      order.push(String(req.body.commodityId))
      await Category.findByIdAndUpdate(req.params.id, { $set: { commodityOrder: order } })
    }
    emitMenuChanged()
    res.send('已加入分類！')
  } catch (err) {
    console.log(err)
    res.status(500).send('加入失敗，請重試！')
  }
})

// $route POST api/category/:id/removeCommodity
// @desc 將商品從分類中移除（清空 categoryId）
router.post('/:id/removeCommodity', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const categoryId = req.params.id
    const commodityId = req.body.commodityId
    await Commodity.findByIdAndUpdate(commodityId, { $set: { categoryId: null } })
    const category = await Category.findById(categoryId).lean().exec()
    if (category) {
      const order = (category.commodityOrder || []).map(id => String(id))
      const idx = order.indexOf(String(commodityId))
      if (idx >= 0) order.splice(idx, 1)
      await Category.findByIdAndUpdate(categoryId, { $set: { commodityOrder: order } })
    }
    emitMenuChanged()
    res.send('已從分類移除！')
  } catch (err) {
    console.log(err)
    res.status(500).send('移除失敗，請重試！')
  }
})

// $route GET api/category/:id/combos
// @desc 获取分類內的套餐列表
router.get('/:id/combos', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean().exec()
    if (!category) return res.status(404).send('分類不存在！')
    const combos = await Combo.find({ category: category.cName }).lean().exec()
    res.json(combos)
  } catch (err) {
    console.log(err)
    res.status(500).send('獲取套餐列表失敗！')
  }
})

// $route POST api/category/:id/addCombo
// @desc 將套餐加入分類（設定 category 名稱）
router.post('/:id/addCombo', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean().exec()
    if (!category) return res.status(404).send('分類不存在！')
    const combo = await Combo.findById(req.body.comboId).lean().exec()
    if (!combo) return res.status(404).send('套餐不存在！')
    await Combo.findByIdAndUpdate(req.body.comboId, { $set: { category: category.cName } })
    emitMenuChanged()
    res.send('已加入分類！')
  } catch (err) {
    console.log(err)
    res.status(500).send('加入失敗，請重試！')
  }
})

// $route POST api/category/:id/removeCombo
// @desc 將套餐從分類中移除（清空 category）
router.post('/:id/removeCombo', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    await Combo.findByIdAndUpdate(req.body.comboId, { $set: { category: '' } })
    emitMenuChanged()
    res.send('已從分類移除！')
  } catch (err) {
    console.log(err)
    res.status(500).send('移除失敗，請重試！')
  }
})

const MAX_DEPTH = 5

async function getCategoryDepth (parentId) {
  let depth = 1
  let cur = parentId ? await Category.findById(parentId).lean().exec() : null
  while (cur && cur.parentId) {
    depth++
    cur = await Category.findById(cur.parentId).lean().exec()
  }
  return depth
}

async function isInSubtree (ancestorId, targetId) {
  let checkId = targetId
  while (checkId) {
    if (String(checkId) === String(ancestorId)) return true
    const node = await Category.findById(checkId).lean().exec()
    checkId = node ? node.parentId : null
  }
  return false
}

// $route GET api/category/:id/items
// @desc 獲取分類內混合列表（子分類+商品+套餐）按 sortOrder 排序
router.get('/:id/items', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const categoryId = req.params.id
    const relations = await CategoryItem.find({ categoryId }).sort({ sortOrder: 1 }).lean().exec()

    const childCategories = []
    const commodityIds = []
    const comboIds = []
    const modCodeIds = []
    const modCodeCategoryIds = []
    for (const r of relations) {
      if (r.targetType === 'category') childCategories.push(r.targetId)
      else if (r.targetType === 'commodity') commodityIds.push(r.targetId)
      else if (r.targetType === 'combo') comboIds.push(r.targetId)
      else if (r.targetType === 'modcode') modCodeIds.push(r.targetId)
      else if (r.targetType === 'modcodecategory') modCodeCategoryIds.push(r.targetId)
    }

    const [cats, commodities, combos, modcodes, modcodecategories] = await Promise.all([
      childCategories.length ? Category.find({ _id: { $in: childCategories } }).lean().exec() : [],
      commodityIds.length ? Commodity.find({ _id: { $in: commodityIds } }).lean().exec() : [],
      comboIds.length ? Combo.find({ _id: { $in: comboIds } }).lean().exec() : [],
      modCodeIds.length ? ModCode.find({ _id: { $in: modCodeIds } }).lean().exec() : [],
      modCodeCategoryIds.length ? ModCodeCategory.find({ _id: { $in: modCodeCategoryIds } }).lean().exec() : []
    ])

    const catMap = {}
    cats.forEach(c => { catMap[String(c._id)] = { ...c, _itemType: 'category' } })
    const comMap = {}
    commodities.forEach(c => { comMap[String(c._id)] = { ...c, _itemType: 'commodity' } })
    const comboMap = {}
    combos.forEach(c => { comboMap[String(c._id)] = { ...c, _itemType: 'combo' } })
    const modCodeMap = {}
    modcodes.forEach(c => { modCodeMap[String(c._id)] = { ...c, _itemType: 'modcode' } })
    const modCodeCategoryMap = {}
    modcodecategories.forEach(c => { modCodeCategoryMap[String(c._id)] = { ...c, _itemType: 'modcodecategory' } })

    const result = []
    for (const r of relations) {
      const rid = String(r.targetId)
      if (r.targetType === 'category' && catMap[rid]) result.push(catMap[rid])
      else if (r.targetType === 'commodity' && comMap[rid]) result.push(comMap[rid])
      else if (r.targetType === 'combo' && comboMap[rid]) result.push(comboMap[rid])
      else if (r.targetType === 'modcode' && modCodeMap[rid]) result.push(modCodeMap[rid])
      else if (r.targetType === 'modcodecategory' && modCodeCategoryMap[rid]) result.push(modCodeCategoryMap[rid])
    }
    res.json(result)
  } catch (err) {
    console.log(err)
    res.status(500).send('獲取混合列表失敗！')
  }
})

// $route POST api/category/:id/saveItems
// @desc 批量保存混合排序（拖曳後）
router.post('/:id/saveItems', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const categoryId = req.params.id
    const items = Array.isArray(req.body.items) ? req.body.items : []
    await CategoryItem.deleteMany({ categoryId })
    const docs = items.map((item, index) => ({
      categoryId,
      targetId: item.targetId,
      targetType: item.targetType,
      sortOrder: index
    }))
    if (docs.length) await CategoryItem.insertMany(docs)
    emitMenuChanged()
    res.send('排序已保存！')
  } catch (err) {
    console.log(err)
    res.status(500).send('保存失敗，請重試！')
  }
})

// $route POST api/category/:id/addItem
// @desc 將子分類/商品/套餐加入混合列表
router.post('/:id/addItem', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const categoryId = req.params.id
    const { targetType, targetId } = req.body
    if (!targetType || !targetId) return res.status(400).send('參數不完整')

    if (targetType === 'category') {
      if (String(targetId) === String(categoryId)) return res.status(400).send('不能將自身加入')
      const depth = await getCategoryDepth(targetId)
      const curDepth = await getCategoryDepth(categoryId)
      if (curDepth + depth >= MAX_DEPTH) return res.status(400).send('超過最大 ' + MAX_DEPTH + ' 層限制')
      if (await isInSubtree(targetId, categoryId)) return res.status(400).send('循環引用：目標是自身的祖先')
    }

    const exists = await CategoryItem.findOne({ categoryId, targetId, targetType }).lean().exec()
    if (exists) return res.status(400).send('此項目已在列表中')

    const count = await CategoryItem.countDocuments({ categoryId })
    const doc = new CategoryItem({ categoryId, targetId, targetType, sortOrder: count })
    await doc.save()
    emitMenuChanged()
    res.send('已加入！')
  } catch (err) {
    console.log(err)
    res.status(500).send('加入失敗，請重試！')
  }
})

// $route POST api/category/:id/removeItem
// @desc 從混合列表移除項目
router.post('/:id/removeItem', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { targetId, targetType } = req.body
    await CategoryItem.findOneAndRemove({ categoryId: req.params.id, targetId, targetType })
    emitMenuChanged()
    res.send('已移除！')
  } catch (err) {
    console.log(err)
    res.status(500).send('移除失敗，請重試！')
  }
})

// $route POST api/category/:id/migrateItems
// @desc 從舊的 commodityOrder + Combo.category 遷移到 CategoryItem
router.post('/:id/migrateItems', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean().exec()
    if (!category) return res.status(404).send('分類不存在')

    const existing = await CategoryItem.countDocuments({ categoryId: req.params.id })
    if (existing > 0) return res.send('已有混合資料，無需遷移')

    const docs = []
    let sort = 0

    const children = await Category.find({ parentId: req.params.id }).lean().exec()
    for (const child of children) {
      docs.push({ categoryId: req.params.id, targetId: child._id, targetType: 'category', sortOrder: sort++ })
    }

    const commodityOrder = category.commodityOrder || []
    for (const cid of commodityOrder) {
      docs.push({ categoryId: req.params.id, targetId: cid, targetType: 'commodity', sortOrder: sort++ })
    }

    const combos = await Combo.find({ category: category.cName }).lean().exec()
    for (const combo of combos) {
      docs.push({ categoryId: req.params.id, targetId: combo._id, targetType: 'combo', sortOrder: sort++ })
    }

    if (docs.length) await CategoryItem.insertMany(docs)
    emitMenuChanged()
    res.send('遷移完成，共 ' + docs.length + ' 項')
  } catch (err) {
    console.log(err)
    res.status(500).send('遷移失敗，請重試！')
  }
})

// $route POST api/category/migrateAllItems
// @desc 一次性遷移所有分類的舊資料到 CategoryItem 表
// @access private
router.post('/migrateAllItems', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const allCategories = await Category.find().lean().exec()
    const CategoryItemModel = require('../../models/CategoryItem')
    let totalMigrated = 0
    let skipped = 0

    for (const category of allCategories) {
      const existing = await CategoryItemModel.countDocuments({ categoryId: category._id })
      if (existing > 0) {
        skipped++
        continue
      }

      const docs = []
      let sort = 0

      const children = await Category.find({ parentId: category._id }).lean().exec()
      for (const child of children) {
        docs.push({ categoryId: category._id, targetId: child._id, targetType: 'category', sortOrder: sort++ })
      }

      const commodityOrder = category.commodityOrder || []
      for (const cid of commodityOrder) {
        docs.push({ categoryId: category._id, targetId: cid, targetType: 'commodity', sortOrder: sort++ })
      }

      const combos = await Combo.find({ category: category.cName }).lean().exec()
      for (const combo of combos) {
        docs.push({ categoryId: category._id, targetId: combo._id, targetType: 'combo', sortOrder: sort++ })
      }

      if (docs.length) {
        await CategoryItemModel.insertMany(docs)
        totalMigrated += docs.length
      }
    }

    res.send('遷移完成！共處理 ' + allCategories.length + ' 個分類，遷移 ' + totalMigrated + ' 項，跳過 ' + skipped + ' 個（已有資料）')
  } catch (err) {
    console.log(err)
    res.status(500).send('批量遷移失敗：' + err.message)
  }
})

// $route GET api/category/:id/depth
// @desc 獲取指定分類的當前深度
router.get('/:id/depth', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const depth = await getCategoryDepth(req.params.id)
    res.json({ depth, maxDepth: MAX_DEPTH, canAdd: depth < MAX_DEPTH })
  } catch (err) {
    console.log(err)
    res.status(500).send('獲取深度失敗')
  }
})

module.exports = router
