const { makeModel } = require('../db/model')

module.exports = makeModel(
  'qrcodes',
  {
    url: 'text',
    no: 'int'
  },
  'qrcode'
)
