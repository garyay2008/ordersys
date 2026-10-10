<template>
  <div id="print-monitor">
    <iframe v-if="bullSrc" :src="bullSrc" class="bull-frame"></iframe>
    <div v-else class="bull-placeholder">載入 Bull Board 儀表板…</div>
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
      bullSrc: ''
    }
  },
  methods: {
    loadBullBoard () {
      // 先建立監控會話 cookie（JWT 驗證），再載入 Bull Board，避免 Basic Auth 彈窗
      this.$axios.post('/api/print/queueui-session')
        .then(() => { this.bullSrc = '/admin/queues/' })
        .catch(() => { this.bullSrc = '/admin/queues/' })
    }
  },
  created () {
    this.loadBullBoard()
  }
}
</script>

<style scoped>
#print-monitor{ height: 100%; }
.bull-frame{ width: 100%; height: calc(100vh - 80px); border: 1px solid #e4e7ed; border-radius: 4px; }
.bull-placeholder{ padding: 40px; text-align: center; color: #909399; }
</style>
