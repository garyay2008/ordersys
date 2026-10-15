const { makeModel } = require('../db/model')

module.exports = makeModel(
  'businessdays',
  {
    date: 'text',
    openTime: 'timestamp',
    closeTime: 'timestamp',
    status: 'text',
    startingCash: 'numeric',
    countedCash: 'numeric',
    closeRemark: 'text',
    closeSeq: 'int',
    paidOuts: 'json',
    takeawaySeq: 'int',
    receiveds: 'json',
    snapshot: 'json',
    closeHistory: 'json',
    openedBy: 'text',
    closedBy: 'text',
    createdAt: 'timestamp'
  },
  'businessDay',
  {
    openTime: () => new Date(),
    status: 'open',
    startingCash: 0,
    countedCash: 0,
    closeRemark: '',
    closeSeq: 0,
    paidOuts: [],
    takeawaySeq: 0,
    receiveds: [],
    snapshot: {},
    closeHistory: [],
    openedBy: '',
    closedBy: '',
    createdAt: () => new Date()
  }
)
