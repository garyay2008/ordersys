const { makeModel } = require('../db/model')

module.exports = makeModel(
  'modcodecategories',
  {
    name: 'text',
    code: 'text',
    mandatory: 'bool',
    minSelect: 'int',
    maxSelect: 'int',
    commodityIds: 'json',
    sort: 'int',
    date: 'timestamp'
  },
  'modcodecategory',
  {
    code: '',
    mandatory: false,
    minSelect: 0,
    maxSelect: 0,
    commodityIds: [],
    sort: 0,
    date: () => new Date()
  }
)
