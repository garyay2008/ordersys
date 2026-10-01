const express = require('express')
const router = express.Router()
const Commodity = require('../../models/Commodity')
const Category = require('../../models/Category')
const CategoryItem = require('../../models/CategoryItem')
const Combo = require('../../models/Combo')
const AddonGroup = require('../../models/AddonGroup')
const ModCode = require('../../models/ModCode')
const ModCodeCategory = require('../../models/ModCodeCategory')
const PosSetting = require('../../models/PosSetting')
const passport = require('passport')
const formidable = require('formidable')
const fs = require('fs')
const path = require('path')
const moment = require('moment')
const config = require('../../config/config')
const AuditLog = require('../../models/AuditLog')
const socketio = require('../../plugins/SocketIO')

function emitMenuChanged () {
  const io = socketio.getIO()
  if (io) io.emit('menuChanged')
}

// 從認證上下文提取操作者（員工 no/name；管理員 account/name）
function operatorOf (req) {
  const u = req.user
  if (!u) return { staffNo: '', staffName: '' }
  if (u.no !== undefined) return { staffNo: u.no || '', staffName: u.name || '' }
  return { staffNo: u.account || u.username || '', staffName: u.name || '' }
}

// 依營業日截止時間計算目前營業日期（YYYY-MM-DD）
function businessDate (cutoff) {
  const now = moment()
  const [h, m] = String(cutoff || '03:00').split(':').map(Number)
  const cutoffMinutes = (h || 0) * 60 + (m || 0)
  const currentMinutes = now.hour() * 60 + now.minute()
  return currentMinutes < cutoffMinutes ? now.clone().subtract(1, 'day').format('YYYY-MM-DD') : now.format('YYYY-MM-DD')
}

// 沽清每日自動重置：新營業日時，把手動沽清（soldOutDate 為過去日期）的品項重售
async function dailySoldOutReset () {
  try {
    const setting = await PosSetting.findOne().lean().exec()
    if (!setting || !setting.soldOutDailyReset) return
    const today = businessDate(setting.businessDayCutoff)
    const res = await Commodity.updateMany(
      { soldOut: true, soldOutDate: { $nin: ['', today] } },
      { $set: { soldOut: false, soldOutDate: '' } }
    ).exec()
    if (res && res.nModified) console.log('[沽清] 每日自動重置：已重售 ' + res.nModified + ' 筆')
  } catch (e) {
    console.log('[沽清] 每日自動重置失敗：' + e.message)
  }
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

// 確保商品在 CategoryItem 表中有對應的混合排序記錄（分類已有 CategoryItem 時，菜單只顯示有記錄的商品）
async function ensureCategoryItem (commodityId, categoryId) {
  if (!categoryId) return
  const existing = await CategoryItem.findOne({ targetId: commodityId, targetType: 'commodity' }).lean().exec()
  if (existing) {
    if (String(existing.categoryId) !== String(categoryId)) {
      const count = await CategoryItem.countDocuments({ categoryId }).exec()
      await CategoryItem.updateOne({ _id: existing._id }, { $set: { categoryId, sortOrder: count } })
    }
    return
  }
  const count = await CategoryItem.countDocuments({ categoryId }).exec()
  await CategoryItem.create({ categoryId, targetId: commodityId, targetType: 'commodity', sortOrder: count })
}

// 全局貨價跳價：入單計在菜單載入時依當下時間套用規格價
function applyMenuJumpPrice (food, now, holidays, rules, mode) {
  if (!food || !Array.isArray(rules) || !rules.length) return
  const jp = Commodity.resolveJumpPrice(food, now, holidays, 'order', rules, mode)
  if (jp != null) {
    food.price = jp.price
    food.jumpPriceApplied = true
    food.jumpSpecIndex = jp.specIndex
    food.jumpSpecName = jp.specName
  }
}

// 將貨品引用的跟餐組（addonGroupIds）展開為 food.addonGroups，供 POS 貨品做撞餐時自動帶出
function attachAddonGroups (food, addonGroupMap) {
  if (!food || !addonGroupMap) return
  const ids = Array.isArray(food.addonGroupIds) ? food.addonGroupIds : []
  const groups = ids
    .map(id => addonGroupMap[String(id)])
    .filter(Boolean)
    .map(g => ({
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
    }))
  if (groups.length) food.addonGroups = groups
  else delete food.addonGroups
}

// $route POST api/commodity/add
// @desc 添加商品信息
// @access private
router.post('/add', async (req, res) => {
  try {
    const data = req.body
    if (data.code && data.code.trim()) {
      const exists = await Commodity.findOne({ code: data.code.trim() }).lean().exec()
      if (exists) return res.status(400).send('商品編號已存在，請使用其他編號！')
    }
    if (!data.categoryId && data.category) {
      const cat = await Category.findOne({ cName: data.category }).lean().exec()
      if (cat) data.categoryId = cat._id
    }
    const newCommodity = new Commodity(data)
    await newCommodity.save()
    await ensureCategoryItem(newCommodity._id, newCommodity.categoryId)
    emitMenuChanged()
    res.send('商品添加成功！')
  } catch (err) {
    res.status(400).send('商品添加失败，请重试！')
  }
})

// $route POST api/commodity/edit
// @desc 修改商品信息
// @access private
router.post(
  '/edit',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const data = req.body
      if (data.code && data.code.trim()) {
        const exists = await Commodity.findOne({ code: data.code.trim(), _id: { $ne: data._id } }).lean().exec()
        if (exists) return res.status(400).send('商品編號已存在，請使用其他編號！')
      }
      if (!data.categoryId && data.category) {
        const cat = await Category.findOne({ cName: data.category }).lean().exec()
        if (cat) data.categoryId = cat._id
      }
      await Commodity.findOneAndUpdate({ _id: data._id }, { $set: data }, { new: true })
      await ensureCategoryItem(data._id, data.categoryId)
      emitMenuChanged()
      res.send('商品修改成功！')
    } catch (err) {
      res.status(400).send('商品修改失败，请重试！')
    }
  }
)

// $route POST api/commodity/del
// @desc 删除商品信息
// @access private
router.post(
  '/del',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      await Commodity.findOneAndRemove({ _id: req.body._id })
      await CategoryItem.findOneAndRemove({ targetId: req.body._id, targetType: 'commodity' })
      emitMenuChanged()
      res.send('删除商品成功！')
    } catch (err) {
      res.status(400).send('删除商品失败，请重试！')
    }
  }
)

// $route POST api/commodity/get
// @desc 获取商品信息，返回json数据
// @access private
router.post(
  '/get',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      let page = req.body
      if (page.name) {
        const reg = new RegExp(`^.*${page.name}.*$`)
        page.name = { $or: [{ name: reg }, { code: reg }] }
      } else {
        page.name = {}
      }
      const query = page.name
      const result = await Commodity.aggregate([
        { $match: query },
        { $addFields: { _pluEmpty: { $cond: [{ $eq: [{ $ifNull: ['$plu', ''] }, ''] }, 1, 0] } } },
        { $sort: { _pluEmpty: 1, plu: 1, _id: 1 } },
        { $skip: page.size * (page.index - 1) },
        { $limit: page.size }
      ]).exec()
      const total = await Commodity.countDocuments(query).exec()
      res.json({ result, total })
    } catch (err) {
      console.log(err)
    }
  }
)

// $route POST api/commodity/upload
// @desc 上传商品照片，返回json数据
// @access private
router.post(
  '/upload',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    let form = new formidable.IncomingForm()
    const goodsDir = path.join(config.publicDir, 'goods')
    fs.mkdirSync(goodsDir, { recursive: true })
    form.uploadDir = goodsDir
    form.parse(req, (err, fields, files) => {
      fs.rename(
        files.file.path,
        path.join(goodsDir, files.file.name),
        err => {
          if (err) throw err
          let url = `http://${req.headers.host}/goods/${files.file.name}`
          res.json({ status: 'ok', url })
        }
      )
    })
  }
)

// $route POST api/commodity/soldout
// @desc 沽清/重售/設定限量庫存（POS 前台使用）
// @access private（寫入操作稽核，需帶員工 JWT）
router.post(
  '/soldout',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const update = {}
      if (req.body.soldOut !== undefined) update.soldOut = !!req.body.soldOut
      if (req.body.stock !== undefined) {
        update.stock = Number(req.body.stock)
        // 限量庫存歸零時自動沽清（庫存 > 0 時自動重售）
        if (req.body.soldOut === undefined) {
          update.soldOut = update.stock <= 0
        }
      }
      // 手動沽清：記錄沽清日期供「每日自動重置」使用；重售時清空
      if (update.soldOut === true) {
        const setting = await PosSetting.findOne().lean().exec()
        update.soldOutDate = businessDate(setting && setting.businessDayCutoff)
      } else if (update.soldOut === false) {
        update.soldOutDate = ''
      }
      if (!Object.keys(update).length) {
        res.status(400).send('無需更新的欄位！')
        return
      }
      const com = await Commodity.findById(req.body._id).lean().exec()
      await Commodity.updateOne({ _id: req.body._id }, { $set: update }).exec()

      // 操作稽核
      try {
        const op = operatorOf(req)
        let detail = (com && com.name) || req.body._id
        if (update.soldOut !== undefined) detail += update.soldOut ? ' → 沽清' : ' → 重售'
        if (update.stock !== undefined) detail += '，庫存 ' + update.stock
        await AuditLog.create({
          staffNo: op.staffNo,
          staffName: op.staffName,
          action: 'soldout',
          actionLabel: '沽清設定',
          detail,
          date: new Date()
        })
      } catch (e) {
        console.log('[AuditLog] 沽清寫入失敗：' + e.message)
      }

      emitMenuChanged()
      res.send('已更新！')
    } catch (err) {
      console.log(err)
      res.status(400).send('更新失敗，請重試！')
    }
  }
)

// $route GET api/commodity/list
// @desc 輕量商品列表（複印價格下拉選單用）
// @access private
router.get(
  '/list',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const list = await Commodity.find({})
        .select('_id name plu code price specs bundleGroupId')
        .sort({ plu: 1, _id: 1 })
        .lean()
        .exec()
      res.json(list)
    } catch (err) {
      console.log(err)
      res.status(400).send('獲取商品列表失敗')
    }
  }
)

// $route get api/commodity/menu
// @desc 用户页面获取所有商品信息，返回json数据
// @access public
// 渠道分流：?channel=pos（收銀，預設）| ?channel=qr（客人手機）
// 過濾規則：分類級 channels（AND 商品級 showOnX），舊資料缺欄位視為適用所有渠道
// 使用 CategoryItem 混合排序：子分類/商品/套餐可自由交叉
router.get('/menu', async (req, res) => {
  try {
    await dailySoldOutReset()
    const mode = req.query.mode || '堂食'
    const channel = req.query.channel === 'qr' ? 'qr' : 'pos'
    const categoryResult = await Category.find({
      $and: [
        {
          active: { $ne: false },
          $or: [
            { serviceModes: mode },
            { serviceModes: { $exists: false } },
            { serviceModes: { $size: 0 } }
          ]
        },
        {
          $or: [
            { channels: channel },
            { channels: { $exists: false } },
            { channels: { $size: 0 } }
          ]
        }
      ]
    })
      .sort({ no: 1, _id: 1 })
      .exec()
    const filtered = categoryResult.filter(c => isEffectiveNow((c.effectiveTime || {})[channel]))

    const now = new Date()
    const hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
    let publicHolidays = []
    let jumpPriceRules = []
    let qrCategoryOrder = []
    try {
      const setting = await PosSetting.findOne().lean().exec()
      publicHolidays = (setting && setting.publicHolidays) || []
      jumpPriceRules = (setting && setting.jumpPriceRules) || []
      // 貨價跳價總開關關閉時，菜單不套用任何跳價
      if (setting && setting.jumpPriceEnabled === false) jumpPriceRules = []
      qrCategoryOrder = (setting && Array.isArray(setting.qrCategoryOrder)) ? setting.qrCategoryOrder : []
    } catch (e) {
      console.log('[Menu] 讀取跳價設定失敗：' + e.message)
    }

    const showField = channel === 'qr' ? 'showOnQr' : 'showOnPos'
    // 浮動價格（時價）商品在 QR 客人自助點餐隱藏（客人無法輸入浮動價）
    const hideOpenPriceOnQr = channel === 'qr'

    const categoryIds = filtered.map(c => String(c._id))
    const categoryItemMap = {}
    if (categoryIds.length) {
      const allItems = await CategoryItem.find({ categoryId: { $in: categoryIds } }).sort({ sortOrder: 1 }).lean().exec()
      for (const item of allItems) {
        const cid = String(item.categoryId)
        if (!categoryItemMap[cid]) categoryItemMap[cid] = []
        categoryItemMap[cid].push(item)
      }
    }

    const allCatIds = []
    const allCommodityIds = []
    const allComboIds = []
    const allModCodeIds = []
    const allModCodeCategoryIds = []
    for (const cid of categoryIds) {
      const items = categoryItemMap[cid] || []
      for (const item of items) {
        if (item.targetType === 'category') allCatIds.push(item.targetId)
        else if (item.targetType === 'commodity') allCommodityIds.push(item.targetId)
        else if (item.targetType === 'combo') allComboIds.push(item.targetId)
        else if (item.targetType === 'modcode') allModCodeIds.push(item.targetId)
        else if (item.targetType === 'modcodecategory') allModCodeCategoryIds.push(item.targetId)
      }
    }

    const [childCats, allCommodities, allCombos, allModCodes, allModCodeCategories] = await Promise.all([
      allCatIds.length ? Category.find({ _id: { $in: allCatIds }, active: { $ne: false } }).lean().exec() : [],
      allCommodityIds.length ? Commodity.find({ _id: { $in: allCommodityIds } }).lean().exec() : [],
      allComboIds.length ? Combo.find({ _id: { $in: allComboIds } }).lean().exec() : [],
      allModCodeIds.length ? ModCode.find({ _id: { $in: allModCodeIds } }).lean().exec() : [],
      allModCodeCategoryIds.length ? ModCodeCategory.find({ _id: { $in: allModCodeCategoryIds } }).lean().exec() : []
    ])

    const childCatMap = {}
    childCats.forEach(c => { childCatMap[String(c._id)] = c })
    const commodityMap = {}
    allCommodities.forEach(c => { commodityMap[String(c._id)] = c })
    const comboMap = {}
    allCombos.forEach(c => { comboMap[String(c._id)] = c })
    const modCodeMap = {}
    allModCodes.forEach(c => { modCodeMap[String(c._id)] = c })
    const modCodeCategoryMap = {}
    allModCodeCategories.forEach(c => { modCodeCategoryMap[String(c._id)] = c })

    // 收集貨品引用的跟餐組，展開為 food.addonGroups（貨品做撞餐）
    const addonGroupIds = []
    allCommodities.forEach(c => { (c.addonGroupIds || []).forEach(id => addonGroupIds.push(id)) })
    const addonGroups = addonGroupIds.length ? await AddonGroup.find({ _id: { $in: addonGroupIds } }).lean().exec() : []
    const addonGroupMap = {}
    addonGroups.forEach(a => { addonGroupMap[String(a._id)] = a })

    const childCatByParent = {}
    for (const cid of categoryIds) {
      childCatByParent[cid] = (categoryItemMap[cid] || [])
        .filter(r => r.targetType === 'category' && childCatMap[String(r.targetId)] && isEffectiveNow((childCatMap[String(r.targetId)].effectiveTime || {})[channel]))
        .map(r => ({
          name: childCatMap[String(r.targetId)].cName,
          type: childCatMap[String(r.targetId)].no || 0,
          foods: [],
          slots: [],
          _id: r.targetId,
          _isSubCategory: true
        }))
    }

    const legacyMenu = []
    for (const category of filtered) {
      const existingEntry = (childCatByParent[String(category._id)] || [])
      const menuEntry = { name: category.cName, type: category.no, code: category.code || '', foods: [], slots: category.slots || [], _id: category._id, _subCategories: existingEntry, parentId: category.parentId ? String(category.parentId) : null, rootOrder: category.rootOrder == null ? null : category.rootOrder, colorFrom: category.colorFrom || '', colorTo: category.colorTo || '', textColor: category.textColor || '#ffffff' }
      legacyMenu.push(menuEntry)
    }

    for (const category of legacyMenu) {
      const catId = String(category._id)
      const items = categoryItemMap[catId] || []
      category.items = []
      const seenItems = new Set()
      for (const item of items) {
        const itemKey = item.targetType + ':' + String(item.targetId)
        if (seenItems.has(itemKey)) continue
        seenItems.add(itemKey)
        if (item.targetType === 'category') {
          const child = childCatMap[String(item.targetId)]
          if (child && isEffectiveNow((child.effectiveTime || {})[channel])) {
            category.items.push({
              _id: child._id,
              _itemType: 'category',
              name: child.cName,
              code: child.code || '',
              colorFrom: child.colorFrom || '',
              colorTo: child.colorTo || '',
              textColor: child.textColor || '#ffffff'
            })
          }
        } else if (item.targetType === 'commodity') {
          const commodity = commodityMap[String(item.targetId)]
          if (commodity && commodity[showField] !== false && !(hideOpenPriceOnQr && commodity.openPrice)) {
            const food = Object.assign({}, commodity)
            food.categoryCode = category.code || ''
            food._itemType = 'commodity'
            applyMenuJumpPrice(food, now, publicHolidays, jumpPriceRules, mode)
            attachAddonGroups(food, addonGroupMap)
            category.foods.push(food)
            category.items.push(food)
          }
        } else if (item.targetType === 'combo') {
          const combo = comboMap[String(item.targetId)]
          if (combo && !combo.soldOut && combo[showField] !== false) {
            const comboFood = {
              _id: combo._id,
              name: combo.name,
              describe: combo.describe || '',
              category: category.name,
              categoryId: category._id,
              price: combo.price,
              img: combo.img || '',
              isDiscount: false,
              soldOut: false,
              _isCombo: true,
              _comboData: combo,
              _itemType: 'combo'
            }
            category.foods.push(comboFood)
            category.items.push(comboFood)
          }
        } else if (item.targetType === 'modcode') {
          const mod = modCodeMap[String(item.targetId)]
          if (mod && (!mod.channels || !mod.channels.length || mod.channels.indexOf(channel) >= 0)) {
            const modFood = {
              _id: mod._id,
              name: mod.name,
              code: mod.code || '',
              category: category.name,
              categoryId: category._id,
              price: mod.price || 0,
              img: '',
              isDiscount: false,
              soldOut: false,
              station: mod.station || '',
              plu: mod.code || '',
              modCategories: [],
              _isModCode: true,
              _itemType: 'modcode'
            }
            category.foods.push(modFood)
            category.items.push(modFood)
          }
        } else if (item.targetType === 'modcodecategory') {
          const modCat = modCodeCategoryMap[String(item.targetId)]
          if (modCat) {
            const modCatItem = {
              _id: modCat._id,
              name: modCat.name,
              code: modCat.code || '',
              category: category.name,
              categoryId: category._id,
              price: 0,
              img: '',
              soldOut: false,
              _isModCategory: true,
              _itemType: 'modcodecategory'
            }
            category.foods.push(modCatItem)
            category.items.push(modCatItem)
          }
        }
      }
    }

    const hasCategoryItems = Object.keys(categoryItemMap).length > 0
    if (!hasCategoryItems) {
      const commodityResult = await Commodity.find().lean().exec()
      for (const category of legacyMenu) {
        const cat = filtered.find(c => String(c._id) === String(category._id))
        if (!cat) continue
        for (const commodity of commodityResult) {
          const matchByRef = commodity.categoryId && String(commodity.categoryId) === String(category._id)
          const matchByName = !commodity.categoryId && commodity.category === category.name
          if ((matchByRef || matchByName) && commodity[showField] !== false && !(hideOpenPriceOnQr && commodity.openPrice)) {
            const food = Object.assign({}, commodity)
            food.categoryCode = category.code || ''
            food._itemType = 'commodity'
            applyMenuJumpPrice(food, now, publicHolidays, jumpPriceRules, mode)
            attachAddonGroups(food, addonGroupMap)
            category.foods.push(food)
            category.items.push(food)
          }
        }
      }
    }

    let result = []
    const childIdSet = new Set()
    for (const group of legacyMenu) {
      const children = (group._subCategories || []).map(s => String(s._id))
      children.forEach(id => childIdSet.add(id))
      result.push({
        _id: String(group._id),
        name: group.name,
        type: group.type,
        code: group.code || '',
        foods: group.foods,
        items: group.items || [],
        children,
        isRoot: false,
        parentId: group.parentId || null,
        rootOrder: group.rootOrder == null ? null : group.rootOrder,
        slotActive: false,
        slotName: '',
        colorFrom: group.colorFrom || '',
        colorTo: group.colorTo || '',
        textColor: group.textColor || '#ffffff'
      })
    }

    const hasRootOrder = result.some(g => g.rootOrder != null)
    result.forEach(group => {
      group.isRoot = hasRootOrder ? (group.rootOrder != null) : !childIdSet.has(group._id)
      const cat = filtered.find(c => String(c._id) === group._id)
      if (cat) {
        const active = (cat.slots || []).find(s => s && s.start && s.end && hm >= s.start && hm <= s.end)
        if (active) {
          group.slotActive = true
          group.slotName = active.name
        }
      }
    })
    const qrOrderMap = {}
    const qrHiddenSet = new Set()
    if (channel === 'qr' && qrCategoryOrder.length) {
      qrCategoryOrder.forEach((entry, i) => {
        const id = String(entry && entry.id ? entry.id : entry)
        if (!id) return
        if (entry && typeof entry === 'object' && entry.visible === false) {
          qrHiddenSet.add(id)
        } else {
          qrOrderMap[id] = i
        }
      })
    }
    // QR 手動隱藏：從菜單移除
    if (qrHiddenSet.size) {
      result = result.filter(c => !qrHiddenSet.has(String(c._id)))
    }
    result.sort((a, b) => {
      // QR 手動排序優先（有設定 qrCategoryOrder 時）
      if (channel === 'qr' && qrOrderMap && Object.keys(qrOrderMap).length) {
        const qa = qrOrderMap[String(a._id)]
        const qb = qrOrderMap[String(b._id)]
        const va = qa == null ? Number.MAX_SAFE_INTEGER : qa
        const vb = qb == null ? Number.MAX_SAFE_INTEGER : qb
        if (va !== vb) return va - vb
      }
      const sa = a.slotActive ? 1 : 0
      const sb = b.slotActive ? 1 : 0
      if (sa !== sb) return sb - sa
      const ra = a.rootOrder == null ? Number.MAX_SAFE_INTEGER : a.rootOrder
      const rb = b.rootOrder == null ? Number.MAX_SAFE_INTEGER : b.rootOrder
      if (ra !== rb) return ra - rb
      return (a.type - b.type)
    })
    res.json(result)
  } catch (err) {
    console.log(err)
    res.status(500).send('獲取菜單失敗')
  }
})

module.exports = router
