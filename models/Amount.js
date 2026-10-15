const { makeModel } = require('../db/model')

// 支付方式 / 訂單型別（key=value 設定，如 payMethod=現金、payType=堂食）
module.exports = makeModel(
  'amounts',
  {
    key: 'text',
    value: 'text',
    date: 'timestamp'
  },
  'amount',
  {
    date: () => new Date()
  }
)
