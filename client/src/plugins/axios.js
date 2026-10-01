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
    if (localStorage.orderTk && !(config.headers && config.headers.Authorization)) {
      config.headers.Authorization = localStorage.orderTk
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
      localStorage.removeItem('orderTk')
      // POS 頁面（/pos）不跳轉到管理後台登入
      if (router.currentRoute.path.indexOf('/pos') !== 0) {
        router.push('/login')
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
