const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 區域 / 單別：堂食、外賣 等，可自訂新增
const ZoneSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  sort: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now
  }
})

module.exports = Zone = mongoose.model('zone', ZoneSchema)
