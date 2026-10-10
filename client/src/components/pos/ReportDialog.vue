<template>
  <el-dialog title="報表" :visible.sync="reportDialog.show" width="640px" custom-class="pos-dialog" append-to-body :close-on-click-modal="false">
    <template v-if="!reportDialog.result">
      <div style="margin-bottom: 16px;">
        <el-radio-group v-model="reportDialog.dateMode" size="small">
          <el-radio-button label="today">今日</el-radio-button>
          <el-radio-button label="past">往日</el-radio-button>
          <el-radio-button v-if="reportDialog.type === 'sales'" label="all">所有時間</el-radio-button>
        </el-radio-group>
      </div>
      <div v-if="!reportDialog.selecting" class="report-grid">
        <div v-for="r in visibleReportTypes" :key="r.id" class="report-grid-item" @click="selectReportType(r)">
          <div class="rgi-icon">{{ r.icon }}</div>
          <div class="rgi-name">{{ r.label }}</div>
        </div>
      </div>
      <div v-if="reportDialog.selecting" style="margin-top: 16px;">
        <el-divider content-position="left">{{ reportDialog.selecting.label }}</el-divider>
        <el-form label-width="100px" size="small">
          <el-form-item v-if="reportDialog.selecting.scope !== false" label="報表範圍">
            <el-radio-group v-model="reportDialog.scope">
              <el-radio label="all">全部</el-radio>
              <el-radio v-if="reportDialog.selecting.personal !== false" label="personal">個人（{{ staffInfo.name }}）</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="reportDialog.type === 'slotReport'" label="計算方式">
            <el-radio-group v-model="reportDialog.mode">
              <el-radio label="entry">入單計</el-radio>
              <el-radio label="settlement">埋單計</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="reportDialog.type === 'sales'" label="部門">
            <el-select v-model="reportDialog.department" size="small" style="width: 100%;" :disabled="reportDialog.category !== 'all'" @change="onDepartmentChange">
              <el-option v-for="d in departmentOptions" :key="d.value" :label="d.label" :value="d.value"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item v-if="reportDialog.type === 'sales'" label="分類">
            <el-select v-model="reportDialog.category" size="small" style="width: 100%;" :disabled="reportDialog.department !== 'all'" @change="onCategoryChange">
              <el-option v-for="c in categoryOptions" :key="c.value" :label="c.label" :value="c.value"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item v-if="reportDialog.type === 'sales'" label="貨品範圍">
            <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
              <el-input v-model="reportDialog.pluFrom" size="small" placeholder="編號由" style="width: 100%;"></el-input>
              <span style="flex-shrink: 0;">至</span>
              <el-input v-model="reportDialog.pluTo" size="small" placeholder="編號到" style="width: 100%;"></el-input>
            </div>
          </el-form-item>
          <el-form-item v-if="reportDialog.type === 'sales'" label="詳略">
            <el-radio-group v-model="reportDialog.detail" size="small">
              <el-radio-button label="detail">詳細</el-radio-button>
              <el-radio-button label="brief">簡略</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="reportDialog.dateMode === 'past'" label="時間範圍">
            <el-date-picker
              v-model="reportDialog.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="開始日期"
              end-placeholder="結束日期"
              value-format="yyyy-MM-dd"
              style="width: 100%;">
            </el-date-picker>
          </el-form-item>
          <el-form-item v-if="reportDialog.dateMode === 'past'" label="分市時段">
            <el-select v-model="reportDialog.slot" size="small" style="width: 100%;">
              <el-option label="全部時段" value="all"></el-option>
              <el-option v-for="s in posSlots" :key="s.name" :label="`${s.name}（${s.start} - ${s.end}）`" :value="s.name"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item v-if="reportDialog.dateMode === 'past' && (!reportDialog.dateRange || reportDialog.dateRange.length < 2)" label="選擇日期">
            <div style="color: #909399; font-size: 12px;">請選擇日期範圍（開始日期和結束日期）</div>
          </el-form-item>
        </el-form>
        <div style="text-align: right; margin-top: 8px;">
          <el-button size="small" @click="reportDialog.selecting = null">返回</el-button>
          <el-button size="small" type="primary" @click="generateReport">確定產生</el-button>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="report-result" id="reportPrintArea">
        <div class="report-result-header">
          <div class="rr-title">{{ reportDialog.result.title }}</div>
          <div class="rr-subtitle">{{ reportDialog.result.subtitle }}</div>
        </div>
        <template v-if="reportDialog.result.columns && reportDialog.result.columns.length">
          <el-table :data="reportDialog.result.data" size="mini" style="width: 100%;" :row-class-name="tableRowClassName">
            <el-table-column v-for="col in reportDialog.result.columns" :key="col.prop" :prop="col.prop" :label="col.label" :width="col.width" :align="col.align || 'left'">
              <template slot-scope="scope">
                <span :style="col.bold ? 'font-weight: bold;' : ''">{{ scope.row[col.prop] }}</span>
              </template>
            </el-table-column>
          </el-table>
        </template>
        <template v-else>
          <template v-if="isDailyClose || isSlotReport || isCashier || isCancel || isDiscount">
            <div v-for="(section, idx) in reportDialog.result.sections" :key="idx" class="report-section">
              <div class="rs-title">{{ section.title }}</div>
              <div v-for="(row, ri) in section.rows" :key="ri" class="dc-row" :class="{ 'dc-bold': row.bold }">
                <span class="dc-label">{{ row.label }}</span>
                <span class="dc-value">{{ dailyCloseValue(row) }}</span>
              </div>
              <div class="rs-divider"></div>
            </div>
            <div v-if="!reportDialog.result.sections || !reportDialog.result.sections.length" class="report-empty">暫無報表資料</div>
          </template>
          <template v-else>
            <div v-for="(section, idx) in reportDialog.result.sections" :key="idx" class="report-section">
              <div class="rs-title">{{ section.title }}</div>
              <el-table :data="section.rows" size="mini" style="width: 100%;">
                <el-table-column prop="label" label="項目" min-width="120"></el-table-column>
                <el-table-column prop="count" label="數量" width="80" align="right"></el-table-column>
                <el-table-column prop="amount" label="金額" width="120" align="right">
                  <template slot-scope="scope">
                    <span :class="{ 'rr-bold': scope.row.bold }">$ {{ formatMoney(scope.row.amount) }}</span>
                  </template>
                </el-table-column>
                <el-table-column v-if="sectionHasAverage(section)" prop="average" label="平均" width="80" align="right"></el-table-column>
                <el-table-column v-if="section.hasExtra" prop="extra" label="備註" min-width="140"></el-table-column>
              </el-table>
              <div class="rs-divider"></div>
            </div>
            <div v-if="!reportDialog.result.sections || !reportDialog.result.sections.length" class="report-empty">暫無報表資料</div>
          </template>
        </template>
        <div class="report-result-footer">
          <div>列印時間：{{ reportDialog.result.printTime }}</div>
          <div>操作員：{{ staffInfo.name }}（{{ staffInfo.no }}）</div>
        </div>
      </div>
    </template>
    <div slot="footer">
      <template v-if="!reportDialog.result">
        <el-button @click="reportDialog.show = false">退 出</el-button>
      </template>
      <template v-else>
        <el-button @click="reportDialog.result = null; reportDialog.selecting = null">返回選擇</el-button>
        <el-button @click="reportDialog.show = false">退 出</el-button>
        <el-button v-if="reportDialog.type !== 'monthly'" type="primary" icon="el-icon-printer" :loading="reportDialog.printing" @click="printReport">列印報表</el-button>
      </template>
    </div>
  </el-dialog>
</template>

<script>
import { formatMoney } from '../../utils/format'

export default {
  name: 'reportDialog',
  props: {
    reportDialog: { type: Object, required: true },
    reportTypes: { type: Array, default: () => [] },
    posSlots: { type: Array, default: () => [] },
    staffInfo: { type: Object, default: () => ({ name: '', no: '' }) }
  },
  data () {
    return {
      departments: [],
      categories: []
    }
  },
  mounted () {
    this.$axios.get('/api/department/list').then(res => { this.departments = res.data || [] }).catch(() => {})
    this.$axios.get('/api/category/all').then(res => {
      const list = res.data || []
      const seen = {}
      const names = []
      list.forEach(c => {
        if (c && c.cName && !seen[c.cName]) {
          seen[c.cName] = true
          names.push(c.cName)
        }
      })
      this.categories = names.sort()
    }).catch(() => {})
  },
  computed: {
    visibleReportTypes () {
      return this.reportTypes.filter(r => !r.hidden)
    },
    departmentOptions () {
      const opts = [{ label: '所有部門', value: 'all' }]
      this.departments.forEach(d => {
        const label = d.code ? (d.code + (d.name || '')) : (d.name || d.code || '')
        opts.push({ label, value: d.name || d.code || '' })
      })
      return opts
    },
    categoryOptions () {
      const opts = [{ label: '所有分類', value: 'all' }]
      this.categories.forEach(c => opts.push({ label: c, value: c }))
      return opts
    },
    isDailyClose () {
      return this.reportDialog.type === 'dailyClose'
    },
    isSlotReport () {
      return this.reportDialog.type === 'slotReport'
    },
    isCashier () {
      return this.reportDialog.type === 'cashier'
    },
    isCancel () {
      return this.reportDialog.type === 'cancel'
    },
    isDiscount () {
      return this.reportDialog.type === 'discount'
    }
  },
  methods: {
    formatMoney,
    tableRowClassName ({ row }) {
      return row && row._summary ? 'summary-row' : ''
    },
    dailyCloseValue (row) {
      const parts = []
      if (row.count !== undefined && row.count !== null && row.count !== '') parts.push(String(row.count))
      if (row.amount !== undefined && row.amount !== null && row.amount !== '') parts.push('$' + this.formatMoney(row.amount))
      if (row.tip !== undefined && row.tip !== null && row.tip !== '') parts.push('小賬 $' + this.formatMoney(row.tip))
      return parts.join('　')
    },
    sectionHasAverage (section) {
      return (section.rows || []).some(r => r.average !== undefined && r.average !== null && r.average !== '')
    },
    onDepartmentChange () {
      if (this.reportDialog.department !== 'all') {
        this.reportDialog.category = 'all'
      }
    },
    onCategoryChange () {
      if (this.reportDialog.category !== 'all') {
        this.reportDialog.department = 'all'
      }
    },
    selectReportType (r) {
      this.reportDialog.type = r.id
      this.reportDialog.scope = 'all'
      this.reportDialog.dateRange = []
      if (r.id === 'dailyClose' || r.id === 'discount') {
        this.reportDialog.selecting = null
        this.reportDialog.dateMode = 'today'
        this.generateReport()
      } else {
        this.reportDialog.selecting = r
        if (r.id === 'sales') {
          this.reportDialog.dateMode = 'today'
          this.reportDialog.department = 'all'
          this.reportDialog.category = 'all'
          this.reportDialog.pluFrom = ''
          this.reportDialog.pluTo = ''
          this.reportDialog.detail = 'detail'
        }
      }
    },
    generateReport () {
      let dateRange = this.reportDialog.dateRange
      if (this.reportDialog.dateMode === 'all') {
        const today = new Date()
        const y = today.getFullYear()
        const m = String(today.getMonth() + 1).padStart(2, '0')
        const d = String(today.getDate()).padStart(2, '0')
        dateRange = ['1970-01-01', y + '-' + m + '-' + d]
      } else if (this.reportDialog.dateMode === 'today') {
        const today = new Date()
        const y = today.getFullYear()
        const m = String(today.getMonth() + 1).padStart(2, '0')
        const d = String(today.getDate()).padStart(2, '0')
        if (this.reportDialog.type === 'monthly') {
          dateRange = [y + '-' + m + '-01', y + '-' + m + '-' + d]
        } else {
          dateRange = [y + '-' + m + '-' + d, y + '-' + m + '-' + d]
        }
      }
      if (!dateRange || dateRange.length < 2) {
        this.$message({ type: 'warning', message: '請選擇日期範圍' })
        return
      }
      const payload = {
        type: this.reportDialog.type,
        scope: this.reportDialog.scope,
        date_from: dateRange[0],
        date_to: dateRange[1],
        slot: (this.reportDialog.dateMode === 'today' || this.reportDialog.dateMode === 'all') ? 'all' : this.reportDialog.slot,
        waiter: this.reportDialog.scope === 'personal' ? this.staffInfo.name : '',
        mode: this.reportDialog.mode
      }
      if (this.reportDialog.type === 'sales') {
        payload.department = this.reportDialog.department || 'all'
        payload.category = this.reportDialog.category || 'all'
        payload.plu_from = this.reportDialog.pluFrom || ''
        payload.plu_to = this.reportDialog.pluTo || ''
        payload.detail = this.reportDialog.detail || 'detail'
      }
      this.$axios.post('/api/statistic/posReport', payload)
        .then(res => {
          this.reportDialog.result = res.data || { title: '報表', subtitle: '', rows: [], printTime: '' }
        })
        .catch(() => this.$message({ type: 'error', message: '獲取報表失敗' }))
    },
    printReport () {
      const report = this.reportDialog.result
      if (!report || this.reportDialog.printing) return
      this.reportDialog.printing = true
      this.$axios.post('/api/printer/printReport', {
        title: report.title,
        subtitle: report.subtitle,
        sections: report.sections,
        rows: report.rows,
        printTime: report.printTime,
        operator: `${this.staffInfo.name}（${this.staffInfo.no}）`
      })
        .then(() => this.$message({ type: 'success', message: '報表已送到打印機' }))
        .catch(err => this.$message({ type: 'error', message: (err && err.response && err.response.data) || '報表列印失敗' }))
        .finally(() => { this.reportDialog.printing = false })
    }
  }
}
</script>

<style scoped>
.report-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
.report-grid-item{ height: 80px; border: 1px solid #dcdfe6; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all .15s; }
.report-grid-item:hover{ border-color: #409eff; background: #ecf5ff; box-shadow: 0 2px 8px rgba(64,158,255,.2); }
.rgi-icon{ font-size: 24px; margin-bottom: 4px; }
.rgi-name{ font-size: 12px; color: #303133; font-weight: bold; }
.report-result{ padding: 10px 0; }
.report-result-header{ text-align: center; margin-bottom: 12px; }
.rr-title{ font-size: 18px; font-weight: bold; }
.rr-subtitle{ font-size: 12px; color: #909399; margin-top: 4px; }
.rr-bold{ font-weight: bold; }
.report-result-footer{ margin-top: 12px; font-size: 11px; color: #909399; border-top: 1px solid #ebeef5; padding-top: 8px; }
.report-section{ margin-bottom: 12px; }
.rs-title{ font-size: 14px; font-weight: bold; color: #303133; margin-bottom: 6px; }
.rs-divider{ height: 1px; background: #ebeef5; margin-top: 8px; }
.dc-row{ display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; font-size: 13px; color: #303133; border-bottom: 1px dashed #f0f2f5; }
.dc-label{ color: #303133; }
.dc-value{ color: #606266; font-variant-numeric: tabular-nums; }
.dc-bold .dc-label, .dc-bold .dc-value{ font-weight: bold; color: #303133; }
.report-empty{ text-align: center; color: #909399; padding: 20px 0; }
::v-deep .summary-row td{ font-weight: bold; background-color: #f5f7fa; }
</style>
