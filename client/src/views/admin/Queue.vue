<template>
  <div id="queue-mgr">
    <div class="qm-head">
      <div>
        <h2 class="qm-title">排隊叫號系統</h2>
        <div class="qm-sub">香港式取票叫號（A/B/C 分類）</div>
      </div>
      <div>
        <el-button size="small" icon="el-icon-view" @click="openDisplay">開啟顯示屏</el-button>
        <el-button size="small" icon="el-icon-tickets" @click="openKiosk">開啟取票機</el-button>
        <el-button size="small" type="primary" icon="el-icon-setting" @click="openSetting">設定</el-button>
      </div>
    </div>

    <!-- 取票 -->
    <div class="qm-section">
      <div class="qm-section-title">取票（代客出票）</div>
      <div class="qm-take">
        <button v-for="c in setting.categories" :key="c.prefix" class="qm-take-btn" :style="{ borderColor: c.color }" @click="take(c)">
          <span class="qm-take-prefix" :style="{ color: c.color }">{{ c.prefix }}</span>
          <span class="qm-take-label">{{ c.label }}</span>
        </button>
      </div>
    </div>

    <!-- 分類狀態 -->
    <div class="qm-section">
      <div class="qm-section-title">叫號控制</div>
      <div class="qm-cards">
        <div v-for="c in state.categories" :key="c.prefix" class="qm-card" :style="{ borderColor: c.color }">
          <div class="qm-card-head" :style="{ background: c.color }">
            <span class="qm-card-prefix">{{ c.prefix }}</span>
            <span>{{ c.label }}</span>
          </div>
          <div class="qm-card-body">
            <div class="qm-line"><span class="qm-line-label">現在叫號</span><span class="qm-line-val qm-current">{{ c.current ? c.current.ticketNo : '—' }}</span></div>
            <div class="qm-line"><span class="qm-line-label">下一組</span><span class="qm-line-val">{{ c.next ? c.next.ticketNo : '—' }}</span></div>
            <div class="qm-line"><span class="qm-line-label">等候</span><span class="qm-line-val">{{ c.waitingCount }} 張</span></div>
            <div class="qm-actions">
              <el-button size="mini" type="primary" :disabled="!c.next" @click="callNext(c)">叫下一號</el-button>
              <el-button size="mini" :disabled="!c.current" @click="recall(c)">重叫</el-button>
              <el-button size="mini" type="success" :disabled="!c.current" @click="seated(c)">已入座</el-button>
            </div>
            <div class="qm-waiting">
              <div class="qm-waiting-title">等候中</div>
              <div v-if="!c.waitingList.length" class="qm-empty">—</div>
              <div v-for="t in c.waitingList" :key="t._id" class="qm-wait-item">
                <span class="qm-wait-no">{{ t.ticketNo }}</span>
                <span class="qm-wait-pax">{{ t.pax }} 位</span>
                <el-button type="text" size="mini" style="color:#e6a23c;" @click="skip(t)">跳過</el-button>
                <el-button type="text" size="mini" style="color:#f56c6c;" @click="cancel(t)">取消</el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 今日紀錄 -->
    <div class="qm-section">
      <div class="qm-section-title">今日紀錄（{{ historyTotal }} 張）</div>
      <el-table :data="history" size="small" stripe style="width: 100%;" max-height="360">
        <el-table-column prop="ticketNo" label="票號" width="100" align="center"></el-table-column>
        <el-table-column prop="category" label="分類" width="80" align="center"></el-table-column>
        <el-table-column prop="pax" label="人數" width="80" align="center"></el-table-column>
        <el-table-column label="狀態" width="110" align="center">
          <template slot-scope="scope">
            <el-tag size="mini" :type="statusType(scope.row.status)">{{ statusLabel(scope.row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="取票時間" align="center">
          <template slot-scope="scope">{{ time(scope.row.createdAt) }}</template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 設定 -->
    <el-dialog title="叫號系統設定" :visible.sync="settingDialog" width="620px">
      <el-form label-width="110px" size="small">
        <el-form-item label="啟用叫號">
          <el-switch v-model="setting.enabled"></el-switch>
        </el-form-item>
        <el-form-item label="語音叫號">
          <el-switch v-model="setting.voiceEnabled"></el-switch>
        </el-form-item>
        <el-form-item label="顯示屏標題">
          <el-input v-model="setting.title"></el-input>
        </el-form-item>
        <el-form-item label="副標題">
          <el-input v-model="setting.subtitle"></el-input>
        </el-form-item>
        <el-form-item label="人數分類">
          <div style="width: 100%;">
            <div v-for="(c, i) in setting.categories" :key="i" class="qm-cat-row">
              <el-input v-model="c.prefix" size="mini" style="width: 60px;" placeholder="前綴"></el-input>
              <el-input v-model="c.label" size="mini" style="width: 120px;" placeholder="名稱"></el-input>
              <el-input v-model="c.minPax" size="mini" style="width: 70px;" placeholder="最小"></el-input>
              <el-input v-model="c.maxPax" size="mini" style="width: 70px;" placeholder="最大"></el-input>
              <el-color-picker v-model="c.color" size="mini"></el-color-picker>
              <el-button type="text" size="mini" style="color:#f56c6c;" @click="setting.categories.splice(i, 1)">刪除</el-button>
            </div>
            <el-button size="mini" icon="el-icon-plus" @click="setting.categories.push({ prefix: '', label: '', minPax: 1, maxPax: 99, color: '#409eff' })">新增分類</el-button>
          </div>
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button size="small" @click="settingDialog = false">取 消</el-button>
        <el-button size="small" type="primary" @click="saveSetting">儲 存</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'queueMgr',
  data () {
    return {
      setting: { enabled: true, voiceEnabled: true, title: '排隊叫號', subtitle: '請取票後在候餐區等候', categories: [] },
      state: { categories: [], totalWaiting: 0 },
      history: [],
      historyTotal: 0,
      settingDialog: false
    }
  },
  sockets: {
    queueChanged () {
      this.refresh()
    }
  },
  created () {
    this.loadSetting()
    this.refresh()
  },
  methods: {
    loadSetting () {
      this.$axios.get('/api/queue/setting').then(res => { this.setting = res.data || this.setting }).catch(() => {})
    },
    refresh () {
      this.$axios.get('/api/queue/state').then(res => { this.state = res.data || this.state }).catch(() => {})
      this.$axios.get('/api/queue/history').then(res => { this.history = (res.data && res.data.list) || []; this.historyTotal = (res.data && res.data.total) || 0 }).catch(() => {})
    },
    take (c) {
      this.$axios.post('/api/queue/take', { category: c.prefix, pax: c.minPax })
        .then(res => this.$message({ type: 'success', message: '已出票 ' + res.data.ticketNo }))
        .catch(err => this.$message({ type: 'error', message: (err.response && err.response.data) || '取票失敗' }))
    },
    callNext (c) {
      this.$axios.post('/api/queue/callNext', { category: c.prefix })
        .then(res => this.$message({ type: 'success', message: '已叫號 ' + res.data.ticketNo }))
        .catch(err => this.$message({ type: 'warning', message: (err.response && err.response.data) || '叫號失敗' }))
    },
    recall (c) {
      this.$axios.post('/api/queue/recall', { category: c.prefix })
        .then(() => this.$message({ type: 'success', message: '已重新叫號' }))
        .catch(err => this.$message({ type: 'warning', message: (err.response && err.response.data) || '重叫失敗' }))
    },
    seated (c) {
      if (!c.current) return
      this.updateStatus(c.current.ticketNo, 'seated')
    },
    skip (t) {
      this.updateStatus(t.ticketNo, 'skipped')
    },
    cancel (t) {
      this.$confirm(`確認取消票號「${t.ticketNo}」嗎？`).then(() => this.updateStatus(t.ticketNo, 'cancelled')).catch(() => {})
    },
    updateStatus (ticketNo, status) {
      this.$axios.post('/api/queue/updateStatus', { ticketNo, status })
        .catch(err => this.$message({ type: 'error', message: (err.response && err.response.data) || '操作失敗' }))
    },
    openDisplay () { window.open('/queue', '_blank') },
    openKiosk () { window.open('/queue/kiosk', '_blank') },
    openSetting () { this.loadSetting(); this.settingDialog = true },
    saveSetting () {
      this.$axios.post('/api/queue/setting', this.setting)
        .then(res => { this.$message({ type: 'success', message: res.data || '已儲存' }); this.settingDialog = false })
        .catch(err => this.$message({ type: 'error', message: (err.response && err.response.data) || '儲存失敗' }))
    },
    statusLabel (s) {
      return { waiting: '等候中', called: '已叫號', seated: '已入座', skipped: '跳過', cancelled: '取消' }[s] || s
    },
    statusType (s) {
      return { waiting: 'info', called: 'warning', seated: 'success', skipped: '', cancelled: 'danger' }[s] || ''
    },
    time (d) {
      if (!d) return ''
      const t = new Date(d)
      return t.getHours().toString().padStart(2, '0') + ':' + t.getMinutes().toString().padStart(2, '0') + ':' + t.getSeconds().toString().padStart(2, '0')
    }
  }
}
</script>

<style scoped>
#queue-mgr{ padding: 16px; }
.qm-head{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.qm-title{ margin: 0; font-size: 20px; }
.qm-sub{ color: #909399; font-size: 12px; margin-top: 4px; }
.qm-section{ background: #fff; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px; }
.qm-section-title{ font-size: 15px; font-weight: 700; margin-bottom: 10px; color: #303133; }
.qm-take{ display: flex; gap: 12px; flex-wrap: wrap; }
.qm-take-btn{ width: 150px; height: 90px; border: 2px solid #409eff; border-radius: 10px; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; }
.qm-take-prefix{ font-size: 30px; font-weight: 800; }
.qm-take-label{ font-size: 14px; color: #606266; }
.qm-cards{ display: flex; gap: 12px; flex-wrap: wrap; }
.qm-card{ flex: 1 1 260px; max-width: 380px; border: 2px solid #409eff; border-radius: 10px; overflow: hidden; }
.qm-card-head{ display: flex; align-items: center; gap: 10px; padding: 8px 12px; color: #fff; font-weight: 700; }
.qm-card-prefix{ font-size: 22px; font-weight: 800; }
.qm-card-body{ padding: 10px 12px; }
.qm-line{ display: flex; justify-content: space-between; padding: 4px 0; }
.qm-line-label{ color: #909399; }
.qm-line-val{ font-weight: 700; }
.qm-current{ color: #e6a23c; }
.qm-actions{ margin: 10px 0; display: flex; gap: 6px; flex-wrap: wrap; }
.qm-waiting{ border-top: 1px solid #ebeef5; padding-top: 8px; }
.qm-waiting-title{ font-size: 12px; color: #909399; margin-bottom: 6px; }
.qm-wait-item{ display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.qm-wait-no{ font-weight: 700; }
.qm-wait-pax{ color: #909399; font-size: 12px; flex: 1; }
.qm-empty{ color: #c0c4cc; }
.qm-cat-row{ display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
</style>
