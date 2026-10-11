<template>
  <div id="activate">
    <div class="activate-box">
      <p class="activate-title">{{ isTerminal ? '分機授權啟用' : '授權啟用' }}</p>
      <div class="machine-id">
        <span class="label">{{ isTerminal ? '收銀機編號' : '機器識別碼' }}</span>
        <span class="value">{{ isTerminal ? terminalCode : machineId }}</span>
      </div>
      <el-input
        type="textarea"
        :rows="5"
        v-model="licenseKey"
        placeholder="請貼上廠商提供的授權碼"
      ></el-input>
      <el-button
        type="primary"
        class="submitBtn"
        :loading="loading"
        @click="activate"
      >啟用</el-button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'activate',
  data () {
    return {
      machineId: '',
      terminalCode: '',
      licenseKey: '',
      redirect: '',
      loading: false
    }
  },
  computed: {
    isTerminal () {
      return !!this.terminalCode
    }
  },
  methods: {
    activate () {
      if (!this.licenseKey.trim()) {
        this.$message({ type: 'error', message: '請輸入授權碼' })
        return
      }
      this.loading = true
      if (this.isTerminal) {
        this.$axios.post('/api/license/activate-terminal', { terminalCode: this.terminalCode, licenseKey: this.licenseKey.trim() })
          .then(() => {
            this.$message({ type: 'success', message: '分機授權成功' })
            const target = this.redirect || ('/pos?terminal=' + encodeURIComponent(this.terminalCode))
            setTimeout(() => { window.location.href = target }, 1000)
          })
          .catch(err => {
            const data = (err && err.response && err.response.data) || {}
            this.$message({ type: 'error', message: data.msg || '授權失敗' })
          })
          .finally(() => { this.loading = false })
      } else {
        this.$axios.post('/api/license/activate', { licenseKey: this.licenseKey.trim() })
          .then(() => {
            this.$message({ type: 'success', message: '授權成功，即將進入登入頁' })
            setTimeout(() => { this.$router.push('/login') }, 1200)
          })
          .catch(err => {
            const data = (err && err.response && err.response.data) || {}
            this.$message({ type: 'error', message: data.msg || '授權失敗' })
          })
          .finally(() => { this.loading = false })
      }
    }
  },
  created () {
    this.terminalCode = (this.$route.query.terminal || '').trim()
    this.redirect = (this.$route.query.redirect || '').trim()
    if (!this.isTerminal) {
      this.$axios.get('/api/license/status')
        .then(res => {
          this.machineId = (res.data && res.data.machineId) || ''
        })
        .catch(err => {
          console.log(err)
        })
    }
  }
}
</script>

<style>
  *{
    margin: 0;
    padding: 0;
  }
  #activate{
    width: 100%;
    height: 100%;
    background-color: rgb(217, 236, 255);
    background-image: url('../../assets/images/loginBG.svg');
    background-repeat: no-repeat;
    background-position: center 110px;
    background-size: 100%;
    position: relative;
  }
  #activate .activate-box{
      border-radius: 6px;
      padding: 20px;
      width: 480px;
      background: #fff;
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%,-50%);
      box-shadow: 0px 0px 20px rgba(83, 168, 255, 0.3);
  }
  #activate .activate-title{
      font-size: 20px;
      text-align: center;
      padding: 20px 0px;
  }
  #activate .machine-id{
      font-size: 13px;
      color: #555;
      margin-bottom: 12px;
      word-break: break-all;
  }
  #activate .machine-id .label{
      color: #999;
      margin-right: 8px;
  }
  #activate .submitBtn{
    width: 200px;
    display: block;
    margin: 20px auto 0;
    box-shadow: 0px 0px 20px rgba(53, 141, 230, 0.562);
    background: #297fff;
    border-color: #297fff;
  }
  #activate .submitBtn:hover{
    background: #5b9cff;
    border-color: #5b9cff;
  }
</style>
