const { makeModel } = require('../db/model')

// 跟餐組別：撞餐規則的飲品側記認
module.exports = makeModel(
  'bundlegroups',
  {
    name: 'text',
    price: 'numeric',
    sort: 'int',
    active: 'bool',
    date: 'timestamp'
  },
  'bundlegroup',
  {
    price: 0,
    sort: 0,
    active: true,
    date: () => new Date()
  }
)
