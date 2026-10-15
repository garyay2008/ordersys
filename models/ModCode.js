const { makeModel } = require('../db/model')

module.exports = makeModel(
  'modcodes',
  {
    name: 'text',
    code: 'text',
    category: 'text',
    sort: 'int',
    price: 'numeric',
    specs: 'json',
    channels: 'json',
    mandatory: 'bool',
    maxSelect: 'int',
    station: 'text',
    soldOut: 'bool',
    quickKey: 'text',
    date: 'timestamp'
  },
  'modcode',
  {
    code: '',
    category: '',
    sort: 0,
    price: 0,
    specs: [],
    channels: ['pos', 'qr'],
    mandatory: false,
    maxSelect: 1,
    station: '',
    soldOut: false,
    quickKey: '',
    date: () => new Date()
  }
)
