const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 跟餐組別：撞餐規則的飲品側記認，與 Menu 分類（凍飲/熱飲）無關。
// 每組別綁定一個跟餐價，撞餐配到該組別的飲品即用此價。
const BundleGroupSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    default: 0
  },
  sort: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  },
  date: {
    type: Date,
    default: Date.now
  }
})

module.exports = BundleGroup = mongoose.model('bundlegroup', BundleGroupSchema)
