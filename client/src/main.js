import Vue from 'vue'
import './plugins/axios'
import App from './App.vue'
import router from './router'
import store from './store'
import './plugins/element.js'
import socketPlugin from './plugins/socket'

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
