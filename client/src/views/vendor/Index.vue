<template>
  <div id="vendor">
    <!-- 廠商登入 -->
    <div v-if="!isLogin" class="login-box">
      <p class="login-title">廠商登入</p>
      <el-input
        type="password"
        v-model="password"
        placeholder="請輸入廠商密碼"
        show-password
        @keyup.enter.native="login"
      ></el-input>
      <el-button type="primary" class="submitBtn" :loading="loading" @click="login">登入</el-button>
    </div>

    <!-- 分機授權管理 -->
    <div v-else class="panel">
      <div class="panel-head">
        <span class="panel-title">分機授權管理</span>
        <span class="panel-actions">
          <el-button size="small" @click="changePwdDialog.show = true">修改密碼</el-button>
          <el-button size="small" @click="logout">登出</el-button>
        </span>
      </div>

      <el-tabs v-model="activeTab">
        <!-- 分機授權清單 -->
        <el-tab-pane label="分機授權" name="terminals">
          <el-table :data="terminals" size="medium" style="width: 100%" v-loading="loadingList">
            <el-table-column align="center" prop="code" width="120" label="編號"></el-table-column>
            <el-table-column align="center" prop="name" label="名稱" min-width="140"></el-table-column>
            <el-table-column align="center" width="90" label="類型">
              <template slot-scope="scope">
                <el-tag size="mini" :type="typeTag(scope.row.type)">{{ typeLabel(scope.row.type) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column align="center" width="100" label="授權狀態">
              <template slot-scope="scope">
                <el-tag size="mini" :type="statusTag(scope.row.status)">{{ statusLabel(scope.row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column align="center" label="授權碼" min-width="150">
              <template slot-scope="scope">
                <span style="color:#909399; font-size:12px;">{{ scope.row.maskedKey || '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column align="center" width="130" label="到期日">
              <template slot-scope="scope">
                <span>{{ scope.row.expiresAt || '永久' }}</span>
              </template>
            </el-table-column>
            <el-table-column fixed="right" align="center" width="160" label="操作">
              <template slot-scope="scope">
                <el-button type="text" size="small" @click="openActivate(scope.row)">啟用</el-button>
                <el-button
                  v-if="scope.row.status !== 'unlicensed'"
                  type="text"
                  size="small"
                  style="color: #f56c6c;"
                  @click="revoke(scope.row)"
                >撤銷</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 產生授權碼（僅私鑰存在的廠商端顯示） -->
        <el-tab-pane v-if="canGenerate" label="產生授權碼" name="generate">
          <div class="generate-form">
            <el-form label-width="110px" style="max-width: 620px;">
              <el-form-item label="授權類型">
                <el-select v-model="generateForm.edition" style="width: 240px;">
                  <el-option label="分機授權（收銀機/點餐機）" value="terminal"></el-option>
                  <el-option label="主機授權（整台伺服器）" value="full"></el-option>
                </el-select>
              </el-form-item>
              <el-form-item :label="generateForm.edition === 'terminal' ? '收銀機編號' : '機器識別碼'">
                <el-input v-model="generateForm.mid" :placeholder="generateForm.edition === 'terminal' ? '如 11、POS-01、KIOSK-01' : '客戶機 machine ID'" style="width: 320px;"></el-input>
              </el-form-item>
              <el-form-item v-if="generateForm.edition === 'terminal'" label="主機 machine_id">
                <el-input v-model="generateForm.machineId" placeholder="客戶主機的機器識別碼（啟用頁顯示），綁定後跨餐廳唯一" style="width: 320px;"></el-input>
              </el-form-item>
              <el-form-item label="客戶名稱">
                <el-input v-model="generateForm.customer" placeholder="選填，僅供辨識" style="width: 320px;"></el-input>
              </el-form-item>
              <el-form-item label="到期日">
                <el-date-picker
                  v-model="generateForm.exp"
                  type="date"
                  value-format="yyyy-MM-dd"
                  placeholder="留空＝永久授權"
                  style="width: 320px;"
                ></el-date-picker>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="loading" @click="generate">產生授權碼</el-button>
              </el-form-item>
            </el-form>

            <div v-if="generatedKey" class="generate-result">
              <el-input type="textarea" :rows="4" :value="generatedKey" readonly></el-input>
              <el-button type="primary" size="small" icon="el-icon-document-copy" style="margin-top: 10px;" @click="copyText(generatedKey)">複製</el-button>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 啟用授權 -->
    <el-dialog title="啟用分機授權" :visible.sync="activateDialog.show" width="560px" append-to-body>
      <div class="machine-id">
        <span class="label">收銀機編號</span>
        <span class="value">{{ activateDialog.code }}</span>
      </div>
      <el-input
        type="textarea"
        :rows="5"
        v-model="activateDialog.licenseKey"
        placeholder="請貼上授權碼"
      ></el-input>
      <div slot="footer" class="dialog-footer">
        <el-button @click="activateDialog.show = false">取 消</el-button>
        <el-button type="primary" :loading="loading" @click="activate">確 定</el-button>
      </div>
    </el-dialog>

    <!-- 修改密碼 -->
    <el-dialog title="修改廠商密碼" :visible.sync="changePwdDialog.show" width="480px" append-to-body>
      <el-input
        type="password"
        v-model="changePwdDialog.password"
        placeholder="請輸入新密碼（至少 6 位）"
        show-password
      ></el-input>
      <div slot="footer" class="dialog-footer">
        <el-button @click="changePwdDialog.show = false">取 消</el-button>
        <el-button type="primary" :loading="loading" @click="submitChangePwd">確 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'vendorIndex',
  data () {
    return {
      loggedIn: false,
      password: '',
      loading: false,
      loadingList: false,
      terminals: [],
      activeTab: 'terminals',
      canGenerate: false,
      generateForm: { edition: 'terminal', mid: '', machineId: '', customer: '', exp: '' },
      generatedKey: '',
      activateDialog: { show: false, code: '', licenseKey: '' },
      changePwdDialog: { show: false, password: '' }
    }
  },
  computed: {
    isLogin () {
      return this.loggedIn
    }
  },
  methods: {
    typeLabel (type) {
      const map = { cashier: '收銀機', kiosk: '點餐機', pad: '平板', kitchen: '廚房' }
      return map[type] || type
    },
    typeTag (type) {
      const map = { cashier: '', kiosk: 'success', pad: 'warning', kitchen: 'info' }
      return map[type] || 'info'
    },
    statusLabel (status) {
      const map = { licensed: '已啟用', expired: '已過期', invalid: '無效', unlicensed: '未啟用' }
      return map[status] || status
    },
    statusTag (status) {
      const map = { licensed: 'success', expired: 'danger', invalid: 'warning', unlicensed: 'info' }
      return map[status] || 'info'
    },
    login () {
      if (!this.password) {
        this.$message({ type: 'error', message: '請輸入廠商密碼' })
        return
      }
      this.loading = true
      this.$axios.post('/api/vendor/login', { password: this.password })
        .then(res => {
          localStorage.setItem('vendorTk', res.data.token)
          this.loggedIn = true
          this.password = ''
          this.loadData()
          this.checkGenerate()
        })
        .catch(err => {
          const data = (err && err.response && err.response.data) || {}
          this.$message({ type: 'error', message: data.msg || '登入失敗' })
        })
        .finally(() => { this.loading = false })
    },
    checkGenerate () {
      this.$axios.get('/api/vendor/canGenerate')
        .then(res => { this.canGenerate = !!(res.data && res.data.canGenerate) })
        .catch(() => { this.canGenerate = false })
    },
    loadData () {
      this.loadingList = true
      this.$axios.get('/api/vendor/terminals')
        .then(res => { this.terminals = res.data || [] })
        .catch(err => {
          const data = (err && err.response && err.response.data) || {}
          this.$message({ type: 'error', message: data.msg || '取得分機清單失敗' })
        })
        .finally(() => { this.loadingList = false })
    },
    generate () {
      if (!this.generateForm.mid.trim()) {
        this.$message({ type: 'error', message: this.generateForm.edition === 'terminal' ? '請輸入收銀機編號' : '請輸入機器識別碼' })
        return
      }
      this.loading = true
      this.generatedKey = ''
      this.$axios.post('/api/vendor/generate', this.generateForm)
        .then(res => { this.generatedKey = res.data.licenseKey })
        .catch(err => {
          const data = (err && err.response && err.response.data) || {}
          this.$message({ type: 'error', message: data.msg || '產生失敗' })
        })
        .finally(() => { this.loading = false })
    },
    openActivate (row) {
      this.activateDialog = { show: true, code: row.code, licenseKey: '' }
    },
    activate () {
      if (!this.activateDialog.licenseKey.trim()) {
        this.$message({ type: 'error', message: '請輸入授權碼' })
        return
      }
      this.loading = true
      this.$axios.post('/api/vendor/activate', {
        terminalCode: this.activateDialog.code,
        licenseKey: this.activateDialog.licenseKey.trim()
      })
        .then(res => {
          this.$message({ type: 'success', message: res.data.msg || '分機授權成功' })
          this.activateDialog.show = false
          this.loadData()
        })
        .catch(err => {
          const data = (err && err.response && err.response.data) || {}
          this.$message({ type: 'error', message: data.msg || '授權失敗' })
        })
        .finally(() => { this.loading = false })
    },
    revoke (row) {
      this.$confirm(`確認撤銷「${row.code}」的分機授權？`, '撤銷確認', { type: 'warning' })
        .then(() => {
          this.$axios.post('/api/vendor/revoke', { terminalCode: row.code })
            .then(res => {
              this.$message({ type: 'success', message: res.data.msg || '已撤銷' })
              this.loadData()
            })
            .catch(err => {
              const data = (err && err.response && err.response.data) || {}
              this.$message({ type: 'error', message: data.msg || '撤銷失敗' })
            })
        })
        .catch(() => {})
    },
    submitChangePwd () {
      if (!this.changePwdDialog.password || this.changePwdDialog.password.length < 6) {
        this.$message({ type: 'error', message: '密碼長度至少 6 位' })
        return
      }
      this.loading = true
      this.$axios.post('/api/vendor/changePassword', { password: this.changePwdDialog.password })
        .then(res => {
          this.$message({ type: 'success', message: '密碼已更新' })
          this.changePwdDialog.show = false
          this.changePwdDialog.password = ''
        })
        .catch(err => {
          const data = (err && err.response && err.response.data) || {}
          this.$message({ type: 'error', message: data.msg || '修改失敗' })
        })
        .finally(() => { this.loading = false })
    },
    copyText (text) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          this.$message({ type: 'success', message: '已複製到剪貼簿' })
        })
      } else {
        const input = document.createElement('textarea')
        input.value = text
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        document.body.removeChild(input)
        this.$message({ type: 'success', message: '已複製到剪貼簿' })
      }
    },
    logout () {
      localStorage.removeItem('vendorTk')
      this.loggedIn = false
      this.$router.push('/vendor')
    }
  },
  created () {
    this.loggedIn = !!localStorage.getItem('vendorTk')
    if (this.loggedIn) {
      this.loadData()
      this.checkGenerate()
    }
  }
}
</script>

<style>
#vendor {
  width: 100%;
  height: 100%;
  background-color: #f0f4fa;
}
#vendor .login-box {
  border-radius: 6px;
  padding: 28px 20px;
  width: 380px;
  background: #fff;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 20px rgba(83, 168, 255, 0.3);
}
#vendor .login-title {
  font-size: 20px;
  text-align: center;
  padding-bottom: 20px;
  color: #303133;
}
#vendor .submitBtn {
  width: 200px;
  display: block;
  margin: 20px auto 0;
  background: #297fff;
  border-color: #297fff;
}
#vendor .panel {
  height: 100%;
  padding: 16px 24px;
  box-sizing: border-box;
}
#vendor .panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
#vendor .panel-title {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
}
#vendor .machine-id {
  font-size: 13px;
  color: #555;
  margin-bottom: 12px;
}
#vendor .machine-id .label {
  color: #999;
  margin-right: 8px;
}
#vendor .machine-id .value {
  font-weight: 700;
  color: #297fff;
}
#vendor .generate-form {
  padding: 10px 0;
}
#vendor .generate-result {
  max-width: 620px;
}
</style>
