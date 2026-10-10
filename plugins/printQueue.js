// BullMQ + Redis 專用出單微服務（Print Worker）
//
// 用途：
//   - 每台打印機獨立 Queue（concurrency=1），同一目標嚴格串行、不互相超時
//   - 任務持久化於 Redis，重啟後不遺失排隊中的單據
//   - 失敗自動重試（指數退避 exponential backoff）；attempts 耗盡後跳飛備援機
//   - 搭配 Printer.js 的 DLE EOT 即時狀態預檢（熱敏與針式 Epson TM-U220 均支援）
//   - Redis 連線異常時執行期降級回 in-memory FIFO，確保不漏單
//
// 遷移方式：設定 REDIS_URL 後，將原本的
//   escpos.printWithFailover(setting, printer, data, meta)
// 改為
//   printQueue.enqueuePrint(setting, printer, data, meta)
// 未設定 REDIS_URL 時，enqueuePrint 自動沿用既有 in-memory FIFO + 跳飛。
// 需同步取得結果（等同舊 printWithFailover 回傳 { ok, printedTo }）時傳入 { wait: true }。
const { Queue, QueueEvents, Worker } = require('bullmq')
const IORedis = require('ioredis')
const config = require('../config/config')
const Printer = require('../models/Printer')
const socketio = require('./SocketIO')
const {
  print,
  computeDeadline,
  targetKey,
  hasTarget,
  buildFallbackPlan,
  buildFailoverBanner,
  emitFailover,
  emitPrintBlocked,
  printWithFailover
} = require('./Printer')

let connection = null
const producers = {}
const workers = {}
const queueEventsMap = {}
// jobId -> Promise<{ok, printedTo}>：同步 wait 時對照主機失敗後跳飛的結果
const failoverResults = new Map()
// jobId -> deadline(ms)：主機 worker 開始列印時計算，供 failed handler 的跳飛延續同一截止時間
const jobDeadlines = new Map()

// Printer 設定快取：worker 執行時重取，避免每張單都把整份設定塞進 Job
let settingCache = { doc: null, at: 0 }
const SETTING_TTL = 30000

function enabled () {
  return !!config.redisURL
}

function getConnection () {
  if (!config.redisURL) return null
  if (!connection) {
    connection = new IORedis(config.redisURL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    })
    connection.on('error', (e) => console.log(`[PrintQueue] Redis 錯誤：${e.message}`))
  }
  return connection
}

// 每台打印機一個佇列名（concurrency=1 串行）
// BullMQ 佇列名不可含「:」，故以「print_」為前綴（targetKey 內的 : 已一併替換）
function queueNameFor (printer) {
  return 'print_' + String(targetKey(printer)).replace(/[^a-zA-Z0-9_.-]/g, '_')
}

function getProducer (queueName) {
  const conn = getConnection()
  if (!conn) return null
  if (!producers[queueName]) {
    producers[queueName] = new Queue(queueName, { connection: conn })
    // 註冊到 Bull Board 儀表板
    try { require('./printDashboard').registerQueue(producers[queueName]) } catch (e) {}
  }
  return producers[queueName]
}

function getQueueEvents (queueName) {
  const conn = getConnection()
  if (!conn) return null
  if (!queueEventsMap[queueName]) queueEventsMap[queueName] = new QueueEvents(queueName, { connection: conn })
  return queueEventsMap[queueName]
}

function stationNameOf (printer) {
  return (printer && printer.name) || (printer && printer.ip) || '打印機'
}

// 列印失敗告警：透過 Socket.IO 推播給 POS/後台（列印監控頁監聽 printFailed）
function emitPrintFailed (printer, message) {
  try {
    const io = socketio.getIO()
    if (io) {
      io.emit('printFailed', {
        station: stationNameOf(printer),
        message: message || '列印失敗',
        time: Date.now()
      })
    }
  } catch (e) {}
}

async function getPrinterSetting () {
  const now = Date.now()
  if (settingCache.doc && now - settingCache.at < SETTING_TTL) return settingCache.doc
  const doc = await Printer.findOne().lean().exec()
  settingCache = { doc, at: now }
  return doc
}

// 跳飛（主機 attempts 耗盡後）：備援機(fallbackTo) → 廚房通用機，策略與 in-memory 一致
// deadline：主機 worker 計算的截止時間戳，跳飛延續同一預算；逾時即停止
async function runFailover (setting, printer, buf, meta, deadline) {
  const stationName = stationNameOf(printer)
  for (const cand of buildFallbackPlan(setting, printer)) {
    if (deadline && Date.now() >= deadline) {
      console.log(`[PrintQueue] ${stationName} 跳飛總時間已用盡，停止跳飛`)
      break
    }
    const target = cand.printer
    const label = cand.label
    try {
      await print(target, Buffer.concat([buildFailoverBanner(target, stationName), buf]), undefined, meta, deadline)
      console.log(`[PrintQueue] 已跳飛至「${label}」`)
      await emitFailover(stationName, label, meta)
      return { ok: true, printedTo: label }
    } catch (e) {
      console.log(`[PrintQueue] 備援機「${label}」列印失敗：${e.message}`)
    }
  }
  console.log(`[PrintQueue] ${stationName} 全部嘗試失敗，已跳過（不影響落單）`)
  return { ok: false, printedTo: '' }
}

function ensureWorker (queueName) {
  if (workers[queueName]) return workers[queueName]
  const conn = getConnection()
  const worker = new Worker(queueName, async (job) => {
    // 對主機直接列印（含 DLE EOT 預檢 + 內部重試）；失敗 throw 交由 BullMQ 指數退避重試
    const { printer, data, meta } = job.data
    const buf = Buffer.from(data, 'base64')
    // 於 worker 真正開始列印時才計算截止時間（不含佇列排隊等待），主機與後續跳飛共用同一預算
    const deadline = await computeDeadline()
    jobDeadlines.set(job.id, deadline)
    try {
      await print(printer, buf, undefined, meta, deadline)
      return { ok: true, printedTo: stationNameOf(printer) }
    } catch (e) {
      // 預檢攔截（缺紙/離線/開蓋，未送出）：不視為失敗，回傳 blocked 供 completed handler 通知前台
      if (e && e.blocked) return { ok: false, blocked: true, reason: e.message, station: stationNameOf(printer) }
      throw e
    }
  }, {
    connection: conn,
    concurrency: 1,
    lockDuration: 60000
  })

  worker.on('completed', (job, result) => {
    jobDeadlines.delete(job.id)
    if (result && result.blocked) {
      console.log(`[PrintQueue] ${result.station || ''} 預檢攔截（${result.reason}），等待補紙/補單`)
      emitPrintBlocked(result.station, result.reason, job.data && job.data.meta)
      return
    }
    console.log(`[PrintQueue] 列印完成（${job.id}）：${(result && result.printedTo) || ''}`)
  })

  worker.on('failed', async (job, err) => {
    const { printer, data, meta } = job.data
    const buf = Buffer.from(data, 'base64')
    console.log(`[PrintQueue] 主機列印重試耗盡（${err.message}），啟動跳飛備援機`)
    const deadline = jobDeadlines.get(job.id)
    jobDeadlines.delete(job.id)
    const setting = await getPrinterSetting()
    const p = runFailover(setting, printer, buf, meta, deadline)
    failoverResults.set(job.id, p)
    p.finally(() => failoverResults.delete(job.id))
    const result = await p
    if (!result.ok) emitPrintFailed(printer, err.message)
  })

  worker.on('error', (err) => console.log(`[PrintQueue] Worker 錯誤：${err.message}`))

  workers[queueName] = worker
  return worker
}

// 送單入佇列。
// opts.wait=true 時同步等待完成並回傳 { ok, printedTo }（等同舊 printWithFailover 語意）。
async function enqueuePrint (setting, printer, data, meta, opts) {
  opts = opts || {}
  // 未設定 REDIS_URL：沿用既有 in-memory FIFO + 跳飛（同步語意不變）
  if (!enabled()) {
    const r = await printWithFailover(setting, printer, data, meta)
    if (r && !r.ok && !r.blocked) emitPrintFailed(printer, '列印失敗')
    return r
  }
  if (!printer || !printer.ip) {
    return { ok: false, printedTo: '' }
  }
  const queueName = queueNameFor(printer)
  let job
  try {
    ensureWorker(queueName)
    job = await getProducer(queueName).add('print-job', {
      printer,
      data: data.toString('base64'),
      meta
    }, {
      attempts: 1,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 }
    })
  } catch (e) {
    // Redis 連線失敗/異常：執行期降級回 in-memory，確保不漏單
    console.log(`[PrintQueue] Redis 送單失敗（${e.message}），降級回 in-memory`)
    const r = await printWithFailover(setting, printer, data, meta)
    if (r && !r.ok) emitPrintFailed(printer, e.message)
    return r
  }

  if (opts.wait) {
    const qe = getQueueEvents(queueName)
    try {
      const result = await job.waitUntilFinished(qe, opts.timeout || 60000)
      if (result && result.blocked) return { ok: false, blocked: true, reason: result.reason }
      return { ok: true, printedTo: result.printedTo }
    } catch (e) {
      // 主機 attempts 耗盡：等待 failed handler 的跳飛結果（輪詢最多 ~1s 避免事件競速）
      for (let i = 0; i < 10; i++) {
        const fo = failoverResults.get(job.id)
        if (fo) return await fo
        await new Promise(r => setTimeout(r, 100))
      }
      return { ok: false, printedTo: '' }
    }
  }
  return job
}

// 可觀測性：回傳各佇列目前任務計數（供 PrintMonitor / 健康檢查使用）
async function getQueueStatus () {
  if (!enabled()) return []
  const out = []
  for (const name of Object.keys(producers)) {
    try {
      const counts = await producers[name].getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed')
      out.push({ queue: name, counts })
    } catch (e) {
      // 佇列暫時不可用時略過
    }
  }
  return out
}

async function shutdown () {
  for (const worker of Object.values(workers)) {
    try { await worker.close() } catch (e) {}
  }
  for (const queue of Object.values(producers)) {
    try { await queue.close() } catch (e) {}
  }
  for (const qe of Object.values(queueEventsMap)) {
    try { await qe.close() } catch (e) {}
  }
  if (connection) {
    try { connection.disconnect() } catch (e) {}
  }
}

// 開機預先註冊所有已設定目標（ip）的打印機佇列，
// 讓 Bull Board 儀表板開機即顯示各台打印機狀態（而非首張單後才出現）。
async function warmup () {
  if (!enabled()) return
  try {
    const Printer = require('../models/Printer')
    const PosTerminal = require('../models/PosTerminal')
    const setting = await Printer.findOne().lean().exec()
    const seen = new Set()
    const targets = []
    const push = (p) => {
      if (hasTarget(p)) {
        const key = targetKey(p)
        if (!seen.has(key)) { seen.add(key); targets.push(p) }
      }
    }
    if (setting) {
      ;(setting.printers || []).forEach(push)
      if (setting.centralPrint) push(setting.centralPrint)
      push({ ip: setting.ip, port: setting.port, name: setting.name || '預設打印機' })
      ;(setting.zones || []).forEach(z => {
        push({ ip: z.serviceIp, port: z.servicePort, name: (z.name || '') + '-上菜' })
        push({ ip: z.cashierIp, port: z.cashierPort, name: (z.name || '') + '-收銀' })
      })
    }
    const terminals = await PosTerminal.find({}).lean().exec()
    terminals.forEach(t => {
      if (t.receipt) push(Object.assign({ name: t.name + '-收據' }, t.receipt))
      if (t.serving) push(Object.assign({ name: t.name + '-上菜紙' }, t.serving))
      if (t.print) push(Object.assign({ name: t.name + '-印單' }, t.print))
    })
    for (const p of targets) {
      const qn = queueNameFor(p)
      ensureWorker(qn)
      getProducer(qn) // 同時註冊到 Bull Board 儀表板
    }
    console.log(`[PrintQueue] 開機預先註冊 ${targets.length} 台打印機佇列`)
  } catch (e) {
    console.log(`[PrintQueue] 開機預先註冊失敗：${e.message}`)
  }
}

module.exports = {
  enabled,
  enqueuePrint,
  warmup,
  getQueueStatus,
  shutdown
}
