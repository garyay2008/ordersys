const { makeModel } = require('../db/model')

module.exports = makeModel(
  'qrsettings',
  {
    showImages: 'bool',
    showDescribe: 'bool',
    showStock: 'bool',
    showModPrices: 'bool',
    showSoldOutItems: 'bool',
    showNotice: 'bool',
    showDetail: 'bool',
    showDiscount: 'bool',
    theme: 'text',
    fontScale: 'numeric',
    baseUrl: 'text',
    welcomeImage: 'text',
    showSpecs: 'bool',
    date: 'timestamp'
  },
  'qrsetting',
  {
    showImages: true,
    showDescribe: true,
    showStock: false,
    showModPrices: true,
    showSoldOutItems: true,
    showNotice: true,
    showDetail: true,
    showDiscount: true,
    theme: 'orange',
    fontScale: 1,
    baseUrl: '',
    welcomeImage: '',
    showSpecs: false,
    date: () => new Date()
  }
)
