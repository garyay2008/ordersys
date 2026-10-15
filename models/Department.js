const { makeModel } = require('../db/model')

// 部門管理：菜譜用部門（廚房/水吧/燒味/點心 等）
module.exports = makeModel(
  'departments',
  {
    name: 'text',
    code: 'text',
    sort: 'int',
    active: 'bool',
    showInSplit: 'bool',
    date: 'timestamp'
  },
  'department',
  {
    code: '',
    sort: 0,
    active: true,
    showInSplit: true,
    date: () => new Date()
  }
)
