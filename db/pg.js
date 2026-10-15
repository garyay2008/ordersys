const { Pool } = require('pg')
const crypto = require('crypto')
const config = require('../config/config')

// 連線池：取代 mongoose 的底層連線，供 DAL 使用
const pool = new Pool({
  connectionString: config.pgConn,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
})

pool.on('error', err => {
  console.error('[pg] idle client error:', err.message)
})

// 執行查詢，回傳 rows 陣列
async function query (text, params) {
  const start = Date.now()
  const res = await pool.query(text, params)
  const dur = Date.now() - start
  if (dur > 200) console.log('[pg] slow query', dur + 'ms:', text.slice(0, 80))
  return res.rows
}

// 產生與 Mongo ObjectId 相同的 24 位 hex 字串，維持前端 _id 行為一致
function newId () {
  return crypto.randomBytes(12).toString('hex')
}

module.exports = { pool, query, newId }
