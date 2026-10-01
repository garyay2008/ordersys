const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 部門管理：菜譜用部門（廚房/水吧/燒味/點心 等），可由用戶自訂
const DepartmentSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  code: {
    type: String,
    default: ''
  },
  sort: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  },
  showInSplit: {
    type: Boolean,
    default: true
  },
  date: {
    type: Date,
    default: Date.now
  }
})

module.exports = Department = mongoose.model('department', DepartmentSchema)
