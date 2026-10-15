const { makeModel } = require('../db/model')

module.exports = makeModel(
  'matchingrules',
  {
    name: 'text',
    enabled: 'bool',
    priority: 'int',
    triggerGroupIds: 'json',
    bundleGroupIds: 'json',
    addonPrice: 'numeric',
    effectiveTime: 'json',
    date: 'timestamp'
  },
  'matchingrule',
  {
    enabled: true,
    priority: 0,
    triggerGroupIds: [],
    bundleGroupIds: [],
    addonPrice: 0,
    effectiveTime: { type: 'permanent' },
    date: () => new Date()
  }
)
