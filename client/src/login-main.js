// 登入頁獨立 entry：只載入登入表單所需的依賴（vue/vue-router/axios/
// 6 個 element-ui 元件），不載入 vuex、socket.io、其餘 element-ui 元件與 POS/QR 相關程式，
// 讓登入頁首屏 bundle 大幅縮小、秒開。（登入成功後整頁跳轉，用戶狀態由主 SPA 自行重建）
import Vue from 'vue'
import router from './router/index'
import './plugins/axios'
import './plugins/element-login'

Vue.config.productionTip = false

new Vue({
  router,
  render: h => h('router-view')
}).$mount('#app')
