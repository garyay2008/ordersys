// 一次性腳本：把 modCategories=['改碼'] 的商品更新為 M00000 完整子 lookup 清單
// 用法: node tools/fix_m00000_modcategories.js [ISM資料夾] [MONGO_URI]
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

function resolveM00000 () {
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
  const resolveModCats = (lid) => {
    const out = new Set()
    const seen = new Set()
    const walk = (id) => {
      if (!id || seen.has(id)) return
      seen.add(id)
      if (leafModName[id]) out.add(leafModName[id])
      for (const ch of (modChildren[id] || [])) walk(ch)
    }
    walk(lid)
    return Array.from(out)
  }
  return ['改碼', ...resolveModCats('M00000')]
}

async function main () {
  const full = resolveM00000()
  console.log('M00000 完整改碼類別清單（' + full.length + '）:')
  console.log(JSON.stringify(full, null, 2))

  await mongoose.connect(URI)
  const db = mongoose.connection.db
  const filter = { modCategories: ['改碼'] }
  const before = await db.collection('commodities').countDocuments(filter)
  const r = await db.collection('commodities').updateMany(filter, { $set: { modCategories: full } })
  console.log('符合條件商品數:', before, '; 更新筆數:', r.modifiedCount)
  await mongoose.disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
