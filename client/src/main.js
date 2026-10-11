import Vue from 'vue'
import './plugins/axios'
import App from './App.vue'
import router from './router'
import store from './store'
import './plugins/element.js'
import socketPlugin from './plugins/socket'

// 從 URL 讀取收銀機編號（?terminal=CODE），供分機授權識別與 POS 使用
// 分機（POS/自助機/電子菜單/排隊屏）皆可經此參數指定所屬收銀機編號
;(function resolveTerminalFromUrl () {
  try {
    const params = new URLSearchParams(window.location.search)
    const terminal = params.get('terminal')
    if (terminal) localStorage.setItem('posTerminal', terminal)
  } catch (e) { /* 忽略 */ }
})()

Vue.use(socketPlugin)

Vue.config.productionTip = false
Vue.config.errorHandler = function (err, vm, info) {
  console.error('[Vue error]', info, err)
  var msg = err && err.message ? err.message : String(err)
  if (vm && vm.$options && vm.$options.name) msg = '[' + vm.$options.name + '] ' + msg
  alert('渲染錯誤: ' + msg + '\n\n' + (err && err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : ''))
}

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
