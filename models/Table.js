const { makeModel } = require('../db/model')

// 桌號管理
module.exports = makeModel(
  'tables',
  {
    no: 'text',
    name: 'text',
    seats: 'int',
    zone: 'text',
    x: 'numeric',
    y: 'numeric',
    enabled: 'bool',
    physicalNo: 'text',
    shareSuffix: 'text',
    date: 'timestamp'
  },
  'table',
  {
    name: '',
    seats: 4,
    zone: '',
    x: null,
    y: null,
    enabled: true,
    physicalNo: '',
    shareSuffix: '',
    date: () => new Date()
  }
)
