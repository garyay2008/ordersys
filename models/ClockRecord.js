const { makeModel } = require('../db/model')

module.exports = makeModel(
  'clockrecords',
  {
    staffNo: 'text',
    staffName: 'text',
    terminalCode: 'text',
    clockInTime: 'timestamp',
    clockOutTime: 'timestamp',
    status: 'text',
    remark: 'text',
    date: 'timestamp'
  },
  'clockRecord',
  {
    staffNo: '',
    staffName: '',
    terminalCode: '',
    clockInTime: null,
    clockOutTime: null,
    status: 'active',
    remark: '',
    date: () => new Date()
  }
)
