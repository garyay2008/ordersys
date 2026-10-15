const { makeModel } = require('../db/model')

module.exports = makeModel(
  'queuetickets',
  {
    date: 'text',
    category: 'text',
    number: 'int',
    ticketNo: 'text',
    pax: 'int',
    status: 'text',
    calledAt: 'timestamp',
    seatedAt: 'timestamp',
    createdAt: 'timestamp'
  },
  'queueTicket',
  {
    pax: 1,
    status: 'waiting',
    createdAt: () => new Date()
  }
)
