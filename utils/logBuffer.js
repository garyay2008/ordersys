// 記憶體日誌緩衝：攔截 console.log/info/warn/error 存入環形緩衝區，
// 供後台「系統日誌」頁即時檢視（等同 docker logs -f ordersys-app，但免進容器）。
const MAX_ENTRIES = 2000

const entries = []
const original = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error
}

function stringify (a) {
  if (typeof a === 'string') return a
  if (a instanceof Error) return a.stack || a.message
  if (typeof a === 'object' && a !== null) {
    try { return JSON.stringify(a) } catch (e) { return String(a) }
  }
  return String(a)
}

function push (level, args) {
  let message
  try {
    message = Array.prototype.map.call(args, stringify).join(' ')
  } catch (e) {
    message = stringify(args && args[0])
  }
  entries.push({ ts: new Date().toISOString(), level, message })
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES)
}

console.log = function (...args) { push('info', args); original.log.apply(console, args) }
console.info = function (...args) { push('info', args); original.info.apply(console, args) }
console.warn = function (...args) { push('warn', args); original.warn.apply(console, args) }
console.error = function (...args) { push('error', args); original.error.apply(console, args) }

function getLogs (limit = 500, level) {
  const n = Math.max(1, Math.min(parseInt(limit) || 500, MAX_ENTRIES))
  const list = level ? entries.filter(e => e.level === level) : entries
  return list.slice(-n)
}

function clear () {
  entries.length = 0
}

module.exports = { getLogs, clear, MAX_ENTRIES }
