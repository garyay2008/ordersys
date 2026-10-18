<template>
  <div class="system-maint">
    <el-card class="box-card">
      <div slot="header" class="clearfix">
        <span>系統維護</span>
      </div>
      <el-alert
        title="系統維護功能僅限管理員使用，操作前請確認已做好備份。"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 20px;">
      </el-alert>

      <div class="maint-section" style="margin-bottom: 20px;">
        <div class="section-header">
          <h3 class="section-title" style="margin: 0;">備援主機狀態</h3>
          <div class="section-actions">
            <el-switch v-model="replAutoRefresh" active-text="自動刷新" style="margin-right: 12px;"></el-switch>
            <el-button size="small" icon="el-icon-refresh" @click="fetchReplicationStatus" :loading="replLoading">重新整理</el-button>
          </div>
        </div>

        <el-alert v-if="replError" :title="replError" type="error" :closable="false" show-icon style="margin-bottom: 12px;"></el-alert>

        <div class="repl-grid">
          <div class="repl-card">
            <div class="repl-label">本機角色</div>
            <div class="repl-value">{{ replStatus.isRecovery ? '備援主機（唯讀）' : '主機（可讀寫）' }}</div>
          </div>
          <div class="repl-card" v-if="!replStatus.isRecovery">
            <div class="repl-label">已連線備援</div>
            <div class="repl-value">{{ streamingCount }} 台</div>
          </div>
          <div class="repl-card" v-if="!replStatus.isRecovery && streamingCount === 0">
            <div class="repl-label">注意</div>
            <div class="repl-value" style="color: #e6a23c;">目前沒有備援主機連線</div>
          </div>
        </div>

        <template v-if="!replStatus.isRecovery">
          <el-table :data="replStatus.replicas || []" size="small" border style="margin-top: 12px;">
            <el-table-column prop="applicationName" label="應用名稱" min-width="110"></el-table-column>
            <el-table-column prop="clientAddr" label="備援位址" min-width="130"></el-table-column>
            <el-table-column label="狀態" width="100">
              <template slot-scope="scope">
                <el-tag :type="scope.row.state === 'streaming' ? 'success' : 'danger'" size="mini">
                  {{ scope.row.state || '—' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="syncState" label="同步模式" width="90"></el-table-column>
            <el-table-column label="延遲" width="120">
              <template slot-scope="scope">
                <span v-if="scope.row.replayBytesBehind === null || scope.row.replayBytesBehind === undefined">—</span>
                <span v-else>{{ formatBytes(scope.row.replayBytesBehind) }}</span>
              </template>
            </el-table-column>
          </el-table>
          <el-table :data="replStatus.slots || []" size="small" border style="margin-top: 12px;">
            <el-table-column prop="slotName" label="複製槽" min-width="130"></el-table-column>
            <el-table-column label="啟用" width="80">
              <template slot-scope="scope">
                <el-tag :type="scope.row.active ? 'success' : 'info'" size="mini">{{ scope.row.active ? '是' : '否' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="walStatus" label="WAL 狀態" width="100"></el-table-column>
            <el-table-column label="保留 WAL" width="120">
              <template slot-scope="scope">{{ formatBytes(scope.row.retainedBytes) }}</template>
            </el-table-column>
          </el-table>
          <p class="hint">串流複製狀態由主機端 pg_stat_replication 讀取；「延遲」為備援尚未重播的 WAL 位元組數。</p>
        </template>
        <template v-else>
          <p class="hint">此節點為備援主機（唯讀），正在接收並重播主機的 WAL 資料。最後重播時間：{{ formatReplay(replStatus.lastReplay) }}</p>
        </template>
      </div>

      <el-row :gutter="20">
        <el-col :span="12">
          <div class="maint-section">
            <h3 class="section-title">資料庫管理</h3>
            <div class="btn-group">
              <el-button type="primary" icon="el-icon-download" @click="backupDB" :loading="loading.backup">
                備份資料庫
              </el-button>
              <el-button type="success" icon="el-icon-upload2" @click="triggerImportDB" :loading="loading.importDB">
                匯入資料庫
              </el-button>
              <input ref="importDBInput" type="file" accept=".json" style="display:none" @change="handleImportDB">
            </div>
            <p class="hint">備份：匯出完整資料庫為 JSON 文件<br>匯入：上傳 JSON 文件覆蓋現有資料庫</p>
          </div>
        </el-col>

        <el-col :span="12">
          <div class="maint-section">
            <h3 class="section-title">菜單管理</h3>
            <div class="btn-group">
              <el-button type="primary" icon="el-icon-download" @click="exportMenu" :loading="loading.exportMenu">
                匯出菜單＋設定
              </el-button>
              <el-button type="success" icon="el-icon-upload2" @click="triggerImportMenu" :loading="loading.importMenu">
                匯入菜單＋設定
              </el-button>
              <input ref="importMenuInput" type="file" accept=".json" style="display:none" @change="handleImportMenu">
            </div>
            <p class="hint">匯出：分類、貨品、套餐、改碼等菜單資料，以及 POS 設置、用戶、枱號、區域、收銀機、打印機設置<br>匯入：上傳 JSON 覆蓋現有菜單與設定資料</p>
          </div>
        </el-col>
      </el-row>

      <el-divider></el-divider>

      <div class="maint-section">
        <h3 class="section-title">匯入 ISM（宏軟 POS）菜單</h3>
        <div class="import-option">
          <span class="import-option-label">套餐處理：</span>
          <el-select v-model="importIsmCombosMode" size="small" style="width: 240px;">
            <el-option label="只匯入套餐名稱（當作貨品）" value="commodity"></el-option>
            <el-option label="匯入完整套餐選單" value="combo"></el-option>
            <el-option label="不匯入套餐" value="skip"></el-option>
          </el-select>
        </div>
        <div class="btn-group">
          <el-button type="primary" icon="el-icon-upload2" @click="triggerImportIsm" :loading="loading.importIsm">
            選擇 ISM XML 檔案
          </el-button>
          <input ref="importIsmInput" type="file" accept=".xml" multiple style="display:none" @change="handleImportIsm">
        </div>
        <p class="hint">
          可多選 department.xml、lookup_header.xml、lookup_details.xml、item.xml、item_price.xml、item_printer.xml、printer_queue.xml、discount.xml。<br>
          匯入將覆蓋現有分類、貨品、部門及關聯，並加入檔口與預設折扣。
        </p>
      </div>

      <el-divider></el-divider>

      <div class="maint-section">
        <h3 class="section-title">系統日誌</h3>
        <div class="log-toolbar">
          <el-select v-model="logLevel" size="small" style="width: 120px;" @change="fetchLogs">
            <el-option label="全部" value=""></el-option>
            <el-option label="INFO" value="info"></el-option>
            <el-option label="WARN" value="warn"></el-option>
            <el-option label="ERROR" value="error"></el-option>
          </el-select>
          <el-select v-model="logLimit" size="small" style="width: 110px;" @change="fetchLogs">
            <el-option label="200 行" :value="200"></el-option>
            <el-option label="500 行" :value="500"></el-option>
            <el-option label="1000 行" :value="1000"></el-option>
          </el-select>
          <el-switch v-model="autoRefresh" active-text="自動刷新"></el-switch>
          <el-button size="small" icon="el-icon-refresh" @click="fetchLogs" :loading="logLoading">重新整理</el-button>
          <el-button size="small" icon="el-icon-download" @click="downloadLogs">下載</el-button>
          <el-button size="small" type="danger" icon="el-icon-delete" @click="clearLogs">清空</el-button>
        </div>
        <div class="log-console" ref="logConsole">
          <div v-for="(l, i) in logs" :key="i" class="log-line" :class="'log-' + l.level">
            <span class="log-ts">{{ l.ts }}</span>
            <span class="log-level">{{ l.level.toUpperCase() }}</span>
            <span class="log-msg">{{ l.message }}</span>
          </div>
          <div v-if="!logs.length" class="log-empty">暫無日誌</div>
        </div>
      </div>

      <el-divider></el-divider>

      <div class="maint-section danger-section">
        <h3 class="section-title" style="color: #f56c6c;">危險操作</h3>
        <div class="btn-group">
          <el-button type="danger" icon="el-icon-delete" @click="clearBusinessData" :loading="loading.clear">
            一鍵清除營業數據
          </el-button>
          <el-button type="warning" icon="el-icon-delete" @click="clearCombos" :loading="loading.clearCombos">
            清空套餐
          </el-button>
        </div>
        <p class="hint danger-hint">此操作將清除所有訂單、營業日、打卡記錄、統計圖表數據。<br>
          清空套餐將刪除所有套餐及其分類關聯。<br>
          <strong>此操作不可逆轉，請謹慎使用！</strong></p>
      </div>
    </el-card>
  </div>
</template>

<script>
export default {
  name: 'SystemMaint',
  data () {
    return {
      loading: {
        backup: false,
        exportMenu: false,
        importDB: false,
        importMenu: false,
        importIsm: false,
        clear: false,
        clearCombos: false
      },
      importIsmCombosMode: 'commodity',
      logs: [],
      logLevel: '',
      logLimit: 500,
      autoRefresh: true,
      logLoading: false,
      logTimer: null,
      replStatus: {},
      replLoading: false,
      replError: '',
      replAutoRefresh: true,
      replTimer: null
    }
  },
  computed: {
    streamingCount () {
      return ((this.replStatus && this.replStatus.replicas) || []).filter(r => r.state === 'streaming').length
    }
  },
  mounted () {
    this.fetchLogs()
    this.startAutoRefresh()
    this.fetchReplicationStatus()
    this.startReplAutoRefresh()
  },
  beforeDestroy () {
    this.stopAutoRefresh()
    this.stopReplAutoRefresh()
  },
  watch: {
    autoRefresh (val) {
      if (val) this.startAutoRefresh()
      else this.stopAutoRefresh()
    },
    replAutoRefresh (val) {
      if (val) this.startReplAutoRefresh()
      else this.stopReplAutoRefresh()
    }
  },
  methods: {
    fetchLogs () {
      this.logLoading = true
      this.$axios.get('/api/systemmaint/logs', { params: { limit: this.logLimit, level: this.logLevel } }).then(res => {
        this.logs = res.data.logs || []
        this.$nextTick(this.scrollToBottom)
      }).catch(err => {
        this.$message.error('載入日誌失敗：' + ((err.response && err.response.data && err.response.data.msg) || err.message))
      }).finally(() => {
        this.logLoading = false
      })
    },

    scrollToBottom () {
      const el = this.$refs.logConsole
      if (el) el.scrollTop = el.scrollHeight
    },

    fetchReplicationStatus () {
      this.replLoading = true
      this.$axios.get('/api/systemmaint/replicationStatus').then(res => {
        this.replStatus = res.data || {}
        this.replError = ''
      }).catch(err => {
        this.replError = '載入備援狀態失敗：' + ((err.response && err.response.data && err.response.data.msg) || err.message)
      }).finally(() => {
        this.replLoading = false
      })
    },

    startReplAutoRefresh () {
      if (this.replTimer) return
      this.replTimer = setInterval(() => this.fetchReplicationStatus(), 5000)
    },

    stopReplAutoRefresh () {
      if (this.replTimer) {
        clearInterval(this.replTimer)
        this.replTimer = null
      }
    },

    formatBytes (n) {
      if (n === null || n === undefined) return '—'
      const v = Number(n)
      if (v === 0) return '0 B'
      const units = ['B', 'KB', 'MB', 'GB', 'TB']
      let i = 0
      let x = v
      while (x >= 1024 && i < units.length - 1) {
        x /= 1024
        i++
      }
      return x.toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
    },

    formatReplay (ts) {
      if (!ts) return '—'
      return new Date(ts).toLocaleString('zh-HK')
    },

    startAutoRefresh () {
      if (this.logTimer) return
      this.logTimer = setInterval(() => this.fetchLogs(), 3000)
    },

    stopAutoRefresh () {
      if (this.logTimer) {
        clearInterval(this.logTimer)
        this.logTimer = null
      }
    },

    downloadLogs () {
      const text = this.logs.map(l => `${l.ts} [${l.level.toUpperCase()}] ${l.message}`).join('\n')
      const blob = new Blob([text], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `logs_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`
      a.click()
      window.URL.revokeObjectURL(url)
    },

    clearLogs () {
      this.$confirm('確定要清空系統日誌嗎？', '警告', {
        confirmButtonText: '確定清空',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.$axios.post('/api/systemmaint/logs/clear').then(res => {
          this.$message.success(res.data.msg)
          this.logs = []
        }).catch(err => {
          this.$message.error('清空失敗：' + ((err.response && err.response.data && err.response.data.msg) || err.message))
        })
      }).catch(() => {})
    },

    backupDB () {
      this.loading.backup = true
      this.$axios({
        method: 'get',
        url: '/api/systemmaint/backup',
        responseType: 'blob'
      }).then(res => {
        const blob = new Blob([res.data], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        window.URL.revokeObjectURL(url)
        this.$message.success('資料庫備份成功！')
      }).catch(err => {
        this.$message.error('備份失敗：' + ((err.response && err.response.data && err.response.data.msg) || err.message))
      }).finally(() => {
        this.loading.backup = false
      })
    },

    exportMenu () {
      this.loading.exportMenu = true
      this.$axios({
        method: 'get',
        url: '/api/systemmaint/exportmenu',
        responseType: 'blob'
      }).then(res => {
        const blob = new Blob([res.data], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `menu_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        window.URL.revokeObjectURL(url)
        this.$message.success('菜單匯出成功！')
      }).catch(err => {
        this.$message.error('匯出失敗：' + ((err.response && err.response.data && err.response.data.msg) || err.message))
      }).finally(() => {
        this.loading.exportMenu = false
      })
    },

    triggerImportDB () {
      this.$refs.importDBInput.click()
    },

    handleImportDB (e) {
      const file = e.target.files[0]
      if (!file) return
      this.$confirm('匯入資料庫將覆蓋現有所有資料，確定要繼續嗎？', '警告', {
        confirmButtonText: '確定匯入',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.loading.importDB = true
        const reader = new FileReader()
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result)
            this.$axios.post('/api/systemmaint/importdb', data).then(res => {
              this.$message.success(res.data.msg)
            }).catch(err => {
              this.$message.error('匯入失敗：' + ((err.response && err.response.data && err.response.data.msg) || err.message))
            }).finally(() => {
              this.loading.importDB = false
            })
          } catch (parseErr) {
            this.$message.error('文件格式錯誤，請確認是有效的 JSON 文件')
            this.loading.importDB = false
          }
        }
        reader.readAsText(file)
      }).catch(() => {})
      e.target.value = ''
    },

    triggerImportMenu () {
      this.$refs.importMenuInput.click()
    },

    handleImportMenu (e) {
      const file = e.target.files[0]
      if (!file) return
      this.$confirm('匯入將覆蓋現有菜單及 POS 設置、用戶、枱號、區域、收銀機、打印機設置資料，確定要繼續嗎？', '警告', {
        confirmButtonText: '確定匯入',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.loading.importMenu = true
        const reader = new FileReader()
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result)
            this.$axios.post('/api/systemmaint/importmenu', data).then(res => {
              this.$message.success(res.data.msg)
            }).catch(err => {
              this.$message.error('匯入失敗：' + ((err.response && err.response.data && err.response.data.msg) || err.message))
            }).finally(() => {
              this.loading.importMenu = false
            })
          } catch (parseErr) {
            this.$message.error('文件格式錯誤，請確認是有效的 JSON 文件')
            this.loading.importMenu = false
          }
        }
        reader.readAsText(file)
      }).catch(() => {})
      e.target.value = ''
    },

    triggerImportIsm () {
      this.$refs.importIsmInput.click()
    },

    handleImportIsm (e) {
      const files = Array.from(e.target.files)
      if (!files || !files.length) return
      this.$confirm('匯入 ISM 菜單將覆蓋現有分類、貨品及關聯資料，確定要繼續嗎？', '警告', {
        confirmButtonText: '確定匯入',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.loading.importIsm = true
        const formData = new FormData()
        for (const file of files) {
          formData.append('files', file)
        }
        formData.append('combosMode', this.importIsmCombosMode || 'combo')
        this.$axios.post('/api/systemmaint/importism', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        }).then(res => {
          const r = res.data.result || {}
          const parts = [`分類 ${r.categories || 0}`, `貨品 ${r.commodities || 0}`]
          if (r.departments) parts.push(`部門 ${r.departments}`)
          if (r.comboNames) parts.push(`套餐名 ${r.comboNames}`)
          if (r.combos) parts.push(`套餐 ${r.combos}`)
          parts.push(`關聯 ${r.links || 0}`, `檔口 ${r.stations || 0}`, `折扣 ${r.discounts || 0}`)
          this.$message.success(res.data.msg + `（${parts.join('、')}）`)
        }).catch(err => {
          this.$message.error('匯入失敗：' + ((err.response && err.response.data && err.response.data.msg) || err.message))
        }).finally(() => {
          this.loading.importIsm = false
        })
      }).catch(() => {})
      e.target.value = ''
    },

    clearBusinessData () {
      this.$confirm('此操作將永久清除所有訂單、營業日、打卡記錄和統計圖表數據，且不可逆轉！\n\n確定要執行嗎？', '一鍵清除營業數據', {
        confirmButtonText: '確定清除',
        cancelButtonText: '取消',
        type: 'error',
        distinguishCancelAndClose: true
      }).then(() => {
        this.$confirm('請再次確認：清除後所有營業數據將無法恢復！', '最終確認', {
          confirmButtonText: '我已確認，執行清除',
          cancelButtonText: '取消',
          type: 'error'
        }).then(() => {
          this.loading.clear = true
          this.$axios.post('/api/systemmaint/clearbusinessdata').then(res => {
            this.$message.success(res.data.msg)
          }).catch(err => {
            this.$message.error('清除失敗：' + ((err.response && err.response.data && err.response.data.msg) || err.message))
          }).finally(() => {
            this.loading.clear = false
          })
        }).catch(() => {})
      }).catch(() => {})
    },

    clearCombos () {
      this.$confirm('此操作將永久刪除所有套餐及其分類關聯，且不可逆轉！\n\n確定要執行嗎？', '清空套餐', {
        confirmButtonText: '確定清除',
        cancelButtonText: '取消',
        type: 'warning',
        distinguishCancelAndClose: true
      }).then(() => {
        this.loading.clearCombos = true
        this.$axios.post('/api/systemmaint/clearcombos').then(res => {
          this.$message.success(res.data.msg)
        }).catch(err => {
          this.$message.error('清除失敗：' + ((err.response && err.response.data && err.response.data.msg) || err.message))
        }).finally(() => {
          this.loading.clearCombos = false
        })
      }).catch(() => {})
    }
  }
}
</script>

<style scoped>
.system-maint {
  padding: 20px;
}
.box-card {
  max-width: 900px;
}
.maint-section {
  padding: 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafafa;
}
.danger-section {
  background: #fef0f0;
  border-color: #fbc4c4;
}
.section-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #303133;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.section-actions {
  display: flex;
  align-items: center;
}
.repl-grid {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.repl-card {
  flex: 1;
  min-width: 140px;
  padding: 12px 16px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fff;
}
.repl-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.repl-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}
.btn-group {
  margin-bottom: 8px;
}
.hint {
  margin: 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.8;
}
.import-option {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.import-option-label {
  font-size: 13px;
  color: #606266;
}
.danger-hint {
  color: #f56c6c;
}
.log-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.log-console {
  height: 360px;
  overflow-y: auto;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;
  font-size: 12px;
  padding: 12px;
  border-radius: 6px;
  line-height: 1.7;
}
.log-line {
  white-space: pre-wrap;
  word-break: break-all;
}
.log-ts {
  color: #6a9955;
  margin-right: 8px;
}
.log-level {
  display: inline-block;
  min-width: 48px;
  margin-right: 8px;
  font-weight: 600;
}
.log-info .log-level {
  color: #4fc1ff;
}
.log-warn .log-level {
  color: #dcdcaa;
}
.log-error .log-level {
  color: #f48771;
}
.log-msg {
  color: #d4d4d4;
}
.log-empty {
  color: #6e6e6e;
  text-align: center;
  padding: 20px;
}
</style>
