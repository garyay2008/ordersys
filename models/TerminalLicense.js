const { makeModel } = require('../db/model')

// 分機（收銀機/工作站）授權：以收銀機編號（PosTerminal.code）綁定
module.exports = makeModel(
  'terminallicenses',
  {
    code: 'text',
    key: 'text',
    activatedAt: 'timestamp'
  },
  'terminallicense',
  {
    activatedAt: () => new Date()
  }
)
