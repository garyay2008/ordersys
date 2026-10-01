const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 桌號管理
const TableSchema = new Schema({
  no: {
    type: String,
    required: true
  },
  name: {
    type: String,
    default: ''
  },
  seats: {
    type: Number,
    default: 4
  },
  zone: {
    type: String,
    default: ''
  },
  x: {
    type: Number,
    default: null
  },
  y: {
    type: Number,
    default: null
  },
  enabled: {
    type: Boolean,
    default: true
  },
  physicalNo: {
    type: String,
    default: ''
  },
  shareSuffix: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    default: Date.now
  }
})

// 枱面依桌號查詢
TableSchema.index({ no: 1 })

module.exports = Table = mongoose.model('table', TableSchema)
