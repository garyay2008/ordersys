const mongoose = require('mongoose')
const Schema = mongoose.Schema

const CategorySchema = new Schema({
  code: {
    type: String,
    default: ''
  },
  cName: {
    type: String,
    required: true
  },
  // 分類說明（客人 QR 點餐版面顯示在分類標題下方）
  describe: {
    type: String,
    default: ''
  },
  // 部門：頂層分組（對應 ISM department，如 廚部/水吧），空字串 = 未分類
  department: {
    type: String,
    default: ''
  },
  no: {
    type: Number,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  serviceModes: {
    type: [String],
    default: ['堂食', '外賣', '自取']
  },
  // 渠道開關：pos=收銀版面, qr=客人手機；舊資料無此欄位時視為兩邊都顯示
  channels: {
    type: [String],
    default: ['pos', 'qr']
  },
  effectiveTime: {
    type: {
      pos: {
        type: { type: String, enum: ['permanent', 'dateRange', 'weekly', 'disabled'], default: 'permanent' },
        startDate: { type: String, default: '' },
        endDate: { type: String, default: '' },
        startTime: { type: String, default: '' },
        endTime: { type: String, default: '' },
        weekdays: { type: [Number], default: [1, 2, 3, 4, 5] },
        holidays: { type: [String], default: [] }
      },
      qr: {
        type: { type: String, enum: ['permanent', 'dateRange', 'weekly', 'disabled'], default: 'permanent' },
        startDate: { type: String, default: '' },
        endDate: { type: String, default: '' },
        startTime: { type: String, default: '' },
        endTime: { type: String, default: '' },
        weekdays: { type: [Number], default: [1, 2, 3, 4, 5] },
        holidays: { type: [String], default: [] }
      }
    },
    default: { pos: { type: 'permanent' }, qr: { type: 'permanent' } }
  },
  // 時段設定：午市/下午茶等，到達時段時該分類自動排到 Lookup 最前
  slots: {
    type: [{
      name: { type: String, default: '' },
      start: { type: String, default: '' },
      end: { type: String, default: '' }
    }],
    default: []
  },
  commodityOrder: {
    type: [Schema.Types.ObjectId],
    default: []
  },
  // 此分類直接關聯的改碼類別名稱（對應 ModCodeCategory.name）
  modCategories: {
    type: [String],
    default: []
  },
  // 分類漸變色設定
  colorFrom: {
    type: String,
    default: ''
  },
  colorTo: {
    type: String,
    default: ''
  },
  textColor: {
    type: String,
    default: '#ffffff'
  },
  // 遞迴樹狀分類：父分類（null = 頂層）
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'category',
    default: null
  },
  // POS 第一層順序（對應 ISM 版面設定 lookup_id=0000 的順序；null = 非第一層）
  rootOrder: {
    type: Number,
    default: null
  },
  // 報表歸類：食品 / 飲品 / ''（日結清機報表「營業帳項」按此聚合）
  reportGroup: {
    type: String,
    default: ''
  }
})

module.exports = Category = mongoose.model('category', CategorySchema)
