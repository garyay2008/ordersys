const { makeModel } = require('../db/model')

module.exports = makeModel(
  'holds',
  {
    label: 'text',
    zone: 'text',
    deskNo: 'text',
    items: 'json',
    remark: 'text',
    terminalCode: 'text',
    staffNo: 'text',
    staffName: 'text',
    createdAt: 'timestamp'
  },
  'hold',
  {
    label: '',
    zone: '堂食',
    deskNo: '',
    items: [],
    remark: '',
    terminalCode: '',
    staffNo: '',
    staffName: '',
    createdAt: () => new Date()
  }
)
