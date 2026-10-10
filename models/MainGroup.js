const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 主菜組別：撞餐規則的主食側記認，與 Menu 分類無關。
// 由現有「分類」複印一份產生，撞餐規則改以此組別揀選主食。
const MainGroupSchema = new Schema({
  name: {
    type: String,
    required: true
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

module.exports = MainGroup = mongoose.model('maingroup', MainGroupSchema)
