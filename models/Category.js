const { makeModel } = require('../db/model')

module.exports = makeModel(
  'categories',
  {
    code: 'text',
    cName: { type: 'text', col: 'cname' },
    describe: 'text',
    department: 'text',
    no: { type: 'int', col: 'sort_no' },
    active: 'bool',
    serviceModes: 'json',
    channels: 'json',
    effectiveTime: 'json',
    slots: 'json',
    commodityOrder: 'json',
    modCategories: 'json',
    colorFrom: 'text',
    colorTo: 'text',
    textColor: 'text',
    parentId: 'id',
    rootOrder: 'int',
    reportGroup: 'text'
  },
  'category',
  {
    code: '',
    describe: '',
    department: '',
    active: true,
    serviceModes: ['堂食', '外賣', '自取'],
    channels: ['pos', 'qr'],
    effectiveTime: { pos: { type: 'permanent' }, qr: { type: 'permanent' } },
    slots: [],
    commodityOrder: [],
    modCategories: [],
    colorFrom: '',
    colorTo: '',
    textColor: '#ffffff',
    parentId: null,
    rootOrder: null,
    reportGroup: ''
  }
)
