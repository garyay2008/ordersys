// Bull Board 列印佇列儀表板（Web UI）
// 掛載於 /admin/queues，即時檢視每台打印機的 waiting/active/completed/failed/delayed、
// 失敗原因、重試，並可手動 retry / clean / pause。
// 佇列由 printQueue.js 建立時動態註冊（首張單送出後即出現在儀表板）。
const fs = require('fs')
const path = require('path')
const { createBullBoard } = require('@bull-board/api')
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter')
const { ExpressAdapter } = require('@bull-board/express')
const config = require('../config/config')

// Bull Board 僅內建簡體中文 (zh-CN)，於啟動時以 opencc-js 轉換成繁體 (zh-TW)
// 並寫入其靜態語系目錄，供 UI 依 locale.lng 載入（Docker 與本機執行皆適用）。
function ensureZhTWLocale () {
  try {
    const localesDir = path.join(__dirname, '../node_modules/@bull-board/ui/dist/static/locales')
    const srcFile = path.join(localesDir, 'zh-CN', 'messages.json')
    const dstDir = path.join(localesDir, 'zh-TW')
    const dstFile = path.join(dstDir, 'messages.json')
    if (!fs.existsSync(srcFile) || fs.existsSync(dstFile)) return
    const OpenCC = require('opencc-js')
    const converter = OpenCC.Converter({ from: 'cn', to: 'tw' })
    const walk = (node) => {
      if (typeof node === 'string') return converter(node)
      if (Array.isArray(node)) return node.map(walk)
      if (node && typeof node === 'object') {
        const out = {}
        for (const [k, v] of Object.entries(node)) out[k] = walk(v)
        return out
      }
      return node
    }
    const src = JSON.parse(fs.readFileSync(srcFile, 'utf8'))
    fs.mkdirSync(dstDir, { recursive: true })
    fs.writeFileSync(dstFile, JSON.stringify(walk(src), null, 2), 'utf8')
    console.log('[PrintDashboard] 已產生繁體中文 (zh-TW) 語系')
  } catch (e) {
    console.log(`[PrintDashboard] zh-TW 語系產生失敗：${e.message}`)
  }
}
ensureZhTWLocale()

const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/admin/queues')

const { addQueue } = createBullBoard({
  queues: [],
  serverAdapter,
  options: {
    uiConfig: {
      boardTitle: '列印佇列 Print Queue',
      locale: { lng: 'zh-TW' }
    }
  }
})

// 動態註冊一台打印機的佇列（printQueue.js 建立 Queue 時呼叫）
function registerQueue (queue) {
  addQueue(new BullMQAdapter(queue))
}

function parseCookies (str) {
  const out = {}
  String(str || '').split(';').forEach(pair => {
    const idx = pair.indexOf('=')
    if (idx < 0) return
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim())
  })
  return out
}

// HTTP Basic Auth 保護（密碼取自 QUEUE_UI_PASSWORD，未設定時回退 JWT secret）
// 另支援後台監控會話 cookie（由 /api/print/queueui-session 經 JWT 驗證後寫入），
// 供 PrintMonitor 內嵌 iframe 免 Basic Auth 彈窗。
function basicAuth (req, res, next) {
  const cookies = parseCookies(req.headers.cookie)
  if (cookies.queueui_auth === 'ok') return next()

  const user = process.env.QUEUE_UI_USER || 'admin'
  const pass = process.env.QUEUE_UI_PASSWORD || config.secretKey
  const auth = req.headers.authorization
  if (!auth) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Print Queue"')
    return res.status(401).send('需要驗證')
  }
  const parts = auth.split(' ')
  if (parts[0] !== 'Basic') {
    res.setHeader('WWW-Authenticate', 'Basic realm="Print Queue"')
    return res.status(401).send('需要驗證')
  }
  const decoded = Buffer.from(parts[1] || '', 'base64').toString('utf8')
  const idx = decoded.indexOf(':')
  const u = decoded.slice(0, idx)
  const p = decoded.slice(idx + 1)
  if (u === user && p === pass) return next()
  res.setHeader('WWW-Authenticate', 'Basic realm="Print Queue"')
  return res.status(401).send('帳號或密碼錯誤')
}

module.exports = {
  router: serverAdapter.getRouter(),
  basicAuth,
  registerQueue
}
