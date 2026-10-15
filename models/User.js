const { makeModel } = require('../db/model')

// 管理員帳號（後台最高權限，middleware/auth.js 以 modelName === 'users' 判定）
module.exports = makeModel(
  'users',
  {
    username: 'text',
    password: 'text',
    email: 'text',
    avatar: 'text',
    date: 'timestamp'
  },
  'users',
  {
    date: () => new Date()
  }
)
