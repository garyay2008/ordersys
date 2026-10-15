// 通用 PostgreSQL DAL 工廠：取代 mongoose 的 model，提供 async 的
// find / findOne / findById / countDocuments / create / updateOne /
// updateMany / findOneAndUpdate / findByIdAndUpdate / findOneAndRemove /
// findOneAndDelete / findByIdAndDelete / deleteOne / deleteMany / insertMany，
// 並支援 mongoose 的「new Model(doc) → doc.save()」與「findById 後改欄位再 save()」模式。
//
// 用法：const Model = makeModel(table, fields, modelName, defaults)
//   - Model 是可被 new 的建構子（new Model(data) 回傳帶 .save() 的文件）
//   - fields：{ camelCase: type }，type ∈ text|int|numeric|bool|json|timestamp|id
//   - 讀取時：snake_case 欄位 → camelCase 文件（含 _id 與 id 別名、numeric 轉 number）
//   - 寫入時：camelCase → snake_case，json 自動 JSON.stringify，numeric/int 轉 number
//
// 為保留「管理員帳號 vs 員工帳號」的判定，每個回傳文件帶一個不可列舉的
// MODEL_NAME symbol（值為 modelName），供 middleware/auth.js 使用。
const db = require('./pg')

const MODEL_NAME = Symbol('modelName')

function toSnake (s) {
  return s.replace(/([A-Z])/g, m => '_' + m.toLowerCase())
}

// 把 mongo 風格的 filter 轉成 WHERE 子句與參數陣列
// 支援：$in / $nin / $ne / $exists / $regex / $size / $gt / $gte / $lt / $lte / $or / $and
function buildWhere (filter, cols, types) {
  const params = []

  function isArrayField (key) {
    return types[key] === 'json'
  }

  function fieldClause (key, cond) {
    // 點狀路徑（如 'order.0'）：只支援 $exists，判段 JSONB 陣列是否為空
    const dot = key.indexOf('.')
    if (dot > 0) {
      const base = key.slice(0, dot)
      const baseCol = cols[base] || toSnake(base)
      if (cond !== null && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
        if (Object.prototype.hasOwnProperty.call(cond, '$exists')) {
          return cond.$exists
            ? [`jsonb_array_length(COALESCE(${baseCol}, '[]'::jsonb)) > 0`]
            : [`COALESCE(${baseCol}, '[]'::jsonb) = '[]'::jsonb`]
        }
      }
      return []
    }
    const col = key === '_id' ? '_id' : (cols[key] || toSnake(key))
    if (cond instanceof RegExp) {
      params.push(cond.source)
      const op = cond.flags.includes('i') ? '~*' : '~'
      return [`${col} ${op} $${params.length}`]
    }
    if (cond !== null && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
      const clauses = []
      for (const [op, val] of Object.entries(cond)) {
        if (op === '$in') {
          params.push(val)
          clauses.push(`${col} = ANY($${params.length})`)
        } else if (op === '$nin') {
          params.push(val)
          clauses.push(`NOT (${col} = ANY($${params.length}))`)
        } else if (op === '$ne') {
          if (val === null) {
            clauses.push(`${col} IS NOT NULL`)
          } else {
            params.push(val)
            // IS DISTINCT FROM 對應 mongoose $ne：NULL/缺欄視為「不等於」，與 mongo 語意一致
            clauses.push(`${col} IS DISTINCT FROM $${params.length}`)
          }
        } else if (op === '$exists') {
          clauses.push(val ? `${col} IS NOT NULL` : `${col} IS NULL`)
        } else if (op === '$regex') {
          params.push(val)
          clauses.push(`${col} ~ $${params.length}`)
        } else if (op === '$size') {
          params.push(Number(val))
          clauses.push(`jsonb_array_length(COALESCE(${col}, '[]'::jsonb)) = $${params.length}`)
        } else if (op === '$gt') {
          params.push(val); clauses.push(`${col} > $${params.length}`)
        } else if (op === '$gte') {
          params.push(val); clauses.push(`${col} >= $${params.length}`)
        } else if (op === '$lt') {
          params.push(val); clauses.push(`${col} < $${params.length}`)
        } else if (op === '$lte') {
          params.push(val); clauses.push(`${col} <= $${params.length}`)
        }
      }
      return clauses
    }
    if (cond === null) return [`${col} IS NULL`]
    // JSONB 陣列欄位以純量比對時，語意為「陣列包含該值」（對應 mongoose 陣列比對）
    if (isArrayField(key)) {
      params.push(JSON.stringify(cond))
      return [`${col} @> jsonb_build_array($${params.length}::jsonb)`]
    }
    params.push(cond)
    return [`${col} = $${params.length}`]
  }

  function walk (f) {
    const clauses = []
    for (const [key, cond] of Object.entries(f || {})) {
      if (key === '$or') {
        const subs = cond.map(sub => walk(sub))
        clauses.push('(' + subs.join(' OR ') + ')')
      } else if (key === '$and') {
        const subs = cond.map(sub => walk(sub))
        clauses.push('(' + subs.join(' AND ') + ')')
      } else {
        clauses.push(...fieldClause(key, cond))
      }
    }
    return clauses.join(' AND ')
  }

  const sql = walk(filter)
  return sql ? { where: ` WHERE ${sql}`, params } : { where: '', params }
}

function buildSort (sort, cols) {
  if (!sort) return ''
  if (typeof sort === 'string') return ` ORDER BY ${sort}`
  const entries = Object.entries(sort)
  if (!entries.length) return ''
  const parts = entries.map(([k, dir]) => {
    const col = k === '_id' ? '_id' : (cols[k] || toSnake(k))
    return `${col} ${Number(dir) < 0 ? 'DESC' : 'ASC'}`
  })
  return ` ORDER BY ${parts.join(', ')}`
}

// thenable 包裝：讓回傳值同時支援 await 與 mongoose 的 .lean/.select/.exec 鏈
function thenable (promise) {
  const wrap = {
    exec: () => promise,
    lean: () => wrap,
    select: () => wrap,
    sort: () => wrap,
    skip: () => wrap,
    limit: () => wrap,
    then: (res, rej) => promise.then(res, rej),
    catch: (rej) => promise.catch(rej),
    finally: (fn) => promise.finally(fn)
  }
  return wrap
}

// query 包裝：支援 .sort/.skip/.limit 累積後再於 .exec/.then 執行（供 find/findOne）
function makeQuery (run, opts) {
  const q = {
    _opts: Object.assign({}, opts || {}),
    sort (s) { this._opts.sort = s; return this },
    skip (n) { this._opts.skip = n; return this },
    limit (n) { this._opts.limit = n; return this },
    select () { return this },
    lean () { return this },
    exec () { return run(this._opts) },
    then (res, rej) { return run(this._opts).then(res, rej) },
    catch (rej) { return run(this._opts).catch(rej) },
    finally (fn) { return run(this._opts).finally(fn) }
  }
  return q
}

function makeModel (table, fields, modelName, defaults = {}) {
  const cols = {}
  const types = {}
  for (const [key, spec] of Object.entries(fields)) {
    const type = typeof spec === 'string' ? spec : spec.type
    const col = typeof spec === 'string' ? toSnake(key) : (spec.col || toSnake(key))
    cols[key] = col
    types[key] = type
  }

  function colOf (key) {
    return key === '_id' ? '_id' : (cols[key] || toSnake(key))
  }

  function toPgValue (key, val) {
    if (val === undefined) return null
    const t = types[key] || 'text'
    if (val === null) return null
    switch (t) {
      case 'json':
        return JSON.stringify(val)
      case 'int':
      case 'numeric':
        return Number(val)
      case 'bool':
        return !!val
      case 'timestamp': {
        const d = val instanceof Date ? val : new Date(val)
        return isNaN(d.getTime()) ? null : d
      }
      default:
        return String(val)
    }
  }

  function resolveDefault (v) {
    return typeof v === 'function' ? v() : v
  }

  // 把 $set 風格的內容轉成 { snake_col: pgValue }
  function normalizeSet (source) {
    const out = {}
    for (const [key, val] of Object.entries(source || {})) {
      if (key === '_id' || key === 'id') continue
      out[colOf(key)] = toPgValue(key, val)
    }
    return out
  }

  // 解析 update 為 set / inc / push / setOnInsert
  function buildUpdate (update) {
    const set = {}
    const inc = {}
    const push = {}
    const setOnInsert = {}
    for (const [op, val] of Object.entries(update || {})) {
      if (op === '$set') {
        Object.assign(set, normalizeSet(val))
      } else if (op === '$inc') {
        for (const [k, v] of Object.entries(val || {})) inc[colOf(k)] = Number(v)
      } else if (op === '$push') {
        for (const [k, v] of Object.entries(val || {})) push[colOf(k)] = v
      } else if (op === '$setOnInsert') {
        Object.assign(setOnInsert, normalizeSet(val))
      } else if (op === '$unset') {
        for (const k of Object.keys(val || {})) set[colOf(k)] = null
      } else if (!op.startsWith('$')) {
        Object.assign(set, normalizeSet({ [op]: val }))
      }
    }
    return { set, inc, push, setOnInsert }
  }

  // 產生 SET 子句；回傳 { assignments: [...], params: [...] }
  function buildAssignments (upd, startIdx) {
    const assignments = []
    const params = []
    let i = startIdx
    for (const [col, val] of Object.entries(upd.set)) {
      i++; params.push(val); assignments.push(`${col} = $${i}`)
    }
    for (const [col, amount] of Object.entries(upd.inc)) {
      i++; params.push(amount); assignments.push(`${col} = COALESCE(${col}, 0) + $${i}`)
    }
    for (const [col, val] of Object.entries(upd.push)) {
      i++; params.push(JSON.stringify(val)); assignments.push(`${col} = COALESCE(${col}, '[]'::jsonb) || jsonb_build_array($${i}::jsonb)`)
    }
    return { assignments, params, next: i }
  }

  function toDoc (row) {
    if (!row) return null
    const doc = { _id: row._id, id: row._id }
    Object.defineProperty(doc, MODEL_NAME, { value: modelName, enumerable: false })
    for (const [key, col] of Object.entries(cols)) {
      let v = row[col]
      const t = types[key]
      if (v === null || v === undefined) {
        doc[key] = null
      } else if (t === 'numeric' || t === 'int') {
        doc[key] = Number(v)
      } else {
        doc[key] = v
      }
    }
    attachDocMethods(doc)
    return doc
  }

  // 建構新文件（含 defaults + data + _id + save）
  function newDoc (data) {
    const doc = {}
    for (const key of Object.keys(defaults)) {
      doc[key] = resolveDefault(defaults[key])
    }
    Object.assign(doc, data || {})
    doc._id = (data && data._id) || db.newId()
    doc.id = doc._id
    Object.defineProperty(doc, MODEL_NAME, { value: modelName, enumerable: false })
    attachDocMethods(doc)
    return doc
  }

  // 插入文件；回傳 toDoc 結果
  async function insertDoc (doc) {
    const _id = doc._id || db.newId()
    const keys = Object.keys(cols).filter(k => doc[k] !== undefined)
    const columns = ['_id'].concat(keys.map(k => cols[k]))
    const placeholders = columns.map((_, i) => '$' + (i + 1))
    const values = [_id].concat(keys.map(k => toPgValue(k, doc[k])))
    const rows = await db.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    )
    return toDoc(rows[0])
  }

  // 附加文件方法：save() 與 toObject()（相容 mongoose 文件）
  function attachDocMethods (doc) {
    doc.toObject = function () {
      const out = {}
      for (const k of Object.keys(doc)) out[k] = doc[k]
      return out
    }
    // markModified 為 mongoose 巢狀陣列的修改標記；PG 的 save() 全欄位寫入，此處為 no-op
    doc.markModified = function () {}
    doc.save = async function () {
      const keys = Object.keys(cols).filter(k => doc[k] !== undefined)
      if (keys.length) {
        const assignments = []
        const params = []
        let i = 0
        for (const k of keys) {
          i++
          params.push(toPgValue(k, doc[k]))
          assignments.push(`${cols[k]} = $${i}`)
        }
        i++
        params.push(String(doc._id))
        const rows = await db.query(
          `UPDATE ${table} SET ${assignments.join(', ')} WHERE _id = $${i} RETURNING *`,
          params
        )
        if (rows.length) return toDoc(rows[0])
      }
      return insertDoc(doc)
    }
  }

  // ---- 底層實作（async，供內部與包裝層呼叫） ----

  async function findRows (filter, opts) {
    const { where, params } = buildWhere(filter, cols, types)
    let sql = `SELECT * FROM ${table}${where}${buildSort(opts.sort, cols)}`
    if (opts.limit != null) {
      params.push(Number(opts.limit))
      sql += ` LIMIT $${params.length}`
    }
    if (opts.skip != null) {
      params.push(Number(opts.skip))
      sql += ` OFFSET $${params.length}`
    }
    const rows = await db.query(sql, params)
    return rows.map(toDoc)
  }

  async function findOneRow (filter, opts) {
    const { where, params } = buildWhere(filter, cols, types)
    const sort = buildSort(opts.sort, cols)
    let sql = `SELECT * FROM ${table}${where}${sort} LIMIT 1`
    if (opts.skip != null) {
      params.push(Number(opts.skip))
      sql = `SELECT * FROM ${table}${where}${sort} OFFSET $${params.length} LIMIT 1`
    }
    const rows = await db.query(sql, params)
    return rows.length ? toDoc(rows[0]) : null
  }

  async function findByIdRow (id) {
    if (id === undefined || id === null) return null
    const rows = await db.query(`SELECT * FROM ${table} WHERE _id = $1 LIMIT 1`, [String(id)])
    return rows.length ? toDoc(rows[0]) : null
  }

  async function countRows (filter) {
    const { where, params } = buildWhere(filter, cols, types)
    const rows = await db.query(`SELECT COUNT(*)::int AS c FROM ${table}${where}`, params)
    return rows[0].c
  }

  async function create (data) {
    return insertDoc(newDoc(data))
  }

  async function insertMany (docs) {
    const out = []
    for (const d of docs) out.push(await insertDoc(newDoc(d)))
    return out
  }

  async function updateOneRow (filter, update) {
    const upd = buildUpdate(update)
    const { where, params } = buildWhere(filter, cols, types)
    const { assignments, params: setParams } = buildAssignments(upd, params.length)
    if (!assignments.length) return 0
    const rows = await db.query(
      `UPDATE ${table} SET ${assignments.join(', ')}${where} RETURNING _id`,
      params.concat(setParams)
    )
    return rows.length
  }

  async function findOneAndUpdateRow (filter, update, opts = {}) {
    const upd = buildUpdate(update)
    const { where, params } = buildWhere(filter, cols, types)
    const { assignments, params: setParams } = buildAssignments(upd, params.length)
    if (assignments.length) {
      const rows = await db.query(
        `UPDATE ${table} SET ${assignments.join(', ')}${where} RETURNING *`,
        params.concat(setParams)
      )
      if (rows.length) return toDoc(rows[0])
      if (!opts.upsert) return null
    } else if (!opts.upsert) {
      return findOneRow(filter)
    }

    // upsert：以 filter（僅簡單相等）+ $set / $setOnInsert / $inc / $push 合併後插入
    const ins = {}
    for (const [key, cond] of Object.entries(filter || {})) {
      if (cond !== null && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) continue
      if (cond !== null) ins[key] = cond
    }
    Object.assign(ins, update && update.$set ? update.$set : {})
    if (update && update.$setOnInsert) Object.assign(ins, update.$setOnInsert)
    if (update && update.$inc) Object.assign(ins, update.$inc)
    if (update && update.$push) {
      for (const [k, v] of Object.entries(update.$push)) ins[k] = [v]
    }
    return create(ins)
  }

  async function findOneAndRemoveRow (filter) {
    const { where, params } = buildWhere(filter, cols, types)
    const rows = await db.query(`DELETE FROM ${table}${where} RETURNING *`, params)
    return rows.length ? toDoc(rows[0]) : null
  }

  async function deleteManyRow (filter) {
    const { where, params } = buildWhere(filter, cols, types)
    const rows = await db.query(`DELETE FROM ${table}${where} RETURNING _id`, params)
    return rows.length
  }

  // ---- 公開方法（thenable，相容 await 與 .sort/.skip/.limit/.lean/.select/.exec 鏈） ----

  function find (filter = {}, opts = {}) {
    return makeQuery(o => findRows(filter, o), opts)
  }

  function findOne (filter = {}, opts = {}) {
    return makeQuery(o => findOneRow(filter, o), opts)
  }

  function findById (id) {
    return thenable(findByIdRow(id))
  }

  function countDocuments (filter = {}) {
    return thenable(countRows(filter))
  }

  function updateOne (filter, update) {
    return thenable(updateOneRow(filter, update))
  }

  function updateMany (filter, update) {
    return thenable(updateOneRow(filter, update))
  }

  function findOneAndUpdate (filter, update, opts = {}) {
    return thenable(findOneAndUpdateRow(filter, update, opts))
  }

  function findByIdAndUpdate (id, update, opts = {}) {
    return thenable(findOneAndUpdateRow({ _id: id }, update, opts))
  }

  function findOneAndRemove (filter) {
    return thenable(findOneAndRemoveRow(filter))
  }

  function findOneAndDelete (filter) {
    return thenable(findOneAndRemoveRow(filter))
  }

  function findByIdAndDelete (id) {
    return thenable(findOneAndRemoveRow({ _id: id }))
  }

  function deleteMany (filter) {
    return thenable(deleteManyRow(filter))
  }

  function deleteOne (filter) {
    return thenable(deleteManyRow(filter))
  }

  // 建構子：new Model(data) 回傳帶 .save() 的文件
  function Model (data) {
    return newDoc(data)
  }

  Model.MODEL_NAME = MODEL_NAME
  Model.find = find
  Model.findOne = findOne
  Model.findById = findById
  Model.countDocuments = countDocuments
  Model.create = create
  Model.insertMany = insertMany
  Model.updateOne = updateOne
  Model.updateMany = updateMany
  Model.findOneAndUpdate = findOneAndUpdate
  Model.findByIdAndUpdate = findByIdAndUpdate
  Model.findOneAndRemove = findOneAndRemove
  Model.findOneAndDelete = findOneAndDelete
  Model.findByIdAndDelete = findByIdAndDelete
  Model.deleteMany = deleteMany
  Model.deleteOne = deleteOne
  Object.defineProperty(Model, 'modelName', { get () { return modelName } })

  return Model
}

module.exports = { makeModel, MODEL_NAME, toSnake }
