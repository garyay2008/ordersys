'use strict'

import Vue from 'vue'
import axios from 'axios'
import { Message } from 'element-ui'
import router from '../router/index'

// Full config:  https://github.com/axios/axios#request-config
// axios.defaults.baseURL = process.env.baseURL || process.env.apiUrl || '';
// axios.defaults.headers.common['Authorization'] = AUTH_TOKEN;
// axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded';

const config = {
  // baseURL: process.env.baseURL || process.env.apiUrl || ""
  // timeout: 60 * 1000, // Timeout
  // withCredentials: true, // Check cross-site Access-Control
}

const _axios = axios.create(config)

const Plugin = {}

_axios.interceptors.request.use(
  function (config) {
    // 廠商端：優先附加廠商 token（分機授權管理）
    const isVendorPage = router.currentRoute.path && router.currentRoute.path.indexOf('/vendor') === 0
    if (isVendorPage && localStorage.vendorTk && !(config.headers && config.headers.Authorization)) {
      config.headers.Authorization = localStorage.vendorTk
    } else if (localStorage.orderTk && !(config.headers && config.headers.Authorization)) {
      config.headers.Authorization = localStorage.orderTk
    }
    // 分機授權：附加收銀機編號標頭，供後端驗證該分機是否已授權
    const terminalCode = localStorage.getItem('posTerminal')
    if (terminalCode && !(config.headers && config.headers['x-terminal-code'])) {
      config.headers['x-terminal-code'] = terminalCode
    }
    return config
  },
  function (error) {
    return Promise.reject(error)
  }
)

// Add a response interceptor
_axios.interceptors.response.use(
  function (response) {
    return response
  },
  function (error) {
    if (!error.response) {
      Message.error('網路錯誤，請稍後重試')
      return Promise.reject(error)
    }
    const { status } = error.response
    if (status === 401) {
      Message.error('操作超時，請重新登錄！')
      // 廠商端登出 → 回廠商登入頁
      if (router.currentRoute.path && router.currentRoute.path.indexOf('/vendor') === 0) {
        localStorage.removeItem('vendorTk')
        router.push('/vendor')
        return Promise.reject(error)
      }
      localStorage.removeItem('orderTk')
      // 客人／自助／排隊等公開頁面不跳轉到管理後台登入
      const p = router.currentRoute.path
      const isPublicPage = p.indexOf('/pos') === 0 || p.indexOf('/mpos') === 0 ||
        p.indexOf('/index/') === 0 || p.indexOf('/emenu/') === 0 ||
        p.indexOf('/kiosk') === 0 || p.indexOf('/paykiosk') === 0 ||
        p.indexOf('/queue') === 0 || p.indexOf('/mreport') === 0
      if (!isPublicPage) {
        window.location.href = '/login'
      }
    } else if (status === 402) {
      // 授權失敗：主機授權或分機授權 → 導向啟用頁
      const data = error.response.data || {}
      const terminalCode = localStorage.getItem('posTerminal') || ''
      const from = router.currentRoute.fullPath || router.currentRoute.path
      const target = data.code === 'TERMINAL_UNLICENSED' && terminalCode
        ? '/activate?terminal=' + encodeURIComponent(terminalCode) + '&redirect=' + encodeURIComponent(from)
        : '/activate?redirect=' + encodeURIComponent(from)
      Message.error(data.msg || '授權無效或已過期')
      if (router.currentRoute.path !== '/activate') {
        router.replace(target)
      }
    } else {
      Message.error(error.response.data || '請求失敗')
    }
    return Promise.reject(error)
  }
)

Plugin.install = function (Vue, options) {
  Vue.axios = _axios
  window.axios = _axios
  Object.defineProperties(Vue.prototype, {
    axios: {
      get () {
        return _axios
      }
    },
    $axios: {
      get () {
        return _axios
      }
    }
  })
}

Vue.use(Plugin)

export default Plugin
