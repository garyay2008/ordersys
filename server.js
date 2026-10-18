// 攔截 console 輸出到記憶體環形緩衝（供後台「系統日誌」頁檢視，需最先載入）
require('./utils/logBuffer')
const express = require('express')
const app = express()
const passport = require('passport')
const path = require('path')

// 設置WebSocket
const http = require('http').Server(app)
const io = require('./plugins/SocketIO').getSocketIO(http)
const printQueue = require('./plugins/printQueue')
const printDashboard = require('./plugins/printDashboard')

// 解決參數傳遞問題
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

// Brotli（優先）/ gzip 壓縮（JS/CSS/JSON 等靜態與 API 回應），加快掃碼點餐與登入頁載入速度
app.use(require('./middleware/compress')())

// 連接 PostgreSQL
const config = require('./config/config')
const pg = require('./db/pg')
const { migrate } = require('./db/migrate')

const isConnected = pg.query('SELECT 1').then(async () => {
  console.log('[Log] The database is connected.')
  await migrate()

  // Seed 預設 Amounts
  const Amount = require('./models/Amount')
  const defaults = [
    { key: 'payMethod', value: '現金' },
    { key: 'payMethod', value: 'Visa' },
    { key: 'payMethod', value: 'Master' },
    { key: 'payMethod', value: '銀聯' },
    { key: 'payMethod', value: '中銀' },
    { key: 'payMethod', value: '支付寶' },
    { key: 'payMethod', value: '微信支付' },
    { key: 'payMethod', value: '八達通' },
    { key: 'payType', value: '堂食' },
    { key: 'payType', value: '外賣自取' }
  ]
  Promise.all(defaults.map(d =>
    Amount.findOneAndUpdate({ key: d.key, value: d.value }, { $set: d }, { upsert: true })
  )).catch(err => console.log('[Seed] Amounts 預設值寫入失敗：' + err.message))
  // 開機預先註冊打印機佇列（Bull Board 儀表板開機即顯示各台狀態）
  printQueue.warmup()
  // 預先載入列印相關 PosSetting 快取（外賣枱枱號範圍等同步票據欄位）
  require('./models/PosSetting').findOne()
    .then(ps => { if (ps) require('./plugins/Printer').setPosSettingCache(ps) })
    .catch(() => {})
  // 啟動中央備份上傳排程（方案 C）
  require('./utils/centralBackup').startScheduler()
})

// 設置靜態資源服務器
app.use(express.static(config.publicDir))

// 初始化Passport
require('./models/User')
require('./models/Staff')
require('./models/Amount')
app.use(passport.initialize())
require('./config/passport')(passport)

// License：公開狀態查詢（需放在強制驗證之前，讓客戶可自行確認授權狀態）
const license = require('./utils/license')
app.get('/api/license/status', (req, res) => {
  res.json(license.getLicenseStatus())
})
app.use('/api/license', require('./routes/api/license'))
app.use('/api/vendor', require('./routes/api/vendor'))

// 授權強制驗證：設定 LICENSE_ENFORCE=1 時，無效/過期授權會擋下所有 /api 請求
if (process.env.LICENSE_ENFORCE === '1') {
  app.use('/api', (req, res, next) => {
    // 授權相關端點（狀態/機器碼/啟用）與廠商端點不受強制驗證攔截，讓客戶可自行啟用授權、廠商可登入管理
    if (req.path.indexOf('/license') === 0 || req.path.indexOf('/vendor') === 0) return next()
    const status = license.getLicenseStatus()
    if (status.valid) return next()
    return res.status(402).json({ msg: '授權無效或已過期', code: status.reason })
  })

  // 分機授權強制驗證：請求帶 x-terminal-code 標頭時，需該收銀機已有有效授權
  const TerminalLicense = require('./models/TerminalLicense')
  app.use('/api', async (req, res, next) => {
    const terminalCode = (req.get('x-terminal-code') || '').trim()
    if (!terminalCode) return next()
    // 授權啟用/查詢、廠商端點與收銀機清單端點豁免，供分機啟用流程使用
    if (req.path.indexOf('/license') === 0 ||
        req.path.indexOf('/vendor') === 0 ||
        req.path === '/posterminal/all' ||
        req.path === '/posterminal/enabled') return next()
    try {
      const doc = await TerminalLicense.findOne({ code: terminalCode })
      if (doc && license.checkTerminalLicense(doc.key, license.getMachineId(), terminalCode).valid) return next()
    } catch (e) { /* 查無或錯誤皆視為未授權 */ }
    return res.status(402).json({ msg: '分機未授權或授權已過期', code: 'TERMINAL_UNLICENSED' })
  })
}

// 應用路由
app.use('/api/users', require('./routes/api/users'))
app.use('/api/shop', require('./routes/api/shop'))
app.use('/api/init', require('./routes/api/init'))
app.use('/api/category', require('./routes/api/category'))
app.use('/api/commodity', require('./routes/api/commodity'))
app.use('/api/qrcode', require('./routes/api/qrCode'))
app.use('/api/order', require('./routes/api/order'))
app.use('/api/statistic', require('./routes/api/statisticData'))
app.use('/api/printer', require('./routes/api/printer'))
app.use('/api/print', require('./routes/api/print'))
app.use('/api/combo', require('./routes/api/combo'))
app.use('/api/bundlegroup', require('./routes/api/bundlegroup'))
app.use('/api/maingroup', require('./routes/api/maingroup'))
app.use('/api/matchingrule', require('./routes/api/matchingrule'))
app.use('/api/modcode', require('./routes/api/modcode'))
app.use('/api/table', require('./routes/api/table'))
app.use('/api/zone', require('./routes/api/zone'))
app.use('/api/department', require('./routes/api/department'))
app.use('/api/staff', require('./routes/api/staff'))
app.use('/api/possetting', require('./routes/api/possetting'))
app.use('/api/posterminal', require('./routes/api/posterminal'))
app.use('/api/qrsetting', require('./routes/api/qrsetting'))
app.use('/api/emenu', require('./routes/api/emenu'))
app.use('/api/kiosk', require('./routes/api/kiosk'))
app.use('/api/amount', require('./routes/api/amount'))
app.use('/api/businessday', require('./routes/api/businessday'))
app.use('/api/clock', require('./routes/api/clock'))
app.use('/api/queue', require('./routes/api/queue'))
app.use('/api/hold', require('./routes/api/hold'))
app.use('/api/systemmaint', require('./routes/api/systemmaint'))
app.use('/api/mreport', require('./routes/api/mreport'))
app.use('/api/centralbackup', require('./routes/api/centralbackup'))

// Bull Board 列印佇列儀表板（Basic Auth 保護）
app.use('/admin/queues', printDashboard.basicAuth, printDashboard.router)

// 登入頁為獨立 entry（login.html）：根路徑與 /login 直接回傳輕量登入頁。
// 需放在 client/dist 靜態服務之前，否則 express.static 會以 index.html 作為根目錄預設文件攔截「/」。
app.get(['/', '/login'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(path.join(__dirname, 'client/dist/login.html'))
})

// 生產版前端（client/dist）與 SPA history 回退
// 帶 hash 的靜態資源（js/css/字型等）長效快取，index.html 不緩存（確保拿到最新版本）
app.use(express.static(path.join(__dirname, 'client/dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html') || filePath.endsWith('login.html')) {
      res.setHeader('Cache-Control', 'no-cache')
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }
  }
}))
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(path.join(__dirname, 'client/dist/index.html'))
})

// 等待 PostgreSQL 連線完成後再啟動 HTTP 伺服器
isConnected.then(() => {
  const lic = license.getLicenseStatus()
  if (lic.valid) {
    const expInfo = lic.expiresAt ? `，到期日 ${lic.expiresAt}` : '，永久授權'
    const customerInfo = lic.customer ? `：${lic.customer}` : ''
    console.log(`[License] 已啟用${customerInfo}${expInfo}（機器ID ${lic.machineId}）`)
  } else {
    console.warn(`[License] 未通過（${lic.reason}）機器ID ${lic.machineId}。請設定 LICENSE_KEY 或放入 license.key 啟用`)
  }
  const PORT = process.env.PORT || 3000
  const server = http.listen(PORT, '0.0.0.0', () => {
    console.log('[Log] Server is running ...')
    console.log(`[Log] Url:http://0.0.0.0:${PORT}`)
  })

  // 優雅關閉：SIGTERM/SIGINT 先關 BullMQ worker/連線，再關 HTTP 與 PostgreSQL
  let shuttingDown = false
  const shutdown = (signal) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`[Log] 收到 ${signal}，開始優雅關閉…`)
    setTimeout(() => { console.error('[Log] 優雅關閉逾時，強制退出'); process.exit(1) }, 10000).unref()
    printQueue.shutdown().catch(e => console.log('[Log] 列印佇列關閉失敗：' + e.message)).finally(() => {
      server.close(() => {
        pg.pool.end().finally(() => {
          console.log('[Log] 已關閉，程序退出')
          process.exit(0)
        })
      })
    })
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}).catch(err => {
  console.error('[Log] 啟動失敗（資料庫連線或遷移）：', err.message)
  process.exit(1)
})
