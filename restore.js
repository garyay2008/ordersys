// 一鍵還原腳本：將 full backup JSON 寫回 MongoDB
// 用法：
//   node restore.js <backup.json> [--dry-run] [--collections=a,b,c] [--append]
//   MONGO_URI=mongodb://mongo:27017/orderSYS node restore.js /seed/backup.json
//
// 預設行為：對備份中出現的每個集合先 deleteMany({}) 再 insertMany（整庫還原）。
// 加 --append 則不清集合，只追加寫入（_id 衝突會跳過該筆）。
// 加 --dry-run 只解析並列出集合/筆數，不寫庫。
// 加 --collections=orders,tables 只還原指定集合。

const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

const MONGO_URI = process.env.MONGO_URI || require('./config/config').mongoURI

function parseArgs (argv) {
  const opts = { file: null, dryRun: false, append: false, collections: null }
  for (const a of argv) {
    if (a === '--dry-run') opts.dryRun = true
    else if (a === '--append') opts.append = true
    else if (a.startsWith('--collections=')) {
      opts.collections = a.slice('--collections='.length).split(',').map(s => s.trim()).filter(Boolean)
    } else if (!a.startsWith('--') && !opts.file) {
      opts.file = a
    }
  }
  return opts
}

// 24 位 hex 字串 -> ObjectId
function toObjectIdIfHex (val) {
  if (typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val)) {
    try {
      return new mongoose.Types.ObjectId(val)
    } catch (e) {
      return val
    }
  }
  return val
}

// ISO 日期字串 -> Date（只針對已知日期欄位，避免誤轉）
const DATE_KEYS = new Set([
  'date', 'createdAt', 'updatedAt', 'openTime', 'closeTime',
  'clockIn', 'clockOut', 'businessDate', 'settledAt', 'payTime',
  'voidAt', 'refundAt', 'printTime', 'orderTime', 'checkTime'
])

function reviveValue (key, val) {
  if (Array.isArray(val)) return val.map(v => reviveValue(key, v))
  if (val && typeof val === 'object' && val.constructor === Object) {
    const out = {}
    for (const [k, v] of Object.entries(val)) out[k] = reviveValue(k, v)
    return out
  }
  if (typeof val === 'string') {
    // _id / *Id / *Ids 欄位：hex 轉 ObjectId
    if (key === '_id' || /Id$/.test(key) || /Ids$/.test(key)) {
      const oid = toObjectIdIfHex(val)
      if (oid !== val) return oid
    }
    // 日期欄位：ISO 字串轉 Date
    if (DATE_KEYS.has(key) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      const d = new Date(val)
      if (!isNaN(d.getTime())) return d
    }
  }
  return val
}

function reviveDoc (doc) {
  const out = {}
  for (const [k, v] of Object.entries(doc)) out[k] = reviveValue(k, v)
  // 頂層 _id 必轉（備份中是 24 位 hex 字串）
  if (typeof out._id === 'string') {
    const oid = toObjectIdIfHex(out._id)
    if (oid !== out._id) out._id = oid
  }
  return out
}

async function main () {
  const opts = parseArgs(process.argv.slice(2))
  if (!opts.file) {
    console.error('用法: node restore.js <backup.json> [--dry-run] [--collections=a,b,c] [--append]')
    process.exit(1)
  }
  const file = path.resolve(opts.file)
  if (!fs.existsSync(file)) {
    console.error('備份文件不存在: ' + file)
    process.exit(1)
  }

  const raw = fs.readFileSync(file, 'utf8')
  let backup
  try {
    backup = JSON.parse(raw)
  } catch (e) {
    console.error('備份文件不是有效 JSON: ' + e.message)
    process.exit(1)
  }

  let names = Object.keys(backup).filter(n => !n.startsWith('system.'))
  if (opts.collections) {
    const want = new Set(opts.collections)
    names = names.filter(n => want.has(n))
    if (!names.length) {
      console.error('指定的集合在備份中不存在: ' + opts.collections.join(','))
      process.exit(1)
    }
  }

  console.log('備份文件: ' + file)
  console.log('目標庫: ' + MONGO_URI.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@'))
  let total = 0
  for (const n of names) {
    const docs = Array.isArray(backup[n]) ? backup[n] : []
    console.log(`  ${n}: ${docs.length} 筆`)
    total += docs.length
  }
  console.log(`共 ${names.length} 個集合，${total} 筆資料${opts.append ? '（append 模式，不清空）' : ''}`)

  if (opts.dryRun) {
    console.log('[dry-run] 未寫入資料庫')
    process.exit(0)
  }

  await mongoose.connect(MONGO_URI)
  const db = mongoose.connection.db
  try {
    for (const name of names) {
      const docs = Array.isArray(backup[name]) ? backup[name] : []
      if (!opts.append) {
        await db.collection(name).deleteMany({})
      }
      if (!docs.length) {
        console.log(`[${name}] 已清空，備份為空，跳過寫入`)
        continue
      }
      const revived = docs.map(reviveDoc)
      // 分批寫入，避免單次 insertMany 過大
      const BATCH = 500
      let ok = 0
      let skipped = 0
      for (let i = 0; i < revived.length; i += BATCH) {
        const batch = revived.slice(i, i + BATCH)
        try {
          await db.collection(name).insertMany(batch, { ordered: false })
          ok += batch.length
        } catch (e) {
          // append 模式下 _id 衝突屬正常：統計成功筆數
          if (e && e.result && typeof e.result.nInserted === 'number') {
            ok += e.result.nInserted
            skipped += batch.length - e.result.nInserted
          } else {
            throw e
          }
        }
      }
      console.log(`[${name}] 寫入 ${ok} 筆${skipped ? `（跳過 ${skipped} 筆 _id 衝突）` : ''}`)
    }
    console.log('全部資料還原完成！')
  } catch (e) {
    console.error('還原失敗: ' + e.message)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
