const { makeModel } = require('../db/model')

const QueueSetting = makeModel(
  'queuesettings',
  {
    enabled: 'bool',
    voiceEnabled: 'bool',
    title: 'text',
    subtitle: 'text',
    categories: 'json',
    updatedAt: 'timestamp'
  },
  'queuesetting',
  {
    enabled: true,
    voiceEnabled: true,
    title: '排隊叫號',
    subtitle: '請取票後在候餐區等候',
    categories: [],
    updatedAt: () => new Date()
  }
)

QueueSetting.getDefault = function () {
  return {
    enabled: true,
    voiceEnabled: true,
    title: '排隊叫號',
    subtitle: '請取票後在候餐區等候',
    categories: [
      { prefix: 'A', label: '1-2 人', minPax: 1, maxPax: 2, color: '#409eff' },
      { prefix: 'B', label: '3-4 人', minPax: 3, maxPax: 4, color: '#67c23a' },
      { prefix: 'C', label: '5 人以上', minPax: 5, maxPax: 99, color: '#e6a23c' }
    ]
  }
}

module.exports = QueueSetting
