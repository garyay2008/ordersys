const db = require('../db/pg')

const TABLE = 'zones'

// PG 列（snake_case）→ 回傳給前端的文件（camelCase，含 _id）
function toDoc (row) {
  return {
    _id: row._id,
    name: row.name,
    sort: row.sort,
    date: row.date
  }
}

module.exports = {
  // 對應 mongoose：Zone.find().sort({ sort: 1, date: 1 })
  find () {
    return db.query(`SELECT * FROM ${TABLE} ORDER BY sort ASC, date ASC`).then(rows => rows.map(toDoc))
  },

  // 對應 mongoose：new Zone({ name, sort }).save()
  create ({ name, sort }) {
    return db.query(
      `INSERT INTO ${TABLE} (_id, name, sort, date) VALUES ($1, $2, $3, $4)`,
      [db.newId(), name, sort || 0, new Date()]
    )
  },

  // 對應 mongoose：Zone.findOneAndRemove({ _id })
  findOneAndRemove ({ _id }) {
    return db.query(`DELETE FROM ${TABLE} WHERE _id = $1`, [_id])
  }
}
