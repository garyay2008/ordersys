const { makeModel } = require('../db/model')

const PRINTER_DEFAULT = { ip: '', port: 9100, tech: 'thermal', model: '', dpi: 180, paperWidth: 58, copies: 1, cashDrawer: false }

module.exports = makeModel(
  'posterminals',
  {
    code: 'text',
    name: 'text',
    location: 'text',
    type: 'text',
    enabled: 'bool',
    orderPrefix: 'text',
    orderSeq: 'int',
    printerIp: 'text',
    printerPort: 'int',
    cashDrawer: 'bool',
    receipt: 'json',
    serving: 'json',
    print: 'json',
    maxPermissionLevel: 'int',
    allowedFunctions: 'json',
    createdAt: 'timestamp'
  },
  'posterminal',
  {
    location: '',
    type: 'cashier',
    enabled: true,
    orderPrefix: '',
    orderSeq: 1,
    printerIp: '',
    printerPort: 9100,
    cashDrawer: false,
    receipt: PRINTER_DEFAULT,
    serving: PRINTER_DEFAULT,
    print: PRINTER_DEFAULT,
    maxPermissionLevel: 0,
    allowedFunctions: [],
    createdAt: () => new Date()
  }
)
