import { io } from 'socket.io-client'

const socket = io(window.location.origin, {
  autoConnect: true
})

export default {
  install (Vue) {
    Vue.prototype.$socket = socket

    Vue.mixin({
      created () {
        const sockets = this.$options.sockets
        if (!sockets) return
        this._socketListeners = []
        Object.keys(sockets).forEach(event => {
          const handler = sockets[event].bind(this)
          this._socketListeners.push({ event, handler })
          socket.on(event, handler)
        })
      },
      beforeDestroy () {
        if (!this._socketListeners) return
        this._socketListeners.forEach(({ event, handler }) => {
          socket.off(event, handler)
        })
      }
    })
  }
}
