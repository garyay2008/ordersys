const { makeModel } = require('../db/model')

module.exports = makeModel(
  'kiosksettings',
  {
    paymentMethods: 'json',
    fpsQrImage: 'text',
    showImages: 'bool',
    terminalCode: 'text',
    dineIn: 'bool',
    takeaway: 'bool',
    payByOrderNo: 'bool',
    date: 'timestamp'
  },
  'kiosksetting',
  {
    paymentMethods: ['八達通', '行動支付'],
    fpsQrImage: '',
    showImages: true,
    terminalCode: '',
    dineIn: true,
    takeaway: true,
    payByOrderNo: true,
    date: () => new Date()
  }
)
