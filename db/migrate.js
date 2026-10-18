// 版本化 migration runner：啟動時依序套用 db/migrations/ 下的 .sql / .js 檔案，
// 以 schema_migrations 表記錄已套用版本（version 取檔名前綴數字，每個只跑一次）。
// 檔案命名：{version}_{name}.{sql|js}，例如 001_add_orders_locked_at.sql。
const fs = require('fs')
const path = require('path')
const pg = require('./pg')

async function migrate () {
  await pg.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version integer PRIMARY KEY,
    name text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`)

  const applied = new Set(
    (await pg.query('SELECT version FROM schema_migrations')).map(r => Number(r.version))
  )

  const dir = path.join(__dirname, 'migrations')
  if (!fs.existsSync(dir)) return
  const files = fs.readdirSync(dir).filter(f => /^\d+_.+\.(sql|js)$/.test(f)).sort()

  for (const file of files) {
    const version = parseInt(file.split('_')[0], 10)
    if (applied.has(version)) continue

    const client = await pg.pool.connect()
    try {
      await client.query('BEGIN')
      if (file.endsWith('.js')) {
        const mod = require(path.join(dir, file))
        const up = typeof mod === 'function' ? mod : (mod && mod.up)
        if (typeof up === 'function') await up(client)
      } else {
        const sql = fs.readFileSync(path.join(dir, file), 'utf8')
        await client.query(sql)
      }
      await client.query(
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
        [version, file]
      )
      await client.query('COMMIT')
      console.log('[Migration] 已套用 ' + file)
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw new Error('[Migration] ' + file + ' 失敗：' + e.message)
    } finally {
      client.release()
    }
  }
}

module.exports = { migrate }
