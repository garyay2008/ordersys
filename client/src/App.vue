<template>
  <div id="app">
    <router-view></router-view>
  </div>
</template>

<script>
import jwtDecode from 'jwt-decode'
export default {
  name: 'app',
  data () {
    return {
      active: 0
    }
  },
  components: {

  },
  methods: {
    isEmpty (value) {
      return (value === undefined || value === null || (typeof value === 'object' && Object.keys(value).length === 0) || (typeof value === 'string' && value.trim().length === 0))
    }
  },
  created () {
    if (localStorage.orderTk) {
      try {
        const decoded = jwtDecode(localStorage.orderTk)
        if (decoded && typeof decoded === 'object' && Object.keys(decoded).length > 0) {
          this.$store.dispatch('changeStat', true)
          this.$store.dispatch('setUser', decoded)
        } else {
          localStorage.removeItem('orderTk')
        }
      } catch (e) {
        localStorage.removeItem('orderTk')
      }
    }
    // 授權啟用流程：僅當伺服器開啟強制驗證（桌面版）且未授權時，導向啟用頁
    // 顧客／自助／排隊／POS 等公開頁面不導向（與 axios 401 處理一致）
    this.$axios.get('/api/license/status')
      .then(res => {
        const s = res.data || {}
        const p = this.$router.currentRoute.path
        const isPublicPage = p.indexOf('/pos') === 0 || p.indexOf('/mpos') === 0 ||
          p.indexOf('/index/') === 0 || p.indexOf('/emenu/') === 0 ||
          p.indexOf('/kiosk') === 0 || p.indexOf('/paykiosk') === 0 ||
          p.indexOf('/queue') === 0
        if (s.enforced && !s.valid && !isPublicPage && p !== '/activate') {
          this.$router.replace('/activate?redirect=' + encodeURIComponent(this.$router.currentRoute.fullPath || p))
        }
      })
      .catch(() => {})
    // 分機授權：本機已指定收銀機編號時，檢查該分機是否已授權，未授權導向啟用頁
    const terminalCode = localStorage.getItem('posTerminal')
    if (terminalCode) {
      const p = this.$router.currentRoute.path
      const skip = p === '/activate' || p.indexOf('/admin') === 0 ||
        p.indexOf('/index/') === 0 || p.indexOf('/login') === 0 || p.indexOf('/init') === 0
      if (!skip) {
        this.$axios.get('/api/license/terminal-status', { params: { code: terminalCode } })
          .then(res => {
            if (!res.data || !res.data.licensed) {
              const target = '/activate?terminal=' + encodeURIComponent(terminalCode) +
                '&redirect=' + encodeURIComponent(this.$router.currentRoute.fullPath || p)
              this.$router.replace(target)
            }
          })
          .catch(() => {})
      }
    }
  }
}
</script>

<style>
html,
body,
#app {
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
}
#app {
  margin: 0;
  padding: 0;
}
/*修改滾動條樣式*/
::-webkit-scrollbar{
  width:10px;
  height:10px;
}
::-webkit-scrollbar-track{
  background: rgb(239, 239, 239);
  border-radius:2px;
}
::-webkit-scrollbar-thumb{
  background: #bfbfbf;
  border-radius:10px;
}
::-webkit-scrollbar-thumb:hover{
  background: #304156a2;
}
::-webkit-scrollbar-corner{
  background: #ddd;
}
</style>
