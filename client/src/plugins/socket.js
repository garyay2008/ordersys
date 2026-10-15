// socket.io 改為「按需載入」：只有實際用到即時通知（$socket / sockets 選項）的元件
// 才會動態載入 socket.io-client，避免把整包塞進首屏 vendor bundle（登入頁/一般 admin 頁用不到）。
let socket = null
let ioPromise = null

function getIo () {
  if (!ioPromise) {
    ioPromise = import(/* webpackChunkName: "socket.io" */ 'socket.io-client')
      .then(m => m.io || m.default)
  }
  return ioPromise
}

function getSocket () {
  if (socket) return Promise.resolve(socket)
  return getIo().then(io => {
    if (!socket) {
      socket = io(window.location.origin, {
        autoConnect: true
      })
    }
    return socket
  })
}

export default {
  install (Vue) {
    // 同步 getter：可能為 null（尚未載入），供需要檢查 connected 的場合使用
    Object.defineProperty(Vue.prototype, '$socket', {
      get () {
        return socket
      }
    })

    // 非同步取得（載入後）socket 實例
    Vue.prototype.$getSocket = getSocket

    // 簡化 emit：內部先確保 socket 已載入再送出事件
    Vue.prototype.$socketEmit = function (event, ...args) {
      return getSocket().then(s => s.emit(event, ...args))
    }

    Vue.mixin({
      created () {
        const sockets = this.$options.sockets
        if (!sockets) return
        this._socketListeners = []
        const handlers = Object.keys(sockets).map(event => ({
          event,
          handler: sockets[event].bind(this)
        }))
        getSocket().then(s => {
          handlers.forEach(({ event, handler }) => {
            this._socketListeners.push({ event, handler })
            s.on(event, handler)
          })
        })
      },
      beforeDestroy () {
        if (!this._socketListeners) return
        this._socketListeners.forEach(({ event, handler }) => {
          if (socket) socket.off(event, handler)
        })
      }
    })
  }
}
