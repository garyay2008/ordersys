const { makeModel } = require('../db/model')

// 用戶管理：POS 員工（服務員/收銀員）
module.exports = makeModel(
  'staffs',
  {
    name: 'text',
    no: 'text',
    role: 'text',
    permissionLevel: 'int',
    permissions: 'json',
    defaultTerminal: 'text',
    password: 'text',
    enabled: 'bool',
    date: 'timestamp'
  },
  'staff',
  {
    no: '',
    role: '服務員',
    permissionLevel: 1,
    permissions: [],
    defaultTerminal: '',
    password: '',
    enabled: true,
    date: () => new Date()
  }
)
