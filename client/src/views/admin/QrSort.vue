<template>
  <div id="qrsort">
    <div class="content-header">
      <div class="section-title" style="margin-bottom: 0;">QR 分類排序</div>
      <div class="content-actions">
        <el-button size="small" @click="loadQrData"><i class="el-icon-refresh"></i> 重新載入</el-button>
        <el-button size="small" type="primary" @click="saveQrOrder">儲存 QR 排序</el-button>
      </div>
    </div>

    <div class="qr-panel">
      <div class="qr-sort">
        <div class="section-title">
          QR 分類排序 <el-tag size="mini" type="info">{{ qrSortList.length }}</el-tag>
          <span class="section-tip">拖曳或上/下移動；點眼睛隱藏分類；點時鐘設定 QR 生效時間（僅影響 QR）</span>
        </div>
        <div v-if="!qrSortList.length" class="empty-tip">暫無 QR 分類（請確認分類已勾選「QR 手機」渠道）</div>
        <div v-else class="qr-sort-list">
          <div v-for="(cat, idx) in qrSortList" :key="cat._id" class="qr-sort-item" :class="{ active: qrSelectedId === cat._id, hidden: !cat.visible }"
               draggable="true"
               @dragstart="qrDragStart(idx)" @dragover.prevent="qrDragOver(idx)" @dragend="qrDragEnd"
               @click="qrSelectedId = cat._id">
            <span class="qr-sort-index">{{ idx + 1 }}</span>
            <span class="qr-sort-name">{{ cat.name }}</span>
            <span v-if="cat.code" class="qr-sort-code">{{ cat.code }}</span>
            <span v-if="!cat.visible" class="qr-hidden-badge">已隱藏</span>
            <span class="qr-sort-count">{{ (qrFoodMap[cat._id] || []).length }}</span>
            <div class="qr-sort-actions">
              <el-button type="text" size="mini" :title="'QR 生效時間：' + formatEt(qrEtOf(cat)) + '（僅影響 QR，不影響 POS）'" @click.stop="openQrEt(cat)">
                <i class="el-icon-time" :style="{ color: qrEtIconColor(cat) }"></i>
              </el-button>
              <el-button type="text" size="mini" :title="cat.visible ? '隱藏於 QR' : '顯示於 QR'" @click.stop="qrToggleVisible(idx)">
                <i class="el-icon-view" :style="cat.visible ? '' : 'opacity:.35'"></i>
              </el-button>
              <el-button type="text" size="mini" :disabled="idx === 0" @click.stop="qrMoveUp(idx)"><i class="el-icon-top"></i></el-button>
              <el-button type="text" size="mini" :disabled="idx === qrSortList.length - 1" @click.stop="qrMoveDown(idx)"><i class="el-icon-bottom"></i></el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="qr-preview">
        <div class="section-title">手機預覽</div>
        <div class="phone-mock">
          <div class="phone-rail">
            <div v-for="cat in qrVisibleList" :key="'rail' + cat._id" class="phone-rail-item" :class="{ current: qrSelectedId === cat._id }" @click="qrSelectedId = cat._id">
              {{ cat.name }}
            </div>
          </div>
          <div class="phone-body">
            <template v-if="qrSelectedHidden">
              <div class="phone-empty">此分類已隱藏，不會在 QR 顯示</div>
            </template>
            <template v-else-if="qrPreviewCat">
              <div class="phone-cat-title">{{ qrPreviewCat.name }}</div>
              <div v-for="f in (qrFoodMap[qrPreviewCat._id] || [])" :key="'f' + String(f._id)" class="phone-food">
                <span class="phone-food-name">{{ f.name }}</span>
                <span class="phone-food-price">${{ f.price }}</span>
              </div>
              <div v-if="!(qrFoodMap[qrPreviewCat._id] || []).length" class="phone-empty">（此分類無貨品）</div>
            </template>
            <div v-else class="phone-empty">請點擊左側分類</div>
          </div>
        </div>
      </div>
    </div>

    <!-- QR 生效時間 Dialog -->
    <el-dialog title="設定 QR 生效時間" :visible.sync="qrEtVisible" width="480px" append-to-body>
      <div class="qr-et-name">分類：{{ qrEtForm.name }}</div>
      <div class="field-tip" style="margin-bottom: 12px;">僅影響「QR 手機菜單」的分類顯示，不影響 POS 收銀。</div>
      <el-form label-width="80px" size="small">
        <el-form-item label="生效方式">
          <el-select v-model="qrEtForm.type" style="width: 180px;">
            <el-option label="永久" value="permanent"></el-option>
            <el-option label="生效日期" value="dateRange"></el-option>
            <el-option label="星期" value="weekly"></el-option>
            <el-option label="不生效" value="disabled"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item v-if="qrEtForm.type === 'dateRange'" label="日期範圍">
          <el-date-picker v-model="qrEtForm.startDate" type="date" placeholder="開始日期" value-format="yyyy-MM-dd" size="small" style="width: 42%;"></el-date-picker>
          <span style="margin: 0 6px;">~</span>
          <el-date-picker v-model="qrEtForm.endDate" type="date" placeholder="結束日期" value-format="yyyy-MM-dd" size="small" style="width: 42%;"></el-date-picker>
        </el-form-item>
        <el-form-item v-if="qrEtForm.type === 'weekly'" label="星期">
          <el-checkbox-group v-model="qrEtForm.weekdays">
            <el-checkbox v-for="dw in weekdayOptions" :key="'qet'+dw.value" :label="dw.value">{{ dw.label }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item v-if="qrEtForm.type === 'dateRange' || qrEtForm.type === 'weekly'" label="時間段">
          <el-input v-model="qrEtForm.startTime" placeholder="HH:mm" size="small" style="width: 120px;"></el-input>
          <span style="margin: 0 6px;">~</span>
          <el-input v-model="qrEtForm.endTime" placeholder="HH:mm" size="small" style="width: 120px;"></el-input>
        </el-form-item>
      </el-form>
      <span slot="footer">
        <el-button @click="qrEtVisible = false">取消</el-button>
        <el-button type="primary" class="btn-shadow" @click="saveQrEt">確定</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'qrsort',
  data: function () {
    return {
      weekdayOptions: [
        { value: 1, label: '一' }, { value: 2, label: '二' }, { value: 3, label: '三' },
        { value: 4, label: '四' }, { value: 5, label: '五' }, { value: 6, label: '六' }, { value: 7, label: '日' }
      ],
      weekdayMap: { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '日' },
      allFlatCategories: [],
      qrCategoryOrder: [],
      qrSortList: [],
      qrFoodMap: {},
      qrSelectedId: '',
      qrDragIndex: -1,
      qrDragOverIndex: -1,
      qrEtVisible: false,
      qrEtForm: { id: '', name: '', pos: null, type: 'permanent', startDate: '', endDate: '', startTime: '', endTime: '', weekdays: [1, 2, 3, 4, 5], holidays: [] }
    }
  },
  computed: {
    qrVisibleList: function () {
      return this.qrSortList.filter(function (c) { return c.visible !== false })
    },
    qrPreviewCat: function () {
      var self = this
      return this.qrVisibleList.find(function (c) { return c._id === self.qrSelectedId }) || this.qrVisibleList[0] || null
    },
    qrSelectedHidden: function () {
      var self = this
      var cat = this.qrSortList.find(function (c) { return c._id === self.qrSelectedId })
      return !!(cat && cat.visible === false)
    }
  },
  methods: {
    loadQrData: function () {
      var self = this
      this.$axios.get('/api/possetting/get')
        .then(function (res) {
          self.qrCategoryOrder = (res.data && Array.isArray(res.data.qrCategoryOrder)) ? res.data.qrCategoryOrder : []
          return self.$axios.get('/api/category/all')
        })
        .then(function (res) {
          self.allFlatCategories = res.data || []
          self.buildQrSortList()
          return self.$axios.get('/api/commodity/menu', { params: { mode: '堂食', channel: 'qr' } })
        })
        .then(function (res) {
          self.buildQrFoodMap(res.data || [])
        })
        .catch(function () {
          self.buildQrSortList()
          self.buildQrFoodMap([])
        })
    },
    buildQrSortList: function () {
      var orderMap = {}
      this.qrCategoryOrder.forEach(function (entry, i) {
        var id = String(entry && entry.id ? entry.id : entry)
        if (!id) return
        orderMap[id] = {
          index: i,
          visible: !(entry && typeof entry === 'object' && entry.visible === false)
        }
      })
      var eligible = this.allFlatCategories.filter(function (c) {
        var ch = (c.channels && c.channels.length) ? c.channels : ['pos', 'qr']
        return ch.indexOf('qr') >= 0 && c.active !== false
      })
      var ordered = eligible.filter(function (c) { return orderMap[String(c._id)] })
        .sort(function (a, b) { return orderMap[String(a._id)].index - orderMap[String(b._id)].index })
      var rest = eligible.filter(function (c) { return !orderMap[String(c._id)] })
        .sort(function (a, b) { return (a.no - b.no) || (String(a._id) < String(b._id) ? -1 : 1) })
      this.qrSortList = ordered.concat(rest).map(function (c) {
        var m = orderMap[String(c._id)]
        return { _id: String(c._id), code: c.code || '', name: c.cName || c.name || '', visible: m ? m.visible : true, effectiveTime: c.effectiveTime || null }
      })
    },
    buildQrFoodMap: function (menu) {
      var map = {}
      ;(menu || []).forEach(function (cat) {
        map[String(cat._id)] = (cat.foods || []).map(function (f) {
          return { _id: f._id, name: f.name, price: f.price }
        })
      })
      this.qrFoodMap = map
    },
    qrMoveUp: function (idx) {
      if (idx <= 0) return
      var arr = this.qrSortList
      var tmp = arr[idx - 1]
      this.$set(arr, idx - 1, arr[idx])
      this.$set(arr, idx, tmp)
    },
    qrMoveDown: function (idx) {
      if (idx >= this.qrSortList.length - 1) return
      var arr = this.qrSortList
      var tmp = arr[idx + 1]
      this.$set(arr, idx + 1, arr[idx])
      this.$set(arr, idx, tmp)
    },
    qrToggleVisible: function (idx) {
      var item = this.qrSortList[idx]
      if (!item) return
      this.$set(item, 'visible', !item.visible)
    },
    qrDragStart: function (idx) {
      this.qrDragIndex = idx
    },
    qrDragOver: function (idx) {
      this.qrDragOverIndex = idx
    },
    qrDragEnd: function () {
      var from = this.qrDragIndex
      var to = this.qrDragOverIndex
      this.qrDragIndex = -1
      this.qrDragOverIndex = -1
      if (from < 0 || to < 0 || from === to) return
      var arr = this.qrSortList
      var moved = arr.splice(from, 1)[0]
      arr.splice(to, 0, moved)
    },
    saveQrOrder: function () {
      var self = this
      var order = this.qrSortList.map(function (c) {
        return { id: String(c._id), visible: c.visible !== false }
      })
      this.$axios.post('/api/possetting/save', { qrCategoryOrder: order })
        .then(function () {
          self.qrCategoryOrder = order
          self.$message({ type: 'success', message: 'QR 排序已儲存！' })
          return self.$axios.get('/api/commodity/menu', { params: { mode: '堂食', channel: 'qr' } })
        })
        .then(function (res) {
          self.buildQrFoodMap(res.data || [])
        })
        .catch(function (err) {
          self.$message({ type: 'error', message: (err.response && err.response.data) || '儲存失敗' })
        })
    },
    qrEtOf: function (cat) {
      var et = (cat && cat.effectiveTime) || {}
      return et.qr || { type: 'permanent', startDate: '', endDate: '', startTime: '', endTime: '', weekdays: [1, 2, 3, 4, 5], holidays: [] }
    },
    qrEtIconColor: function (cat) {
      var et = this.qrEtOf(cat)
      if (!et || et.type === 'permanent') return '#c0c4cc'
      if (et.type === 'disabled') return '#F56C6C'
      return '#409EFF'
    },
    openQrEt: function (cat) {
      var full = (cat && cat.effectiveTime) || {}
      var qr = this.cloneEt(full.qr)
      this.qrEtForm = {
        id: String(cat._id),
        name: cat.name || '',
        pos: this.cloneEt(full.pos),
        type: qr.type,
        startDate: qr.startDate,
        endDate: qr.endDate,
        startTime: qr.startTime,
        endTime: qr.endTime,
        weekdays: qr.weekdays,
        holidays: qr.holidays
      }
      this.qrEtVisible = true
    },
    saveQrEt: function () {
      var self = this
      var qr = {
        type: this.qrEtForm.type || 'permanent',
        startDate: this.qrEtForm.startDate || '',
        endDate: this.qrEtForm.endDate || '',
        startTime: this.qrEtForm.startTime || '',
        endTime: this.qrEtForm.endTime || '',
        weekdays: this.qrEtForm.weekdays || [1, 2, 3, 4, 5],
        holidays: this.qrEtForm.holidays || []
      }
      var pos = this.qrEtForm.pos || { type: 'permanent', startDate: '', endDate: '', startTime: '', endTime: '', weekdays: [1, 2, 3, 4, 5], holidays: [] }
      this.$axios.post('/api/category/edit', { _id: this.qrEtForm.id, effectiveTime: { pos: pos, qr: qr } })
        .then(function () {
          self.$message({ type: 'success', message: 'QR 生效時間已儲存！' })
          self.qrEtVisible = false
          self.loadQrData()
        })
        .catch(function (err) {
          self.$message({ type: 'error', message: (err.response && err.response.data) || '儲存失敗' })
        })
    },
    cloneEt: function (src) {
      if (!src) return { type: 'permanent', startDate: '', endDate: '', startTime: '', endTime: '', weekdays: [1, 2, 3, 4, 5], holidays: [] }
      return {
        type: src.type || 'permanent',
        startDate: src.startDate || '',
        endDate: src.endDate || '',
        startTime: src.startTime || '',
        endTime: src.endTime || '',
        weekdays: (src.weekdays || [1, 2, 3, 4, 5]).slice(),
        holidays: (src.holidays || []).slice()
      }
    },
    formatWeekdays: function (weekdays) {
      if (!weekdays || !weekdays.length) return '一至五'
      var map = this.weekdayMap
      return weekdays.slice().sort().map(function (d) { return map[d] }).join('、')
    },
    formatEt: function (et) {
      if (!et || et.type === 'permanent') return '永久'
      if (et.type === 'disabled') return '不生效'
      if (et.type === 'dateRange') {
        var s = (et.startDate || '?') + ' ~ ' + (et.endDate || '?')
        if (et.startTime && et.endTime) s += ' ' + et.startTime + '~' + et.endTime
        return s
      }
      if (et.type === 'weekly') {
        var s2 = '週' + this.formatWeekdays(et.weekdays)
        if (et.startTime && et.endTime) s2 += ' ' + et.startTime + '~' + et.endTime
        return s2
      }
      return '永久'
    }
  },
  created: function () {
    this.loadQrData()
  }
}
</script>

<style scoped>
#qrsort { height: 100%; display: flex; flex-direction: column; }
.content-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
.content-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.section-title { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.section-tip { font-size: 12px; font-weight: normal; color: #909399; margin-left: 8px; }
.empty-tip { text-align: center; color: #c0c4cc; padding: 20px 0; font-size: 13px; }
.btn-shadow { box-shadow: 0px 0px 20px rgba(53, 141, 230, 0.562); }
.field-tip { margin-top: 4px; color: #909399; font-size: 12px; }
.qr-et-name { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 8px; }
.qr-panel { display: flex; gap: 16px; flex: 1; min-height: 0; }
.qr-sort { width: 500px; flex-shrink: 0; display: flex; flex-direction: column; }
.qr-sort-list { flex: 1; overflow-y: auto; border: 1px solid #EBEEF5; border-radius: 4px; }
.qr-sort-item { display: flex; align-items: center; padding: 8px 10px; border-bottom: 1px solid #F2F6FC; cursor: pointer; transition: background 0.15s; }
.qr-sort-item:hover { background: #F5F7FA; }
.qr-sort-item.active { background: #ECF5FF; }
.qr-sort-item:last-child { border-bottom: none; }
.qr-sort-index { width: 26px; text-align: center; color: #909399; font-size: 12px; flex-shrink: 0; }
.qr-sort-name { flex: 1; min-width: 0; font-size: 13px; color: #303133; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qr-sort-code { font-size: 11px; color: #909399; margin-left: 6px; flex-shrink: 0; font-family: Menlo, Monaco, Consolas, monospace; }
.qr-hidden-badge { display: inline-block; font-size: 10px; color: #E6A23C; background: #FDF6EC; padding: 1px 6px; border-radius: 3px; margin-left: 6px; flex-shrink: 0; white-space: nowrap; }
.qr-sort-count { font-size: 12px; color: #909399; margin-left: 6px; flex-shrink: 0; }
.qr-sort-actions { display: flex; align-items: center; flex-shrink: 0; margin-left: 4px; }
.qr-sort-actions .el-button { padding: 2px; margin-left: 1px; }
.qr-preview { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.phone-mock { flex: 1; display: flex; border: 8px solid #303133; border-radius: 24px; overflow: hidden; min-height: 0; background: #f7f7f7; }
.phone-rail { width: 96px; flex-shrink: 0; background: #f0f2f5; overflow-y: auto; border-right: 1px solid #E4E7ED; }
.phone-rail-item { padding: 12px 8px; font-size: 12px; color: #606266; text-align: center; cursor: pointer; border-bottom: 1px solid #EBEEF5; }
.phone-rail-item.current { background: #fff; color: #409EFF; font-weight: 700; }
.phone-body { flex: 1; overflow-y: auto; padding: 12px; }
.phone-cat-title { font-size: 15px; font-weight: 700; color: #303133; margin-bottom: 10px; }
.phone-food { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #EBEEF5; font-size: 13px; }
.phone-food-name { color: #303133; }
.phone-food-price { color: #E6A23C; font-weight: 600; }
.phone-empty { color: #c0c4cc; font-size: 12px; padding: 12px 0; }
</style>
