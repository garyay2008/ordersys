const mongoose = require('mongoose')
const Schema = mongoose.Schema

const CategoryItemSchema = new Schema({
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: 'category',
    required: true,
    index: true
  },
  targetId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  targetType: {
    type: String,
    enum: ['category', 'combo', 'commodity', 'modcode', 'modcodecategory'],
    required: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now
  }
})

CategoryItemSchema.index({ categoryId: 1, sortOrder: 1 })

module.exports = CategoryItem = mongoose.model('categoryItem', CategoryItemSchema)
