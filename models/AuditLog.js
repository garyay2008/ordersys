const { makeModel } = require('../db/model')

module.exports = makeModel(
  'auditlogs',
  {
    staffNo: 'text',
    staffName: 'text',
    action: 'text',
    actionLabel: 'text',
    deskNo: 'text',
    orderNo: 'text',
    detail: 'text',
    amount: 'numeric',
    date: 'timestamp'
  },
  'auditlog',
  {
    staffNo: '',
    staffName: '',
    action: '',
    actionLabel: '',
    deskNo: '',
    orderNo: '',
    detail: '',
    amount: 0,
    date: () => new Date()
  }
)
