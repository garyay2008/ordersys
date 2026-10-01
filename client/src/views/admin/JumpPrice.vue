<template>
  <div id="jumpprice">
    <el-card>
      <div slot="header" class="clearfix">
        <span>貨價跳價錢設定</span>
        <span class="tip">全局規則：依星期／假日＋堂食／外賣＋生效時間＋結束時間，把貨品價跳到指定價格（價格1～價格10）</span>
      </div>
      <el-row>
        <el-button type="primary" size="small" @click="addRule">+ 添加跳價規則</el-button>
        <el-button type="success" size="small" @click="save">儲 存</el-button>
      </el-row>
      <el-row class="row-height">
        <el-col :span="24">
          <el-table :data="rules" size="medium" style="width: 100%;">
            <el-table-column align="center" width="130" label="星期／假日">
              <template slot-scope="scope">
                <el-select v-model="scope.row.days" size="small" style="width: 110px;">
                  <el-option label="一至五" value="weekdays"></el-option>
                  <el-option label="六" value="saturday"></el-option>
                  <el-option label="日" value="sunday"></el-option>
                  <el-option label="公眾假期" value="holiday"></el-option>
                </el-select>
              </template>
            </el-table-column>
            <el-table-column align="center" width="150" label="生效時間">
              <template slot-scope="scope">
                <el-time-select v-model="scope.row.start" :picker-options="{ start: '00:00', step: '00:05', end: '23:55' }" placeholder="生效時間" size="small" style="width: 120px;"></el-time-select>
              </template>
            </el-table-column>
            <el-table-column align="center" width="150" label="結束時間">
              <template slot-scope="scope">
                <el-time-select v-model="scope.row.end" :picker-options="{ start: '00:00', step: '00:05', end: '23:55' }" placeholder="結束時間" size="small" style="width: 120px;"></el-time-select>
              </template>
            </el-table-column>
            <el-table-column align="center" width="150" label="計價時機">
              <template slot-scope="scope">
                <el-select v-model="scope.row.timing" size="small" style="width: 120px;">
                  <el-option label="開枱計" value="open"></el-option>
                  <el-option label="入單計" value="order"></el-option>
                  <el-option label="埋單計" value="checkout"></el-option>
                </el-select>
              </template>
            </el-table-column>
            <el-table-column align="center" width="130" label="堂食／外賣">
              <template slot-scope="scope">
                <el-select v-model="scope.row.mode" size="small" style="width: 110px;">
                  <el-option label="全部" value="all"></el-option>
                  <el-option label="堂食" value="堂食"></el-option>
                  <el-option label="外賣" value="外賣"></el-option>
                </el-select>
              </template>
            </el-table-column>
            <el-table-column align="center" width="150" label="跳價幾">
              <template slot-scope="scope">
                <el-select v-model="scope.row.specIndex" size="small" style="width: 120px;">
                  <el-option v-for="n in 10" :key="n" :label="'價格' + n" :value="n"></el-option>
                </el-select>
              </template>
            </el-table-column>
            <el-table-column align="center" width="80" label="操作">
              <template slot-scope="scope">
                <el-button type="text" size="small" @click="removeRule(scope.$index)">刪除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-col>
      </el-row>
    </el-card>

    <el-card style="margin-top: 14px;">
      <div slot="header" class="clearfix">
        <span>公眾假期設定</span>
        <span class="tip">設定為公眾假期的日期，跳價規則中「公眾假期」會於這些日期生效</span>
      </div>
      <el-row>
        <el-date-picker v-model="newHoliday" type="date" value-format="yyyy-MM-dd" format="yyyy-MM-dd" placeholder="選擇日期" size="small" style="width: 200px;"></el-date-picker>
        <el-button type="primary" size="small" style="margin-left: 8px;" @click="addHoliday">添加公眾假期</el-button>
        <el-button type="success" size="small" style="margin-left: 8px;" @click="exportHolidays">滙出</el-button>
        <el-button type="warning" size="small" style="margin-left: 8px;" @click="triggerImportHolidays">滙入</el-button>
        <input ref="holidayFileInput" type="file" accept=".csv,.txt,text/plain" style="display:none" @change="handleImportHolidays">
      </el-row>
      <div class="holiday-list">
        <el-tag v-for="(h, i) in holidays" :key="i" closable type="warning" style="margin: 4px;">{{ h }}</el-tag>
        <span v-if="!holidays.length" class="tip" style="margin-left: 0;">尚未設定公眾假期</span>
      </div>
    </el-card>
  </div>
</template>

<script>
export default {
  name: 'jumpprice',
  data () {
    return {
      rules: [],
      holidays: [],
      newHoliday: ''
    }
  },
  methods: {
    loadData () {
      this.$axios.get('/api/possetting/get')
        .then(res => {
          this.rules = (res.data && Array.isArray(res.data.jumpPriceRules)) ? res.data.jumpPriceRules.map(r => ({
            days: r.days || 'weekdays',
            start: r.start || '00:00',
            end: r.end || '',
            timing: r.timing || 'order',
            mode: r.mode || 'all',
            specIndex: r.specIndex || 1
          })) : []
          this.holidays = (res.data && Array.isArray(res.data.publicHolidays)) ? res.data.publicHolidays.slice() : []
        })
        .catch(() => { this.rules = []; this.holidays = [] })
    },
    addRule () {
      this.rules.push({ days: 'weekdays', start: '00:00', end: '', timing: 'order', mode: 'all', specIndex: 1 })
    },
    removeRule (index) {
      this.rules.splice(index, 1)
    },
    addHoliday () {
      const d = (this.newHoliday || '').trim()
      if (!d) return
      if (this.holidays.indexOf(d) >= 0) {
        this.$message({ type: 'warning', message: '該日期已存在' })
        return
      }
      this.holidays.push(d)
      this.newHoliday = ''
    },
    removeHoliday (index) {
      this.holidays.splice(index, 1)
    },
    exportHolidays () {
      if (!this.holidays.length) {
        this.$message({ type: 'warning', message: '尚未設定公眾假期，無法匯出' })
        return
      }
      const csv = 'date\n' + this.holidays.join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `public_holidays_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      this.$message({ type: 'success', message: '滙出成功！' })
    },
    triggerImportHolidays () {
      this.$refs.holidayFileInput.click()
    },
    handleImportHolidays (e) {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target.result || ''
        const tokens = text.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean)
        const dates = []
        for (const t of tokens) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(new Date(t).getTime())) dates.push(t)
        }
        if (!dates.length) {
          this.$message({ type: 'error', message: '找不到有效的日期（格式：YYYY-MM-DD）' })
          return
        }
        let added = 0
        const skipped = []
        dates.forEach(d => {
          if (this.holidays.indexOf(d) < 0) {
            this.holidays.push(d)
            added++
          } else {
            skipped.push(d)
          }
        })
        this.$message({ type: 'success', message: `已滙入 ${added} 個公眾假期${skipped.length ? `（${skipped.length} 個已存在跳過）` : ''}` })
      }
      reader.readAsText(file)
      e.target.value = ''
    },
    save () {
      const cleaned = this.rules
        .filter(r => r && r.days && r.start)
        .map(r => ({
          days: r.days,
          start: r.start,
          end: r.end || '',
          timing: r.timing || 'order',
          mode: r.mode || 'all',
          specIndex: Number(r.specIndex) || 1
        }))
      this.$axios.post('/api/possetting/save', { jumpPriceRules: cleaned, publicHolidays: this.holidays.slice() })
        .then(res => {
          this.$message({ type: 'success', message: res.data || '儲存成功！' })
          this.loadData()
        })
        .catch(() => this.$message({ type: 'error', message: '儲存失敗，請重試！' }))
    }
  },
  created () {
    this.loadData()
  }
}
</script>

<style scoped>
#jumpprice{ height: 100%; }
.row-height{ margin-top: 10px; overflow: auto; }
.tip{ margin-left: 10px; color: #909399; font-size: 12px; }
.holiday-list{ margin-top: 10px; }
</style>
