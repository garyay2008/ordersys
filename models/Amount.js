const mongoose = require('mongoose')
const Schema = mongoose.Schema

const AmountSchema = new Schema({
  key: {
    type: String,
    required: true
  },
  value: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
})

module.exports = Amount = mongoose.model('amount', AmountSchema)
