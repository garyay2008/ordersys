<template>
  <div id="print-monitor">
    <el-tabs v-model="activeTab" @tab-click="onTabClick">
      <el-tab-pane label="CUPS 列印監控" name="cups">
        <el-row :gutter="12">
          <el-col :span="6">
        <el-select v-model="queue" placeholder="選擇印表機佇列" style="width: 100%;" @change="refresh">
          <el-option v-for="q in queues" :key="q" :label="q" :value="q"></el-option>
        </el-select>
      </el-col>
      <el-col :span="4">
        <el-button type="primary" size="small" :loading="loading" @click="refresh">重新整理</el-button>
        <el-button size="small" icon="el-icon-plus" @click="openCreate">新增佇列</el-button>
      </el-col>
      <el-col :span="14" class="status-bar">
        <el-tag :type="online ? 'success' : 'danger'" effect="dark">
          {{ online ? '印表機連線中' : '印表機離線' }}
        </el-tag>
        <span class="count-lbl">排隊單數：<strong>{{ jobs.length }}</strong></span>
        <el-button size="small" type="danger" icon="el-icon-delete" @click="removeQueue">刪除佇列</el-button>
      </el-col>
    </el-row>

    <el-alert
      title="數據流：貨品 (Item) → 打印機隊列 (Printer Queue) → 位置打印機 (Position Printer)"
      type="warning"
      :closable="false"
      show-icon
      description="貨品管理裡給每個貨品選「打印機隊列」（檔口），下單時按隊列自動路由到對應的「位置打印機」打印。打印機隊列 (Printer Queue)：快蒸/慢蒸/腸粉煎炸/大排檔/上什/粉面/海鮮/冷盤/熱炒…，打印機隊列 (Printer Queue) 可隨意修改。"
      style="margin-bottom: 10px;">
    </el-alert>

    <el-row class="row-height">
      <el-col :span="24">
        <el-table :data="jobs" size="medium" :max-height="tableHeight" style="width: 100%">
          <el-table-column align="center" prop="jobId" label="Job ID" width="100"></el-table-column>
          <el-table-column align="center" prop="station" label="檔口" width="130"></el-table-column>
          <el-table-column align="center" prop="desk" label="枱號" width="90"></el-table-column>
          <el-table-column align="center" prop="orderNo" label="單號" width="150"></el-table-column>
          <el-table-column align="center" width="170" label="開始時間">
            <template slot-scope="scope">{{ formatTime(scope.row.createdAt) }}</template>
          </el-table-column>
          <el-table-column align="center" width="170" label="結束時間">
            <template slot-scope="scope">{{ formatTime(scope.row.completedAt) }}</template>
          </el-table-column>
          <el-table-column align="center" width="140" label="狀態">
            <template slot-scope="scope">
              <el-tag size="mini" :type="stateTagType(scope.row)">{{ scope.row.state }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column fixed="right" align="center" width="120" label="操作">
            <template slot-scope="scope">
              <el-button v-if="isCancelable(scope.row)" type="text" size="small" style="color:#f56c6c;" @click="cancel(scope.row.jobId)">取消列印</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-col>
      </el-row>
      </el-tab-pane>

      <el-tab-pane label="BullMQ 列印佇列" name="bull">
        <iframe v-if="bullSrc" :src="bullSrc" class="bull-frame"></iframe>
        <div v-else class="bull-placeholder">載入 Bull Board 儀表板…</div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog title="新增印表機佇列" :visible.sync="createDialog" width="440px" append-to-body>
      <el-form label-width="90px" size="small">
        <el-form-item label="佇列名稱">
          <el-input v-model="createForm.name" placeholder="如 kitchen121"></el-input>
        </el-form-item>
        <el-form-item label="打印機 IP">
          <el-input v-model="createForm.ip" placeholder="如 192.168.3.121"></el-input>
        </el-form-item>
        <el-form-item label="端口">
          <el-input-number v-model="createForm.port" :min="1" :max="65535" controls-position="right"></el-input-number>
          <span class="tip">預設 9100，以 Raw 佇列 socket://IP:9100 建立</span>
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button size="small" @click="createDialog = false">取消</el-button>
        <el-button size="small" type="primary" :loading="creating" @click="createQueue">建立</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'printmonitor',
  sockets: {
    printFailed (payload) {
      const station = (payload && payload.station) || '打印機'
      const message = (payload && payload.message) || '列印失敗'
      this.$notify({
        title: '列印失敗告警',
        message: `${station}：${message}`,
        type: 'error',
        duration: 0
      })
    }
  },
  data () {
    return {
      activeTab: 'cups',
      bullSrc: '',
      queues: [],
      queue: '',
      jobs: [],
      online: false,
      loading: false,
      tableHeight: window.innerHeight - 200,
      timer: null,
      createDialog: false,
      creating: false,
      createForm: { name: '', ip: '', port: 9100 }
    }
  },
  methods: {
    onTabClick (tab) {
      if (tab.name === 'bull') this.loadBullBoard()
    },
    loadBullBoard () {
      // 先建立監控會話 cookie（JWT 驗證），再載入 Bull Board，避免 Basic Auth 彈窗
      this.$axios.post('/api/print/queueui-session')
        .then(() => { this.bullSrc = '/admin/queues/' })
        .catch(() => { this.bullSrc = '/admin/queues/' })
    },
    loadQueues () {
      return this.$axios.get('/api/print/queues')
        .then(res => {
          const printers = (res.data && res.data.printers) || []
          this.queues = printers.map(p => p.name).filter(Boolean)
          if (this.queues.length && !this.queue) {
            this.queue = this.queues[0]
          }
        })
        .catch(() => { this.queues = [] })
    },
    refresh () {
      if (!this.queue) return
      this.loading = true
      this.$axios.get('/api/print/jobs', { params: { queue: this.queue, which: 'all' } })
        .then(res => {
          this.jobs = ((res.data && res.data.jobs) || []).map(j => {
            const parts = (j.name || '').split('|')
            return Object.assign({}, j, {
              station: parts[0] || '',
              desk: parts[1] || '',
              orderNo: parts[2] || ''
            })
          })
          this.online = true
        })
        .catch(() => { this.online = false })
        .finally(() => { this.loading = false })
    },
    cancel (jobId) {
      this.$confirm(`確定取消 Job #${jobId} 嗎？`)
        .then(_ => {
          this.$axios.post(`/api/print/jobs/${jobId}/cancel`, { queue: this.queue })
            .then(() => {
              this.$message({ type: 'success', message: '已取消列印任務' })
              this.refresh()
            })
            .catch(err => {
              this.$message({ type: 'error', message: (err.response && err.response.data && err.response.data.error) || '取消失敗' })
            })
        })
        .catch(_ => {})
    },
    openCreate () {
      this.createForm = { name: '', ip: '', port: 9100 }
      this.createDialog = true
    },
    createQueue () {
      if (!this.createForm.name.trim()) {
        this.$message({ type: 'warning', message: '請輸入佇列名稱' })
        return
      }
      if (!this.createForm.ip.trim()) {
        this.$message({ type: 'warning', message: '請輸入打印機 IP' })
        return
      }
      this.creating = true
      this.$axios.post('/api/print/queues', {
        name: this.createForm.name.trim(),
        ip: this.createForm.ip.trim(),
        port: this.createForm.port || 9100
      })
        .then(() => {
          this.$message({ type: 'success', message: '佇列已建立' })
          this.createDialog = false
          return this.loadQueues()
        })
        .catch(err => {
          this.$message({ type: 'error', message: (err.response && err.response.data && err.response.data.error) || '建立失敗' })
        })
        .finally(() => { this.creating = false })
    },
    removeQueue () {
      if (!this.queue) {
        this.$message({ type: 'warning', message: '請先選擇要刪除的佇列' })
        return
      }
      this.$confirm(`確定刪除佇列「${this.queue}」嗎？此動作會移除 CUPS 上的印表機設定。`)
        .then(_ => {
          this.$axios.delete('/api/print/queues/' + encodeURIComponent(this.queue))
            .then(() => {
              this.$message({ type: 'success', message: '佇列已刪除' })
              this.queue = ''
              this.jobs = []
              return this.loadQueues()
            })
            .catch(err => {
              this.$message({ type: 'error', message: (err.response && err.response.data && err.response.data.error) || '刪除失敗' })
            })
        })
        .catch(_ => {})
    },
    isCancelable (j) {
      return ['pending', 'pending-held', 'processing'].indexOf(j.state) >= 0
    },
    stateTagType (j) {
      if (j.state === 'completed') return 'success'
      if (j.state === 'canceled' || j.state === 'aborted') return 'danger'
      if (j.state === 'processing') return 'primary'
      return 'warning'
    },
    formatTime (ts) {
      if (!ts) return '-'
      const d = new Date(ts * 1000)
      const pad = n => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    }
  },
  created () {
    this.loadQueues().then(() => this.refresh())
    this.timer = setInterval(this.refresh, 5000)
    window.onresize = () => { this.tableHeight = window.innerHeight - 200 }
  },
  beforeDestroy () {
    if (this.timer) clearInterval(this.timer)
  }
}
</script>

<style scoped>
#print-monitor{ height: 100%; }
.row-height{ margin-top: 10px; overflow: auto; }
.status-bar{ display: flex; align-items: center; gap: 12px; justify-content: flex-end; }
.count-lbl{ font-size: 13px; color: #606266; }
.tip{ font-size: 12px; color: #909399; margin-left: 8px; }
.bull-frame{ width: 100%; height: calc(100vh - 160px); border: 1px solid #e4e7ed; border-radius: 4px; }
.bull-placeholder{ padding: 40px; text-align: center; color: #909399; }
</style>
