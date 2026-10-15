const { makeModel } = require('../db/model')

// 主菜組別：撞餐規則的主食側記認
module.exports = makeModel(
  'maingroups',
  {
    name: 'text',
    sort: 'int',
    active: 'bool',
    date: 'timestamp'
  },
  'maingroup',
  {
    sort: 0,
    active: true,
    date: () => new Date()
  }
)
