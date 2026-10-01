const express = require('express')
const router = express.Router()
const passport = require('passport')
const mongoose = require('mongoose')
const formidable = require('formidable')
const fs = require('fs')
const { requireLevel } = require('../../middleware/auth')
const Category = require('../../models/Category')
const Commodity = require('../../models/Commodity')
const CategoryItem = require('../../models/CategoryItem')
const Printer = require('../../models/Printer')
const PosSetting = require('../../models/PosSetting')

const MENU_COLLECTIONS = [
  'categories', 'categoryitems', 'commodities', 'combos', 'modcodes', 'modcodecategories'
]
// 隨「匯出菜單」一併打包的 POS 設定集合（獨立設定檔，無跨集合引用，可安全覆蓋匯入）
const CONFIG_COLLECTIONS = [
  'possettings', 'staffs', 'tables', 'zones', 'posterminals', 'printers'
]
const MENU_CONFIG_COLLECTIONS = MENU_COLLECTIONS.concat(CONFIG_COLLECTIONS)
const BUSINESS_COLLECTIONS = [
  'orders', 'businessdays', 'clockrecords', 'chartsdata'
]

function getDb () {
  return mongoose.connection.db
}

// $route GET api/systemmaint/backup
// @desc 備份完整資料庫（回傳 JSON）
// @access private
router.get('/backup', passport.authenticate('jwt', { session: false }), requireLevel(4), async (req, res) => {
  try {
    const db = getDb()
    const collections = await db.listCollections().toArray()
    const backup = {}
    for (const col of collections) {
      backup[col.name] = await db.collection(col.name).find({}).toArray()
    }
    res.setHeader('Content-Disposition', `attachment; filename="backup_${Date.now()}.json"`)
    res.setHeader('Content-Type', 'application/json')
    res.json(backup)
  } catch (err) {
    console.error('[SystemMaint] backup error:', err)
    res.status(500).json({ msg: '備份失敗：' + err.message })
  }
})

// $route GET api/systemmaint/exportmenu
// @desc 匯出菜單資料（含 POS 設定：possettings/staffs/tables/posterminals/printers）
// @access private
router.get('/exportmenu', passport.authenticate('jwt', { session: false }), requireLevel(4), async (req, res) => {
  try {
    const db = getDb()
    const data = {}
    for (const name of MENU_CONFIG_COLLECTIONS) {
      data[name] = await db.collection(name).find({}).toArray()
    }
    res.setHeader('Content-Disposition', `attachment; filename="menu_${Date.now()}.json"`)
    res.setHeader('Content-Type', 'application/json')
    res.json(data)
  } catch (err) {
    console.error('[SystemMaint] export menu error:', err)
    res.status(500).json({ msg: '匯出菜單失敗：' + err.message })
  }
})

// $route POST api/systemmaint/importdb
// @desc 匯入完整資料庫
// @access private
router.post('/importdb', passport.authenticate('jwt', { session: false }), requireLevel(4), async (req, res) => {
  try {
    const db = getDb()
    const data = req.body
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ msg: '無效的匯入資料' })
    }
    const collections = await db.listCollections().toArray()
    const existingNames = collections.map(c => c.name)
    let count = 0
    for (const [name, docs] of Object.entries(data)) {
      if (!Array.isArray(docs)) continue
      if (existingNames.includes(name)) {
        await db.collection(name).deleteMany({})
      }
      if (docs.length) {
        await db.collection(name).insertMany(docs)
      }
      count += docs.length
    }
    res.json({ msg: `資料庫匯入成功！共 ${Object.keys(data).length} 個集合，${count} 筆資料` })
  } catch (err) {
    console.error('[SystemMaint] import db error:', err)
    res.status(500).json({ msg: '匯入資料庫失敗：' + err.message })
  }
})

// $route POST api/systemmaint/importmenu
// @desc 匯入菜單資料（含 POS 設定）
// @access private
router.post('/importmenu', passport.authenticate('jwt', { session: false }), requireLevel(4), async (req, res) => {
  try {
    const db = getDb()
    const data = req.body
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ msg: '無效的匯入資料' })
    }
    let count = 0
    for (const name of MENU_CONFIG_COLLECTIONS) {
      if (!data[name] || !Array.isArray(data[name])) continue
      await db.collection(name).deleteMany({})
      if (data[name].length) {
        await db.collection(name).insertMany(data[name])
      }
      count += data[name].length
    }
    res.json({ msg: `菜單匯入成功！共 ${count} 筆資料` })
  } catch (err) {
    console.error('[SystemMaint] import menu error:', err)
    res.status(500).json({ msg: '匯入菜單失敗：' + err.message })
  }
})

// $route POST api/systemmaint/clearbusinessdata
// @desc 一鍵清除營業數據
// @access private
router.post('/clearbusinessdata', passport.authenticate('jwt', { session: false }), requireLevel(4), async (req, res) => {
  try {
    const db = getDb()
    const result = {}
    for (const name of BUSINESS_COLLECTIONS) {
      const r = await db.collection(name).deleteMany({})
      result[name] = r.deletedCount
    }
    const total = Object.values(result).reduce((a, b) => a + b, 0)
    res.json({ msg: `營業數據清除成功！共刪除 ${total} 筆資料`, detail: result })
  } catch (err) {
    console.error('[SystemMaint] clear business data error:', err)
    res.status(500).json({ msg: '清除營業數據失敗：' + err.message })
  }
})

// $route POST api/systemmaint/clearcombos
// @desc 一鍵清空套餐（含套餐與分類的關聯）
// @access private
router.post('/clearcombos', passport.authenticate('jwt', { session: false }), requireLevel(4), async (req, res) => {
  try {
    const db = getDb()
    const combos = await db.collection('combos').deleteMany({})
    const links = await db.collection('categoryitems').deleteMany({ targetType: 'combo' })
    res.json({
      msg: `套餐清除成功！共刪除 ${combos.deletedCount} 個套餐、${links.deletedCount} 筆關聯`,
      detail: { combos: combos.deletedCount, links: links.deletedCount }
    })
  } catch (err) {
    console.error('[SystemMaint] clear combos error:', err)
    res.status(500).json({ msg: '清除套餐失敗：' + err.message })
  }
})

// ===== ISM（宏軟 POS）菜單匯入 =====

// 解析 ISM ADO Recordset XML：取出所有 <z:row> 的屬性，並跳過只有 sent_* 欄位的異動記錄列
function parseAdoRows (xml) {
  if (!xml || typeof xml !== 'string') return []
  const rows = []
  const rowRe = /<z:row\b([^>]*)\/?>/gi
  let m
  while ((m = rowRe.exec(xml)) !== null) {
    const attrs = {}
    const attrRe = /([A-Za-z_][\w:-]*)\s*=\s*('([^']*)'|"([^"]*)")/g
    let a
    while ((a = attrRe.exec(m[1])) !== null) {
      attrs[a[1]] = a[3] !== undefined ? a[3] : a[4]
    }
    const realKeys = Object.keys(attrs).filter(k => !k.startsWith('sent_'))
    if (realKeys.length === 0) continue
    rows.push(attrs)
  }
  return rows
}

// 解析 discount.xml 的預設折扣（apply_to=0 為整單折扣；disc_type=0 百分比 / =1 金額）
function parseDiscountOptions (rows) {
  const opts = []
  for (const r of rows) {
    if (r.apply_to !== '0') continue
    if (r.enable === '0') continue
    if (r.id === '99' || r.id === '07') continue // 取消折扣 / ENT 不匯入
    if (r.disc_type === '1' || r.open_disc === '1') {
      opts.push({ name: r.desc2 || r.desc1 || r.id, type: 'amount', value: 0 })
    } else {
      const off = parseFloat(r.value) || 0
      opts.push({ name: r.desc2 || r.desc1 || r.id, type: 'percent', value: off })
    }
  }
  return opts
}

async function importIsm (xmlMap, options = {}) {
  const combosMode = ['commodity', 'skip'].indexOf(options.combosMode) >= 0 ? options.combosMode : 'combo'
  const deptRows = parseAdoRows(xmlMap['department.xml'] || '')
  const lhRows = parseAdoRows(xmlMap['lookup_header.xml'] || '')
  const ldRows = parseAdoRows(xmlMap['lookup_details.xml'] || '')
  const itemRows = parseAdoRows(xmlMap['item.xml'] || '')
  const priceRows = parseAdoRows(xmlMap['item_price.xml'] || '')
  const ipRows = parseAdoRows(xmlMap['item_printer.xml'] || '')
  const pqRows = parseAdoRows(xmlMap['printer_queue.xml'] || '')
  const discRows = parseAdoRows(xmlMap['discount.xml'] || '')

  const result = { categories: 0, commodities: 0, combos: 0, comboNames: 0, links: 0, modcodes: 0, modGroups: 0, stations: 0, discounts: 0, departments: 0, skipped: 0 }

  // 1. 部門 map：dept_id -> 名稱，並建立 Department 文件（department.xml → 部門管理）
  const deptName = {}
  const deptDocs = []
  const deptSeen = {}
  for (const r of deptRows) {
    if (!r.dept_id) continue
    deptName[r.dept_id] = r.desc1 || r.dept_id
    if (deptSeen[r.dept_id]) continue
    deptSeen[r.dept_id] = true
    deptDocs.push({
      name: r.desc1 || r.dept_id,
      code: r.dept_id,
      sort: parseInt(r.row_id) > 0 ? parseInt(r.row_id) - 1 : deptDocs.length,
      active: true,
      date: new Date()
    })
  }

  // 2. 檔口 map：queue_id（數字，邏輯檔口）-> 名稱；LP*/R1 為實體打印機，略過
  const stationName = {}
  for (const r of pqRows) {
    if (!r.queue_id || !/^\d+$/.test(r.queue_id)) continue
    stationName[r.queue_id] = r.description1 || r.queue_id
  }

  // 3. 商品底價（price_no=1）
  const basePrice = {}
  for (const r of priceRows) {
    if (r.price_no !== '1') continue
    basePrice[r.item_code] = parseFloat(r.price) || 0
  }

  // 4. 商品檔口：item_code -> 檔口名
  const itemStation = {}
  for (const r of ipRows) {
    const name = stationName[r.print_queue] || ''
    if (name) itemStation[r.item_code] = name
  }

  // 5. 分類（lookup_header id_type=1；僅 lookup_type=1 為分類，lookup_type=2/3 分開處理）
  const catDocMap = {} // lookup_id -> category doc
  const catDocs = []
  const comboHeader = {} // lookup_id -> header（lookup_type=3 合菜/套餐）
  const modGroupHeader = {} // lookup_id -> header（lookup_type=2 選單選擇組）
  const lookupName = {} // lookup_id -> name1
  let catNo = 1
  for (const r of lhRows) {
    if (r.id_type !== '1' || !r.lookup_id) continue
    if (r.name1) lookupName[r.lookup_id] = r.name1
    if (r.lookup_type === '3') { comboHeader[r.lookup_id] = r; continue }
    if (r.lookup_type === '2') { modGroupHeader[r.lookup_id] = r; continue }
    if (r.lookup_type !== '1') continue
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      code: r.lookup_id,
      cName: r.name1 || r.lookup_id,
      no: catNo++,
      department: ''
    }
    catDocMap[r.lookup_id] = doc
    catDocs.push(doc)
  }

  // 5.5 改碼項目集合（is_modifier=1 且 M 開頭）
  const modifierCodeSet = new Set()
  for (const r of itemRows) {
    if (r.is_modifier === '1' && /^M/i.test(r.item_code)) modifierCodeSet.add(r.item_code)
  }

  // 5.6 改碼分組：lookup_details 中 lookup_type=2 群組 → 改碼項目的歸屬（第一筆優先）
  // 僅 M 前綴群組為改碼群組；A/S 前綴為套餐子選項組，不納入改碼類別
  const modItemGroup = {} // item_code -> { name, seq, compulsory, maxCount }
  const modGroupUsed = [] // 實際含改碼項目的群組 lookup_id（保留出現順序）
  const modGroupUsedSeen = new Set()
  for (const d of ldRows) {
    if (d.item_type !== '0') continue
    if (!/^M/i.test(d.lookup_id)) continue
    const hdr = modGroupHeader[d.lookup_id]
    if (!hdr) continue
    if (!modifierCodeSet.has(d.code)) continue
    if (!modItemGroup[d.code]) {
      modItemGroup[d.code] = {
        name: hdr.name1 || d.lookup_id,
        seq: parseInt(d.seq) || 0,
        compulsory: hdr.compulsory === '1',
        maxCount: parseInt(hdr.max_count) || 0
      }
    }
    if (!modGroupUsedSeen.has(d.lookup_id)) {
      modGroupUsedSeen.add(d.lookup_id)
      modGroupUsed.push(d.lookup_id)
    }
  }

  // 5.7 商品 → 改碼類別：item.modifier1 指向頂層改碼群組，需展開到葉層改碼類別
  const modChildren = {} // lookup_id -> [子群組 lookup_id]（lookup_details item_type=1）
  for (const d of ldRows) {
    if (d.item_type !== '1') continue
    if (!/^M/i.test(d.lookup_id)) continue
    ;(modChildren[d.lookup_id] = modChildren[d.lookup_id] || []).push(d.code)
  }
  const leafModName = {} // 葉層改碼群組 lookup_id -> ModCodeCategory 名稱
  for (const lid of modGroupUsed) {
    leafModName[lid] = lookupName[lid] || lid
  }
  // 展開 modifier1（頂層群組）→ 所有可達葉層改碼類別名稱
  const resolveModCats = (lid) => {
    const out = new Set()
    const seen = new Set()
    const walk = (id) => {
      if (!id || seen.has(id)) return
      seen.add(id)
      if (leafModName[id]) out.add(leafModName[id])
      const children = modChildren[id] || []
      for (const ch of children) walk(ch)
    }
    walk(lid)
    return Array.from(out)
  }
  // 展開 modifier1（頂層群組）→ 所有可達葉層改碼群組 lookup_id
  const resolveLeafModIds = (lid) => {
    const out = new Set()
    const seen = new Set()
    const walk = (id) => {
      if (!id || seen.has(id)) return
      seen.add(id)
      if (leafModName[id] !== undefined) out.add(id)
      const children = modChildren[id] || []
      for (const ch of children) walk(ch)
    }
    walk(lid)
    return Array.from(out)
  }

  // 6. 商品與改碼（item）
  const itemMap = {} // item_code -> _id
  const itemDept = {} // item_code -> dept_id
  const comDocs = []
  const modDocs = [] // 改碼（is_modifier=1，M 開頭 → ModCode）
  let modNo = 1
  for (const r of itemRows) {
    if (!r.item_code) continue
    if (r.is_modifier === '1') {
      // 改碼：M 開頭 → ModCode；Z 開頭為「分賬」內部科目，略過
      if (/^M/i.test(r.item_code)) {
        const mName = r.pos_desc1 || r.desc1 || r.item_code
        if (mName) {
          const grp = modItemGroup[r.item_code]
          modDocs.push({
            name: mName,
            code: r.item_code,
            category: grp ? grp.name : '改碼',
            sort: grp && grp.seq > 0 ? grp.seq : modNo++,
            price: basePrice[r.item_code] || 0,
            channels: ['pos', 'qr'],
            mandatory: grp ? grp.compulsory : false,
            maxSelect: grp && grp.maxCount > 0 ? grp.maxCount : 1,
            station: itemStation[r.item_code] || ''
          })
        } else {
          result.skipped++
        }
      } else {
        result.skipped++
      }
      continue
    }
    const isOpenPrice = r.open_price === '1'
    let price = basePrice[r.item_code]
    if (price === undefined) {
      // 浮動價格（時價）商品可無固定價，匯入時價格記 0，由收銀員於 POS 輸入實際金額
      if (!isOpenPrice) { result.skipped++; continue }
      price = 0
    }
    const name = r.pos_desc1 || r.desc1 || r.item_code
    if (!name) { result.skipped++; continue }
    const _id = new mongoose.Types.ObjectId()
    itemMap[r.item_code] = _id
    itemDept[r.item_code] = r.dept_id || ''
    const stn = itemStation[r.item_code] || ''
    const m1 = r.modifier1 || ''
    const modCategories = m1 === 'M00000' ? ['改碼', ...resolveModCats(m1)] : (m1 ? resolveModCats(m1) : [])
    comDocs.push({
      _id,
      name,
      img: '/goods/goods_1.png',
      category: '',
      categoryId: null,
      price,
      isDiscount: true,
      soldOut: false,
      code: r.item_code,
      plu: r.plu_no || '',
      station: stn,
      stations: stn ? [stn] : [],
      department: deptName[r.dept_id] || '',
      modCategories,
      openPrice: isOpenPrice,
      mandatory: r.orderinput === '1'
    })
  }

  // 6.5 套餐（lookup_type=3）與改碼選擇組（lookup_type=2）
  const comboDocs = []
  const comboTarget = {} // lookup_id -> { targetId, targetType }（連結用）
  const modGroupDocs = [] // ModCodeCategory 分組
  const itemName = {} // item_code -> name
  for (const r of itemRows) {
    if (r.item_code) itemName[r.item_code] = r.pos_desc1 || r.desc1 || r.item_code
  }
  const comModCats = {}
  for (const c of comDocs) {
    if (c.code) comModCats[c.code] = (c.modCategories || []).slice()
  }
  const resolveItem = (code) => {
    const name = itemName[code] || lookupName[code] || code
    return { commodityId: itemMap[code] ? String(itemMap[code]) : '', name, price: basePrice[code] || 0, modCategories: comModCats[code] || [] }
  }
  // 套餐：lookup_type=3（依 combosMode 決定匯入方式）
  for (const [lid, hdr] of Object.entries(comboHeader)) {
    if (combosMode === 'skip') continue
    if (combosMode === 'commodity') {
      // 只匯入套餐名稱 → 當作普通商品（價格 0，由後台補價）
      if (itemMap[lid]) {
        comboTarget[lid] = { targetId: itemMap[lid], targetType: 'commodity' }
      } else {
        const _id = new mongoose.Types.ObjectId()
        comboTarget[lid] = { targetId: _id, targetType: 'commodity' }
        comDocs.push({
          _id,
          name: lookupName[lid] || lid,
          img: '/goods/goods_1.png',
          category: '',
          categoryId: null,
          price: 0,
          isDiscount: true,
          soldOut: false,
          code: lid,
          plu: '',
          station: '',
          stations: []
        })
        result.comboNames++
      }
      continue
    }
    const details = ldRows.filter(d => d.lookup_id === lid)
    const direct = details
      .filter(d => d.item_type === '0')
      .sort((a, b) => (parseInt(a.seq) || 0) - (parseInt(b.seq) || 0))
      .map(d => resolveItem(d.code))
    const groups = []
    if (direct.length) {
      groups.push({
        name: lookupName[lid] || lid,
        min: parseInt(hdr.min_count) || 0,
        max: parseInt(hdr.max_count) || 0,
        allowRepeat: false,
        fixed: false,
        station: '',
        items: direct
      })
    }
    // 巢狀子套餐
    for (const nd of details.filter(d => d.item_type === '1')) {
      const ch = comboHeader[nd.code]
      if (!ch) continue
      const childItems = ldRows
        .filter(d => d.lookup_id === nd.code && d.item_type === '0')
        .sort((a, b) => (parseInt(a.seq) || 0) - (parseInt(b.seq) || 0))
        .map(d => resolveItem(d.code))
      groups.push({
        name: lookupName[nd.code] || nd.code,
        min: parseInt(ch.min_count) || 0,
        max: parseInt(ch.max_count) || 0,
        allowRepeat: false,
        fixed: false,
        station: '',
        items: childItems
      })
    }
    const _id = new mongoose.Types.ObjectId()
    comboTarget[lid] = { targetId: _id, targetType: 'combo' }
    comboDocs.push({
      _id,
      name: lookupName[lid] || lid,
      img: '',
      describe: '',
      category: '',
      price: 0,
      type: 'select',
      courseControl: false,
      groups,
      soldOut: false,
      date: new Date()
    })
  }
  // 改碼選擇組：僅匯入實際含改碼項目的 lookup_type=2 群組 → ModCodeCategory
  const modGroupIdByLookup = {} // 葉層改碼群組 lookup_id -> ModCodeCategory _id
  let modGroupNo = 1
  for (const lid of modGroupUsed) {
    const gh = modGroupHeader[lid] || {}
    const _id = new mongoose.Types.ObjectId()
    modGroupIdByLookup[lid] = _id
    modGroupDocs.push({
      _id,
      name: lookupName[lid] || lid,
      code: lid,
      sort: modGroupNo++,
      mandatory: gh.compulsory === '1',
      date: new Date()
    })
  }

  // 改碼容器分類（如 M00000）→ 其葉層改碼類別，寫入 CategoryItem 供 POS 顯示子改碼類別
  const needFallback = modDocs.some(m => m.category === '改碼') || comDocs.some(c => (c.modCategories || []).indexOf('改碼') >= 0)
  let fallbackModCatId = null
  if (needFallback) {
    fallbackModCatId = new mongoose.Types.ObjectId()
    modGroupDocs.push({ _id: fallbackModCatId, name: '改碼', code: '', sort: 0, date: new Date() })
  }
  const modCatLinkDocs = []
  for (const cat of catDocs) {
    if (!/^M/i.test(cat.code)) continue
    const leafIds = resolveLeafModIds(cat.code)
    let sortOrder = 0
    for (const lid of leafIds) {
      const targetId = modGroupIdByLookup[lid]
      if (!targetId) continue
      modCatLinkDocs.push({ categoryId: cat._id, targetId, targetType: 'modcodecategory', sortOrder: sortOrder++ })
    }
    if (fallbackModCatId) {
      modCatLinkDocs.push({ categoryId: cat._id, targetId: fallbackModCatId, targetType: 'modcodecategory', sortOrder: sortOrder++ })
    }
  }

  // 7. 關聯（lookup_details）：item_type=0 分類→商品/套餐；item_type=1 分類→子分類/套餐
  const linkDocs = []
  const comPrimaryCat = {} // item_code -> category doc（第一個分類）
  const catItems = {} // lookup_id -> [item_code]
  const linkComboTarget = (lookupId, code, parent, sortOrder) => {
    const t = comboTarget[code]
    linkDocs.push({ categoryId: parent._id, targetId: t.targetId, targetType: t.targetType, sortOrder })
    if (t.targetType === 'commodity') {
      if (!comPrimaryCat[code]) comPrimaryCat[code] = parent
      ;(catItems[lookupId] = catItems[lookupId] || []).push(code)
    }
  }
  for (const r of ldRows) {
    const lookupId = r.lookup_id
    const code = r.code
    if (!lookupId || !code) continue
    const parent = catDocMap[lookupId]
    if (!parent) continue
    const sortOrder = parseInt(r.seq) || 0
    if (r.item_type === '0') {
      const comId = itemMap[code]
      if (comId) {
        linkDocs.push({ categoryId: parent._id, targetId: comId, targetType: 'commodity', sortOrder })
        if (!comPrimaryCat[code]) comPrimaryCat[code] = parent
        ;(catItems[lookupId] = catItems[lookupId] || []).push(code)
      } else if (comboTarget[code]) {
        linkComboTarget(lookupId, code, parent, sortOrder)
      }
    } else if (r.item_type === '1') {
      const child = catDocMap[code]
      if (child) {
        linkDocs.push({ categoryId: parent._id, targetId: child._id, targetType: 'category', sortOrder })
        child.parentId = parent._id
      } else if (comboTarget[code]) {
        linkComboTarget(lookupId, code, parent, sortOrder)
      }
    }
  }

  // 7.5 關聯去重：lookup_details.xml 可能含有重複列，避免同一商品在同一分類下重複關聯
  const seenLink = new Set()
  const dedupedLinks = []
  for (const l of linkDocs.concat(modCatLinkDocs)) {
    const k = l.targetType + ':' + String(l.categoryId) + ':' + String(l.targetId)
    if (seenLink.has(k)) continue
    seenLink.add(k)
    dedupedLinks.push(l)
  }

  // 8. 商品主要分類（categoryId / category 名稱）
  for (const [code, doc] of Object.entries(comPrimaryCat)) {
    const comDoc = comDocs.find(c => c.code === code)
    if (!comDoc) continue
    comDoc.categoryId = doc._id
    comDoc.category = doc.cName
  }

  // 9. 分類部門（依其商品的多數 dept_id 推導）
  for (const [lookupId, codes] of Object.entries(catItems)) {
    const doc = catDocMap[lookupId]
    if (!doc) continue
    const tally = {}
    for (const c of codes) {
      const d = itemDept[c]
      if (!d || !deptName[d]) continue
      tally[d] = (tally[d] || 0) + 1
    }
    let best = ''
    let bestCount = -1
    for (const [d, n] of Object.entries(tally)) {
      if (n > bestCount) { best = d; bestCount = n }
    }
    if (best) doc.department = deptName[best]
  }

  // 9.5 版面設定（lookup_id=0000, lookup_type=1001）定義 POS 第一層分類與順序
  const rootSeen = {}
  let rootIdx = 0
  const rootLinks = ldRows
    .filter(r => r.lookup_id === '0000' && r.item_type === '1')
    .sort((a, b) => (parseInt(a.seq) || 0) - (parseInt(b.seq) || 0))
  for (const r of rootLinks) {
    if (!r.code || rootSeen[r.code]) continue
    const cat = catDocMap[r.code]
    if (!cat) continue
    rootSeen[r.code] = true
    cat.rootOrder = rootIdx++
  }

  // 10. 寫入資料庫（先清空菜單核心集合）
  const db = getDb()
  await db.collection('categories').deleteMany({})
  await db.collection('categoryitems').deleteMany({})
  await db.collection('commodities').deleteMany({})
  await db.collection('combos').deleteMany({})
  await db.collection('modcodes').deleteMany({})
  await db.collection('modcodecategories').deleteMany({})
  await db.collection('departments').deleteMany({})
  if (deptDocs.length) await db.collection('departments').insertMany(deptDocs)
  if (catDocs.length) await db.collection('categories').insertMany(catDocs)
  if (comDocs.length) await db.collection('commodities').insertMany(comDocs)
  if (dedupedLinks.length) await db.collection('categoryitems').insertMany(dedupedLinks)
  if (comboDocs.length) await db.collection('combos').insertMany(comboDocs)
  if (modDocs.length) await db.collection('modcodes').insertMany(modDocs)
  if (modGroupDocs.length) await db.collection('modcodecategories').insertMany(modGroupDocs)
  result.categories = catDocs.length
  result.commodities = comDocs.length
  result.combos = comboDocs.length
  result.links = dedupedLinks.length
  result.modcodes = modDocs.length
  result.modGroups = modGroupUsed.length
  result.departments = deptDocs.length

  // 11. 檔口（加入 Printer.printers，依名稱去重）
  let printer = await Printer.findOne().exec()
  if (!printer) printer = await Printer.create({ printers: [] })
  const existing = new Set((printer.printers || []).map(p => p.name))
  const merged = [...(printer.printers || [])]
  for (const name of Object.values(stationName)) {
    if (existing.has(name)) continue
    existing.add(name)
    merged.push({ name, role: 'kitchen', ip: '', port: 9100 })
  }
  if (merged.length !== (printer.printers || []).length) {
    printer.printers = merged
    await printer.save()
  }
  result.stations = stationName ? Object.keys(stationName).length : 0

  // 12. 預設折扣 → PosSetting.discountOptions
  const discounts = parseDiscountOptions(discRows)
  if (discounts.length) {
    await PosSetting.findOneAndUpdate({}, { $set: { discountOptions: discounts } }, { upsert: true })
  }
  result.discounts = discounts.length

  return result
}

// $route POST api/systemmaint/importism
// @desc 匯入 ISM（宏軟 POS）菜單資料（多檔上傳）
// @access private
router.post('/importism', passport.authenticate('jwt', { session: false }), requireLevel(4), (req, res) => {
  const form = new formidable.IncomingForm()
  form.multiples = true
  form.parse(req, (err, fields, files) => {
    if (err) {
      return res.status(500).json({ msg: '上傳解析失敗：' + err.message })
    }
    ;(async () => {
      try {
        let fileList = files.files
        if (!fileList) return res.status(400).json({ msg: '請選擇要匯入的 XML 檔案（欄位名 files）' })
        if (!Array.isArray(fileList)) fileList = [fileList]
        const xmlMap = {}
        for (const f of fileList) {
          const name = (f.name || f.originalFilename || '').toLowerCase()
          if (!name.endsWith('.xml')) continue
          xmlMap[name] = fs.readFileSync(f.path, 'utf8')
        }
        if (Object.keys(xmlMap).length === 0) {
          return res.status(400).json({ msg: '沒有讀取到任何 XML 檔案' })
        }
        const combosMode = fields.combosMode || 'combo'
        const result = await importIsm(xmlMap, { combosMode })
        res.json({ msg: 'ISM 菜單匯入完成', result })
      } catch (e) {
        console.error('[SystemMaint] import ISM error:', e)
        res.status(500).json({ msg: '匯入 ISM 失敗：' + e.message })
      }
    })()
  })
})

module.exports = router
