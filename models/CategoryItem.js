const { makeModel } = require('../db/model')

module.exports = makeModel(
  'categoryitems',
  {
    categoryId: 'id',
    targetId: 'id',
    targetType: 'text',
    sortOrder: 'int',
    date: 'timestamp'
  },
  'categoryItem',
  {
    sortOrder: 0,
    date: () => new Date()
  }
)
