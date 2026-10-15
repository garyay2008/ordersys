const { makeModel } = require('../db/model')

// 店鋪資訊
module.exports = makeModel(
  'shops',
  {
    shopCode: 'text',
    shopName: 'text',
    shopIntro: 'text',
    shopNotice: 'text',
    shopImg: 'text'
  },
  'shop',
  {
    shopCode: '001',
    shopImg: ''
  }
)
