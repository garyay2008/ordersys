<template>
  <el-dialog :title="clockDialog.mode === 'in' ? '☀️ 上班打卡' : '🌙 下班打卡'" :visible.sync="clockDialog.show" width="360px" custom-class="pos-dialog" append-to-body :close-on-click-modal="false">
    <!-- 上班模式 -->
    <div v-if="clockDialog.mode === 'in'" style="padding: 8px 0; text-align: center;">
      <div style="font-size: 36px; color: #67c23a; margin-bottom: 12px;"><i class="el-icon-sunrise-1"></i></div>
      <div style="font-size: 16px; font-weight: 700; color: #303133; margin-bottom: 8px;">{{ staffInfo.name }}</div>
      <div v-if="selectedTerminal" style="font-size: 13px; color: #909399; margin-bottom: 12px;">
        <i class="el-icon-monitor"></i> {{ selectedTerminal }}
      </div>
      <div style="margin-bottom: 12px;">
        <div style="font-size: 12px; color: #909399; margin-bottom: 4px;">你的員工編號：{{ staffInfo.no }}</div>
        <el-input ref="clockStaffInput" v-model="clockDialog.staffNo" placeholder="請輸入員工編號確認" size="medium" @keyup.enter.native="confirmClockIn">
          <template slot="prepend"><i class="el-icon-user"></i></template>
        </el-input>
      </div>
      <div style="font-size: 13px; color: #606266;">
        確認要上班打卡嗎？
      </div>
    </div>
    <!-- 下班模式 -->
    <div v-if="clockDialog.mode === 'out'" style="padding: 8px 0; text-align: center;">
      <div style="font-size: 36px; color: #f56c6c; margin-bottom: 12px;"><i class="el-icon-moon"></i></div>
      <div style="font-size: 16px; font-weight: 700; color: #303133; margin-bottom: 8px;">{{ staffInfo.name }}</div>
      <div v-if="selectedTerminal" style="font-size: 13px; color: #909399; margin-bottom: 8px;">
        <i class="el-icon-monitor"></i> {{ selectedTerminal }}
      </div>
      <div v-if="shiftInfo" style="font-size: 13px; color: #606266; margin-bottom: 12px;">
        <div><i class="el-icon-time"></i> 上班時間：{{ formatTime(shiftInfo.clockInTime) }}</div>
      </div>
      <div style="margin-bottom: 12px;">
        <div style="font-size: 12px; color: #909399; margin-bottom: 4px;">你的員工編號：{{ staffInfo.no }}</div>
        <el-input ref="clockStaffInput" v-model="clockDialog.staffNo" placeholder="請輸入員工編號確認" size="medium" @keyup.enter.native="confirmClockOut">
          <template slot="prepend"><i class="el-icon-user"></i></template>
        </el-input>
      </div>
      <div style="font-size: 13px; color: #606266;">
        確認要下班打卡嗎？
      </div>
    </div>
    <!-- 數字鍵盤 -->
    <div class="clock-numpad">
      <div v-for="n in ['1','2','3','4','5','6','7','8','9']" :key="n" class="clock-np-key" @click="clockInputDigit(n)">{{ n }}</div>
      <div class="clock-np-key clock-np-fn" @click="clockInputDel"><i class="el-icon-delete"></i></div>
      <div class="clock-np-key" @click="clockInputDigit('0')">0</div>
      <div class="clock-np-key clock-np-fn" @click="clockInputClear">C</div>
    </div>
    <div slot="footer">
      <el-button @click="clockDialog.show = false">取 消</el-button>
      <el-button v-if="clockDialog.mode === 'in'" type="success" :loading="clockDialog.loading" :disabled="!clockDialog.staffNo" @click="confirmClockIn">上 班</el-button>
      <el-button v-else type="danger" :loading="clockDialog.loading" :disabled="!clockDialog.staffNo" @click="confirmClockOut">下 班</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'clockDialog',
  props: {
    clockDialog: { type: Object, required: true },
    staffInfo: { type: Object, default: () => ({ name: '', no: '' }) },
    selectedTerminal: { type: String, default: '' },
    shiftInfo: { type: Object, default: null }
  },
  watch: {
    'clockDialog.show' (v) {
      if (v) {
        this.$nextTick(() => {
          const input = this.$refs.clockStaffInput
          if (input && input.focus) input.focus()
        })
      }
    }
  },
  methods: {
    clockInputDigit (d) {
      this.clockDialog.staffNo = (this.clockDialog.staffNo || '') + d
    },
    clockInputDel () {
      this.clockDialog.staffNo = (this.clockDialog.staffNo || '').slice(0, -1)
    },
    clockInputClear () {
      this.clockDialog.staffNo = ''
    },
    confirmClockIn () {
      const staffNo = (this.clockDialog.staffNo || '').trim()
      if (!staffNo) {
        this.$message({ type: 'warning', message: '請輸入員工編號！' })
        return
      }
      this.clockDialog.loading = true
      this.$axios.post('/api/clock/in', {
        staffNo,
        terminalCode: this.selectedTerminal
      }).then(res => {
        this.$message({ type: 'success', message: res.data.message || '上班打卡成功！' })
        this.clockDialog.show = false
        this.$emit('shift-changed', res.data.shift || null)
      }).catch(err => {
        this.$message({ type: 'error', message: (err.response && err.response.data) || '打卡失敗' })
      }).finally(() => { this.clockDialog.loading = false })
    },
    confirmClockOut () {
      const staffNo = (this.clockDialog.staffNo || '').trim()
      if (!staffNo) {
        this.$message({ type: 'warning', message: '請輸入員工編號！' })
        return
      }
      this.clockDialog.loading = true
      this.$axios.post('/api/clock/out', {
        staffNo,
        terminalCode: this.selectedTerminal,
        remark: ''
      }).then(res => {
        this.clockDialog.show = false
        this.$message({ type: 'success', message: '下班打卡成功！' })
        this.$emit('shift-changed', null)
      }).catch(err => {
        this.$message({ type: 'error', message: (err.response && err.response.data) || '打卡失敗' })
      }).finally(() => { this.clockDialog.loading = false })
    },
    formatTime (d) {
      if (!d) return '--'
      const t = new Date(d)
      const p = n => (n < 10 ? '0' + n : '' + n)
      return `${p(t.getHours())}:${p(t.getMinutes())}`
    }
  }
}
</script>

<style scoped>
.clock-numpad{ display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin:0 8px 8px; }
.clock-np-key{ text-align:center; padding:12px; border:1px solid #e5eaf2; border-radius:8px; font-size:18px; font-weight:600; color:#303133; cursor:pointer; transition:all .1s; background:#fff; user-select:none; }
.clock-np-key:active{ background:#ecf5ff; border-color:#409eff; transform:scale(.96); }
.clock-np-fn{ color:#f56c6c; }
</style>
