<template>
  <div class="shop-upload">
    <el-card class="box-card">
      <div slot="header" class="clearfix">
        <span>店舖上傳設定</span>
      </div>

      <el-alert
        title="將本店舖資料庫定期上傳到中央備份主機。啟用後會依每日上傳時間自動執行 pg_dump 並上傳。店舖 ID 需與中央後台已註冊的分店 ID 完全一致。"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 20px;">
      </el-alert>

      <el-form :model="form" label-width="140px" size="small" style="max-width: 680px;">
        <el-form-item label="啟用自動上傳">
          <el-switch v-model="form.enabled"></el-switch>
        </el-form-item>
        <el-form-item label="中央上傳 URL">
          <el-input v-model="form.url" placeholder="http://129.150.36.178:888/api/upload"></el-input>
          <div class="hint" style="margin-top: 4px; line-height: 1.6;">中央備份主機的上傳端點，公網 IP 需可直接連線（無需 VPN）。</div>
        </el-form-item>
        <el-form-item label="店舖 ID">
          <el-input v-model="form.branchId" placeholder="hifi360"></el-input>
          <div class="hint" style="margin-top: 4px; line-height: 1.6;">需與中央後台已註冊的分店 ID 完全一致，錯誤 ID 會被中央拒絕並顯示上傳失敗。</div>
        </el-form-item>
        <el-form-item label="共享金鑰">
          <el-input v-model="form.key" type="password" show-password placeholder="與中央 UPLOAD_KEY 相同"></el-input>
          <div class="hint" style="margin-top: 4px; line-height: 1.6;">需與中央主機的 UPLOAD_KEY 一致，否則上傳會被拒絕。</div>
        </el-form-item>
        <el-form-item label="每日上傳時間">
          <el-input v-model="form.time" placeholder="03:30" style="width: 120px;"></el-input>
          <span class="hint" style="margin-left: 8px;">格式 HH:mm（24 小時制）</span>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="el-icon-check" @click="save" :loading="loading.save">儲存設定</el-button>
          <el-button type="success" icon="el-icon-upload2" @click="run" :loading="loading.run">立即上傳</el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="statusText"
        :title="statusText"
        :type="status && status.ok ? 'success' : 'error'"
        :closable="false"
        show-icon
        style="margin-top: 8px; max-width: 680px;">
      </el-alert>

      <el-divider></el-divider>
      <div style="max-width: 680px;">
        <h3 class="section-title">SSH 公鑰（供中央後台註冊分店）</h3>
        <p class="hint" style="margin-bottom: 8px;">複製本機 SSH 公鑰，到中央備份儀表板 <code>/admin</code> 後台「新增分店」貼上註冊。若尚未產生金鑰，請於本機終端機執行 <code>ssh-keygen -t ed25519</code> 後重新整理此頁。</p>
        <el-input v-model="sshKey.key" type="textarea" :rows="3" readonly placeholder="本機尚未找到 SSH 公鑰"></el-input>
        <el-button type="primary" size="small" icon="el-icon-document-copy" style="margin-top: 10px;" :disabled="!sshKey.key" @click="copyText(sshKey.key)">複製公鑰</el-button>
      </div>
    </el-card>
  </div>
</template>

<script>
export default {
  name: 'ShopUpload',
  data () {
    return {
      form: {
        enabled: false,
        url: '',
        branchId: '',
        key: '',
        time: '03:30'
      },
      status: null,
      sshKey: { key: '', path: '', found: false },
      loading: {
        save: false,
        run: false
      }
    }
  },
  mounted () {
    this.fetchConfig()
    this.fetchStatus()
    this.fetchSshKey()
  },
  computed: {
    statusText () {
      if (!this.status) return ''
      const s = this.status
      const at = s.at ? new Date(s.at).toLocaleString() : ''
      if (s.ok) {
        return `上次上傳成功：${s.filename || ''}（${(s.bytes || 0)} bytes）於 ${at}`
      }
      return `上次上傳失敗：${s.error || ''}（${at}）`
    }
  },
  methods: {
    fetchConfig () {
      this.$axios.get('/api/centralbackup/config').then(res => {
        this.form = Object.assign({}, this.form, res.data || {})
      }).catch(() => {})
    },
    fetchStatus () {
      this.$axios.get('/api/centralbackup/status').then(res => {
        this.status = res.data
      }).catch(() => {})
    },
    fetchSshKey () {
      this.$axios.get('/api/centralbackup/sshkey').then(res => {
        this.sshKey = res.data || { key: '', path: '', found: false }
      }).catch(() => {})
    },
    copyText (text) {
      if (!text) return
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          this.$message.success('已複製到剪貼簿')
        }).catch(() => this.fallbackCopy(text))
      } else {
        this.fallbackCopy(text)
      }
    },
    fallbackCopy (text) {
      const input = document.createElement('textarea')
      input.value = text
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      this.$message.success('已複製到剪貼簿')
    },
    save () {
      this.loading.save = true
      this.$axios.post('/api/centralbackup/config', this.form).then(res => {
        this.$message.success(res.data.msg || '店舖上傳設定已儲存')
        if (res.data.config) this.form = Object.assign({}, this.form, res.data.config)
      }).catch(err => {
        this.$message.error('儲存失敗：' + ((err.response && err.response.data && err.response.data.msg) || err.message))
      }).finally(() => {
        this.loading.save = false
      })
    },
    run () {
      this.loading.run = true
      this.$axios.post('/api/centralbackup/run').then(res => {
        this.$message.success(res.data.msg || '備份上傳成功')
        this.fetchStatus()
      }).catch(err => {
        this.$message.error('備份上傳失敗：' + ((err.response && err.response.data && err.response.data.msg) || err.message))
        this.fetchStatus()
      }).finally(() => {
        this.loading.run = false
      })
    }
  }
}
</script>

<style scoped>
.shop-upload {
  padding: 20px;
}
.box-card {
  max-width: 760px;
}
.hint {
  font-size: 12px;
  color: #909399;
}
.section-title {
  margin: 0 0 8px 0;
  font-size: 15px;
  color: #303133;
}
</style>
