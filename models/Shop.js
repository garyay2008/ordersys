const mongoose = require('mongoose')
const Schema = mongoose.Schema

const ShopSchema = new Schema({
  // 分店代碼（日結報表「分店/店舖」顯示，如 001）
  shopCode: {
    type: String,
    default: '001'
  },
  shopName: {
    type: String,
    required: true
  },
  shopIntro: {
    type: String,
    required: true
  },
  shopNotice: {
    type: String,
    required: true
  },
  shopImg: {
    type: String
  }
})

module.exports = Shop = mongoose.model('shop', ShopSchema)
