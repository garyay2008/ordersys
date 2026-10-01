/**
 * 封裝socket.io,為了獲取server以便監聽.
 */
const socketio = {}
const { Server } = require('socket.io')
let _io = null

// 記錄每個 socket 對應的工作站編號（terminalCode），斷線時自動釋放該工作站鎖定的枱號
const socketTerminals = new Map()

async function releaseTerminalLocks (terminalCode) {
  if (!terminalCode) return
  try {
    const Order = require('../models/Order')
    const orders = await Order.find({ state: 0, source: 'extension', terminalCode }).exec()
    for (const o of orders) {
      // 空鎖定單直接刪除；有品項的鎖定單還原為堂食單，避免遺失已點餐點
      if (!o.order || !o.order.length) {
        await Order.deleteOne({ _id: o._id }).exec()
      } else {
        o.source = 'pos'
        await o.save()
      }
    }
    if (orders.length && _io) _io.emit('tableUpdate')
  } catch (err) {
    console.log('[Log] 釋放工作站鎖定失敗：' + err.message)
  }
}

socketio.getSocketIO = serve => {
  _io = new Server(serve, {
    cors: {
      origin: true,
      credentials: true
    }
  })
  console.log('[Log] WebSocket service is active.')
  _io.on('connection', function(socket) {
    socket.on('registerTerminal', function(terminalCode) {
      if (terminalCode) {
        socketTerminals.set(socket.id, String(terminalCode))
      } else {
        socketTerminals.delete(socket.id)
      }
    })
    socket.on('submitOrder', function() {
      socket.broadcast.emit('checkOrder')
      socket.broadcast.emit('playAudio')
    })
    socket.on('disconnect', function() {
      const terminalCode = socketTerminals.get(socket.id)
      socketTerminals.delete(socket.id)
      releaseTerminalLocks(terminalCode)
    })
  })
  return _io
}

socketio.getIO = () => _io

module.exports = socketio
