const express = require('express')
const router = express.Router()
const passport = require('passport')
const formidable = require('formidable')
const fs = require('fs')
const { requireLevel } = require('../../middleware/auth')
const pg = require('../../db/pg')
const { toSnake } = require('../../db/model')
const Category = require('../../models/Category')
const Commodity = require('../../models/Commodity')
const CategoryItem = require('../../models/CategoryItem')
const Combo = require('../../models/Combo')
const ModCode = require('../../models/ModCode')
const ModCodeCategory = require('../../models/ModCodeCategory')
const Department = require('../../models/Department')
const Printer = require('../../models/Printer')
const PosSetting = require('../../models/PosSetting')

// 營業數據（匯出菜單時排除；完整備份 GET /backup 仍會包含）
const BUSINESS_COLLECTIONS = [
  'orders', 'businessdays', 'clockrecords', 'chartsdatas',
  'holds', 'queuetickets', 'auditlogs'
]
// 系統內部表（不隨菜單匯出／匯入，避免覆寫遷移紀錄）
const SYSTEM_COLLECTIONS = [
  'schema_migrations'
]

// 「匯出菜單」＝全部資料表扣除營業數據與系統內部表，其餘（菜單＋POS/各項設定）一併匯出
async function menuExportTables () {
  const tables = await listTables()
  return tables.filter(t => BUSINESS_COLLECTIONS.indexOf(t) < 0 && SYSTEM_COLLECTIONS.indexOf(t) < 0)
}

// ---- 通用 PG 資料表工具（取代 mongoose.connection.db.collection） ----
function quoteIdent (name) {
  return '"' + String(name).replace(/"/g, '""') + '"'
}

async function listTables () {
  const rows = await pg.query(
    "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  )
  return rows.map(r => r.tablename)
}

async function tableAll (table) {
  return pg.query(`SELECT * FROM ${quoteIdent(table)}`)
}

async function tableDeleteAll (table) {
  return pg.query(`DELETE FROM ${quoteIdent(table)} RETURNING 1`)
}

async function tableDeleteWhere (table, key, value) {
  return pg.query(`DELETE FROM ${quoteIdent(table)} WHERE ${quoteIdent(toSnake(key))} = $1 RETURNING 1`, [value])
}

async function tableInsertOne (table, doc) {
  if (!doc || typeof doc !== 'object') return
  const keys = Object.keys(doc).filter(k => doc[k] !== undefined && k !== 'id')
  if (!keys.length) return
  const cols = keys.map(k => (k === '_id' ? '_id' : toSnake(k)))
  const placeholders = keys.map((_, i) => '$' + (i + 1))
  const values = keys.map(k => {
    const v = doc[k]
    if (v === null || v === undefined) return null
    if (v instanceof Date) return v
    if (typeof v === 'object') return JSON.stringify(v)
    return v
  })
  await pg.query(
    `INSERT INTO ${quoteIdent(table)} (${cols.map(quoteIdent).join(', ')}) VALUES (${placeholders.join(', ')})`,
    values
  )
}

async function tableInsertMany (table, docs) {
  for (const doc of docs) await tableInsertOne(table, doc)
}

// $route GET api/systemmaint/backup
// @desc 備份完整資料庫（回傳 JSON）
// @access private
router.get('/backup', passport.authenticate('jwt', { session: false }), requireLevel(4), async (req, res) => {
  try {
    const tables = await listTables()
    const backup = {}
    for (const table of tables) {
      backup[table] = await tableAll(table)
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
// @desc 匯出菜單資料（除營業數據外，含菜單與 POS/各項設定）
// @access private
router.get('/exportmenu', passport.authenticate('jwt', { session: false }), requireLevel(4), async (req, res) => {
  try {
    const tables = await menuExportTables()
    const data = {}
    for (const name of tables) {
      data[name] = await tableAll(name)
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
    const data = req.body
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ msg: '無效的匯入資料' })
    }
    const tables = await listTables()
    let count = 0
    for (const [name, docs] of Object.entries(data)) {
      if (!Array.isArray(docs)) continue
      if (tables.includes(name)) {
        await tableDeleteAll(name)
      }
      if (docs.length) {
        await tableInsertMany(name, docs)
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
// @desc 匯入菜單資料（除營業數據外，含菜單與 POS/各項設定）
// @access private
router.post('/importmenu', passport.authenticate('jwt', { session: false }), requireLevel(4), async (req, res) => {
  try {
    const data = req.body
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ msg: '無效的匯入資料' })
    }
    const existing = await listTables()
    let count = 0
    for (const name of Object.keys(data)) {
      if (!Array.isArray(data[name])) continue
      if (BUSINESS_COLLECTIONS.indexOf(name) >= 0 || SYSTEM_COLLECTIONS.indexOf(name) >= 0) continue
      if (existing.indexOf(name) < 0) continue
      await tableDeleteAll(name)
      if (data[name].length) {
        await tableInsertMany(name, data[name])
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
    const result = {}
    const existing = await listTables()
    for (const name of BUSINESS_COLLECTIONS) {
      if (existing.indexOf(name) < 0) continue
      const r = await tableDeleteAll(name)
      result[name] = r.length
    }
    const total = Object.values(result).reduce((a, b) => a + b, 0)
    res.json({ msg: `營業數據清除成功！共刪除 ${total} 筆資料`, detail: result })
  } catch (err) {
    console.error('[SystemMaint] clear business data error:', err)
    res.status(500).json({ msg: '清除營業數據失敗：' + err.message })
  }
})

// $route GET api/systemmaint/replicationStatus
// @desc 備援主機串流複製狀態（唯讀，需 ordersys 具 pg_read_all_stats 權限）
// @access private
router.get('/replicationStatus', passport.authenticate('jwt', { session: false }), requireLevel(4), async (req, res) => {
  try {
    const [recoveryRows, replicaRows, slotRows, replayRows] = await Promise.all([
      pg.query('SELECT pg_is_in_recovery() AS is_recovery'),
      pg.query(`
        SELECT application_name,
               client_addr::text AS client_addr,
               state,
               sync_state,
               sent_lsn::text AS sent_lsn,
               replay_lsn::text AS replay_lsn,
               pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS replay_bytes_behind,
               CASE WHEN replay_lag IS NULL THEN NULL ELSE replay_lag::text END AS replay_lag
        FROM pg_stat_replication
        ORDER BY application_name
      `),
      pg.query(`
        SELECT slot_name,
               active,
               wal_status,
               pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) AS retained_bytes
        FROM pg_replication_slots
        ORDER BY slot_name
      `),
      pg.query('SELECT pg_last_xact_replay_timestamp() AS last_replay')
    ])
    res.json({
      isRecovery: !!(recoveryRows[0] && recoveryRows[0].is_recovery),
      replicas: replicaRows.map(r => ({
        applicationName: r.application_name,
        clientAddr: r.client_addr,
        state: r.state,
        syncState: r.sync_state,
        sentLsn: r.sent_lsn,
        replayLsn: r.replay_lsn,
        replayBytesBehind: r.replay_bytes_behind === null ? null : Number(r.replay_bytes_behind),
        replayLag: r.replay_lag
      })),
      slots: slotRows.map(s => ({
        slotName: s.slot_name,
        active: !!s.active,
        walStatus: s.wal_status,
        retainedBytes: s.retained_bytes === null ? null : Number(s.retained_bytes)
      })),
      lastReplay: (replayRows[0] && replayRows[0].last_replay) || null,
      checkedAt: new Date().toISOString()
    })
  } catch (err) {
    console.error('[SystemMaint] replication status error:', err)
    res.status(500).json({ msg: '讀取備援狀態失敗：' + err.message })
  }
})

// $route GET api/systemmaint/logs
// @desc 系統日誌（記憶體環形緩衝，等同 docker logs）
// @access private
router.get('/logs', passport.authenticate('jwt', { session: false }), requireLevel(4), (req, res) => {
  const logBuffer = require('../../utils/logBuffer')
  const limit = parseInt(req.query.limit) || 500
  const level = req.query.level || ''
  res.json({ logs: logBuffer.getLogs(limit, level), max: logBuffer.MAX_ENTRIES })
})

// $route POST api/systemmaint/logs/clear
// @desc 清空系統日誌緩衝
// @access private
router.post('/logs/clear', passport.authenticate('jwt', { session: false }), requireLevel(4), (req, res) => {
  const logBuffer = require('../../utils/logBuffer')
  logBuffer.clear()
  res.json({ msg: '系統日誌已清空' })
})

// $route POST api/systemmaint/clearcombos
// @desc 一鍵清空套餐（含套餐與分類的關聯）
// @access private
router.post('/clearcombos', passport.authenticate('jwt', { session: false }), requireLevel(4), async (req, res) => {
  try {
    const combos = await tableDeleteAll('combos')
    const links = await tableDeleteWhere('categoryitems', 'targetType', 'combo')
    res.json({
      msg: `套餐清除成功！共刪除 ${combos.length} 個套餐、${links.length} 筆關聯`,
      detail: { combos: combos.length, links: links.length }
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
      _id: pg.newId(),
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
    const _id = pg.newId()
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
        const _id = pg.newId()
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
    const _id = pg.newId()
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
    const _id = pg.newId()
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
    fallbackModCatId = pg.newId()
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
  await Category.deleteMany({})
  await CategoryItem.deleteMany({})
  await Commodity.deleteMany({})
  await Combo.deleteMany({})
  await ModCode.deleteMany({})
  await ModCodeCategory.deleteMany({})
  await Department.deleteMany({})
  if (deptDocs.length) await Department.insertMany(deptDocs)
  if (catDocs.length) await Category.insertMany(catDocs)
  if (comDocs.length) await Commodity.insertMany(comDocs)
  if (dedupedLinks.length) await CategoryItem.insertMany(dedupedLinks)
  if (comboDocs.length) await Combo.insertMany(comboDocs)
  if (modDocs.length) await ModCode.insertMany(modDocs)
  if (modGroupDocs.length) await ModCodeCategory.insertMany(modGroupDocs)
  result.categories = catDocs.length
  result.commodities = comDocs.length
  result.combos = comboDocs.length
  result.links = dedupedLinks.length
  result.modcodes = modDocs.length
  result.modGroups = modGroupUsed.length
  result.departments = deptDocs.length

  // 11. 檔口（清掉舊的邏輯檔口，保留實體打印機，再加入本次匯入的檔口）
  let printer = await Printer.findOne().exec()
  if (!printer) printer = await Printer.create({ printers: [] })
  const kept = (printer.printers || []).filter(p => !(p.role === 'kitchen' && !p.ip))
  const existing = new Set(kept.map(p => p.name))
  const merged = [...kept]
  for (const name of Object.values(stationName)) {
    if (existing.has(name)) continue
    existing.add(name)
    merged.push({ name, role: 'kitchen', ip: '', port: 9100 })
  }
  printer.printers = merged
  await printer.save()
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
