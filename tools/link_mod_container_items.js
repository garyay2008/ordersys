// 一次性腳本：把改碼容器分類（如 M00000）的子改碼類別寫入 CategoryItem，供 POS 顯示子改碼類別
// 用法: node tools/link_mod_container_items.js [ISM資料夾] [MONGO_URI]
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

const DIR = process.argv[2] || 'ISMMENU'
const URI = process.argv[3] || process.env.MONGO_URI || 'mongodb://ordersys:306670c6ce55a4f30ed230fd8bb9e366b019@127.0.0.1:27017/orderSYS?authSource=admin'

function parseAdoRows (xml) {
  if (!xml || typeof xml !== 'string') return []
  const rows = []
  const rowRe = /<z:row\b([\s\S]*?)(?:\/?>)/gi
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

function read (name) {
  const p = path.join(DIR, name)
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''
}

// 回傳 { lookup_id: [葉層改碼群組 lookup_id...] }（僅含 lookup_type=1 且 M 前綴的容器分類）
function buildContainers () {
  const lhRows = parseAdoRows(read('lookup_header.xml'))
  const ldRows = parseAdoRows(read('lookup_details.xml'))
  const itemRows = parseAdoRows(read('item.xml'))

  const lookupName = {}
  const modGroupHeader = {}
  for (const r of lhRows) {
    if (r.id_type !== '1' || !r.lookup_id) continue
    if (r.name1) lookupName[r.lookup_id] = r.name1
    if (r.lookup_type === '3') continue
    if (r.lookup_type === '2') { modGroupHeader[r.lookup_id] = r; continue }
  }

  const modifierCodeSet = new Set()
  for (const r of itemRows) {
    if (r.is_modifier === '1' && /^M/i.test(r.item_code)) modifierCodeSet.add(r.item_code)
  }

  const modGroupUsed = []
  const modGroupUsedSeen = new Set()
  for (const d of ldRows) {
    if (d.item_type !== '0') continue
    if (!/^M/i.test(d.lookup_id)) continue
    const hdr = modGroupHeader[d.lookup_id]
    if (!hdr) continue
    if (!modifierCodeSet.has(d.code)) continue
    if (!modGroupUsedSeen.has(d.lookup_id)) {
      modGroupUsedSeen.add(d.lookup_id)
      modGroupUsed.push(d.lookup_id)
    }
  }

  const modChildren = {}
  for (const d of ldRows) {
    if (d.item_type !== '1') continue
    if (!/^M/i.test(d.lookup_id)) continue
    ;(modChildren[d.lookup_id] = modChildren[d.lookup_id] || []).push(d.code)
  }

  const leafModName = {}
  for (const lid of modGroupUsed) leafModName[lid] = lookupName[lid] || lid

  const resolveLeafModIds = (lid) => {
    const out = new Set()
    const seen = new Set()
    const walk = (id) => {
      if (!id || seen.has(id)) return
      seen.add(id)
      if (leafModName[id] !== undefined) out.add(id)
      for (const ch of (modChildren[id] || [])) walk(ch)
    }
    walk(lid)
    return Array.from(out)
  }

  const containers = {}
  for (const r of lhRows) {
    if (r.id_type !== '1' || !r.lookup_id) continue
    if (r.lookup_type !== '1') continue
    if (!/^M/i.test(r.lookup_id)) continue
    const leafIds = resolveLeafModIds(r.lookup_id)
    if (leafIds.length) containers[r.lookup_id] = leafIds
  }
  return containers
}

async function main () {
  const containers = buildContainers()
  console.log('改碼容器分類:', Object.keys(containers).join(', '))

  await mongoose.connect(URI)
  const Cat = require('../models/Category')
  const Mcc = require('../models/ModCodeCategory')
  const CI = require('../models/CategoryItem')

  let totalLinked = 0
  for (const [lookupId, leafIds] of Object.entries(containers)) {
    const cat = await Cat.findOne({ code: lookupId }).lean()
    if (!cat) { console.log('找不到分類:', lookupId); continue }

    const mccs = await Mcc.find({ code: { $in: leafIds } }).lean()
    const byCode = {}
    mccs.forEach(m => { if (m.code) byCode[m.code] = m })

    const links = []
    let sortOrder = 0
    for (const lid of leafIds) {
      const m = byCode[lid]
      if (!m) { console.log('  缺少改碼類別 doc:', lid); continue }
      links.push({ categoryId: cat._id, targetId: m._id, targetType: 'modcodecategory', sortOrder: sortOrder++ })
    }
    // 兜底「改碼」類別（code 為空，收納無葉層群組的改碼項目）
    const fallback = await Mcc.findOne({ code: '', name: '改碼' }).lean()
    if (fallback) {
      links.push({ categoryId: cat._id, targetId: fallback._id, targetType: 'modcodecategory', sortOrder: sortOrder++ })
    }

    if (!links.length) continue
    await CI.deleteMany({ categoryId: cat._id, targetType: 'modcodecategory' })
    await CI.insertMany(links)
    totalLinked += links.length
    console.log('已連結 ' + lookupId + '（' + cat.cName + '）→ ' + links.length + ' 個改碼類別')
  }

  console.log('完成，共連結 ' + totalLinked + ' 個改碼類別')
  await mongoose.disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
