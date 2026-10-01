const mongoose = require('mongoose')
const Schema = mongoose.Schema

// 排隊叫號設定（singleton）
const QueueSettingSchema = new Schema({
  enabled: { type: Boolean, default: true },
  // 叫號語音（瀏覽器 TTS）
  voiceEnabled: { type: Boolean, default: true },
  // 顯示屏標題
  title: { type: String, default: '排隊叫號' },
  // 副標題 / 公告
  subtitle: { type: String, default: '請取票後在候餐區等候' },
  // 人數分類：prefix 用於編號前綴（A/B/C…）
  categories: [{
    prefix: { type: String, default: '' },
    label: { type: String, default: '' },
    minPax: { type: Number, default: 1 },
    maxPax: { type: Number, default: 99 },
    color: { type: String, default: '#409eff' }
  }],
  updatedAt: { type: Date, default: Date.now }
})

QueueSettingSchema.statics.getDefault = function () {
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

module.exports = mongoose.model('queueSetting', QueueSettingSchema)
