const { makeModel } = require('../db/model')

module.exports = makeModel(
  'menusettings',
  {
    showImages: 'bool',
    showPrice: 'bool',
    showDescribe: 'bool',
    showSoldOut: 'bool',
    autoRotate: 'bool',
    rotateInterval: 'int',
    columns: 'int',
    fontScale: 'numeric',
    categoryIds: 'json',
    themeColor: 'text',
    date: 'timestamp'
  },
  'menusetting',
  {
    showImages: true,
    showPrice: true,
    showDescribe: false,
    showSoldOut: true,
    autoRotate: true,
    rotateInterval: 8,
    columns: 4,
    fontScale: 1,
    categoryIds: [],
    themeColor: '',
    date: () => new Date()
  }
)
