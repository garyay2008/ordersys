const { makeModel } = require('../db/model')

module.exports = makeModel(
  'inits',
  {
    admin: 'bool',
    shop: 'bool'
  },
  'init',
  {
    admin: false,
    shop: false
  }
)
