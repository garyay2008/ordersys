const { makeModel } = require('../db/model')

module.exports = makeModel(
  'chartsdatas',
  {
    date: 'text',
    order: { type: 'int', col: 'order_count' },
    income: 'numeric'
  },
  'chartsdata',
  {
    order: 0,
    income: 0
  }
)
