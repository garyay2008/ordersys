const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFile } = require('child_process')
const http = require('http')
const https = require('https')
const moment = require('moment')
const config = require('../config/config')

// 中央備份上傳（方案 C）：由 orderSYS 應用程式本身定期/手動執行 pg_dump 並上傳到中央儀表板。
// 設定優先序：環境變數 > 後台儲存的 central-backup.json > 預設值。

const CONFIG_FILE = path.join(config.publicDir, 'central-backup.json')
const STATUS_FILE = path.join(config.publicDir, 'central-backup-status.json')

const DEFAULT_CONFIG = {
  enabled: false,
  url: '',        // 中央上傳端點，例如 http://10.8.0.1:888/api/upload 或 https://central/api/upload
  branchId: '',   // 分店 ID，對應中央 /backups/<branchId>/ 與 branch_<branchId> 資料庫
  key: '',        // 與中央 UPLOAD_KEY 相同的共享金鑰
  time: '03:30'   // 每日自動上傳時間（HH:mm）
}

let currentConfig = null
let lastStatus = null
let schedulerTimer = null
let lastScheduledDate = ''
let running = false

function readJSON (file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    return fallback
  }
}

function writeJSON (file, obj) {
  try {
    fs.mkdirSync(config.publicDir, { recursive: true })
    fs.writeFileSync(file, JSON.stringify(obj, null, 2))
  } catch (e) {
    console.error('[CentralBackup] 寫入設定檔失敗：' + e.message)
  }
}

function normalizeConfig (cfg) {
  cfg.url = String(cfg.url || '').trim()
  cfg.branchId = String(cfg.branchId || '').trim()
  cfg.key = String(cfg.key || '').trim()
  cfg.time = String(cfg.time || '').trim()
  return cfg
}

function getConfig () {
  if (currentConfig) return currentConfig
  const fileCfg = readJSON(CONFIG_FILE, {})
  currentConfig = Object.assign({}, DEFAULT_CONFIG, fileCfg)
  // 環境變數優先（部署時可用來覆寫）
  if (process.env.CENTRAL_UPLOAD_URL) currentConfig.url = process.env.CENTRAL_UPLOAD_URL
  if (process.env.BRANCH_ID) currentConfig.branchId = process.env.BRANCH_ID
  if (process.env.CENTRAL_UPLOAD_KEY) currentConfig.key = process.env.CENTRAL_UPLOAD_KEY
  if (process.env.CENTRAL_UPLOAD_TIME) currentConfig.time = process.env.CENTRAL_UPLOAD_TIME
  if (process.env.CENTRAL_UPLOAD_ENABLED === '1') currentConfig.enabled = true
  if (process.env.CENTRAL_UPLOAD_ENABLED === '0') currentConfig.enabled = false
  return normalizeConfig(currentConfig)
}

function saveConfig (cfg) {
  currentConfig = Object.assign({}, DEFAULT_CONFIG, cfg)
  normalizeConfig(currentConfig)
  writeJSON(CONFIG_FILE, currentConfig)
  return currentConfig
}

function getStatus () {
  if (lastStatus) return lastStatus
  lastStatus = readJSON(STATUS_FILE, null)
  return lastStatus
}

function setStatus (st) {
  lastStatus = st
  writeJSON(STATUS_FILE, st)
}

function parseConn (connStr) {
  const u = new URL(connStr)
  return {
    host: u.hostname || '127.0.0.1',
    port: u.port || '5432',
    user: decodeURIComponent(u.username || ''),
    password: decodeURIComponent(u.password || ''),
    database: (u.pathname || '/').slice(1) || 'ordersys'
  }
}

function pgDump (conn) {
  return new Promise((resolve, reject) => {
    const file = path.join(os.tmpdir(), `ordersys_${moment().format('YYYYMMDD_HHmmss')}_${process.pid}.dump`)
    const args = ['-Fc', '--no-owner', '--no-privileges',
      '-h', conn.host, '-p', conn.port, '-U', conn.user, '-d', conn.database, '-f', file]
    execFile('pg_dump', args, {
      env: Object.assign({}, process.env, { PGPASSWORD: conn.password }),
      maxBuffer: 1024 * 1024 * 1024
    }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || err.message).trim()))
      resolve(file)
    })
  })
}

function upload (cfg, filePath) {
  return new Promise((resolve, reject) => {
    let stat
    try {
      stat = fs.statSync(filePath)
    } catch (e) {
      return reject(new Error('備份檔不存在：' + e.message))
    }
    let u
    try {
      u = new URL(cfg.url)
    } catch (e) {
      return reject(new Error('中央上傳 URL 無效'))
    }
    const mod = u.protocol === 'https:' ? https : http
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': stat.size,
        'X-Upload-Key': cfg.key || '',
        'X-Branch-Id': cfg.branchId || '',
        'X-Filename': path.basename(filePath)
      },
      rejectUnauthorized: false
    }, (res) => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data || 'ok')
        else reject(new Error(`HTTP ${res.statusCode}: ${data}`))
      })
    })
    req.on('error', reject)
    fs.createReadStream(filePath).pipe(req)
  })
}

async function runNow (reason) {
  if (running) throw new Error('已有備份上傳正在進行中')
  running = true
  let file = null
  try {
    const cfg = getConfig()
    if (!cfg.enabled || !cfg.url || !cfg.branchId) {
      const err = new Error('中央備份尚未啟用或未設定（URL / 分店 ID）')
      setStatus({ ok: false, error: err.message, at: new Date().toISOString(), reason: reason || 'manual' })
      throw err
    }
    const conn = parseConn(config.pgConn)
    file = await pgDump(conn)
    const response = await upload(cfg, file)
    const st = {
      ok: true,
      at: new Date().toISOString(),
      reason: reason || 'manual',
      branchId: cfg.branchId,
      filename: path.basename(file),
      bytes: fs.statSync(file).size,
      response: response || 'ok'
    }
    setStatus(st)
    console.log(`[CentralBackup] 上傳成功 ${st.filename} (${st.bytes} bytes)`)
    return st
  } catch (e) {
    const st = { ok: false, error: e.message, at: new Date().toISOString(), reason: reason || 'manual' }
    setStatus(st)
    console.error('[CentralBackup] 上傳失敗：' + e.message)
    throw e
  } finally {
    if (file && fs.existsSync(file)) {
      try { fs.unlinkSync(file) } catch (e) {}
    }
    running = false
  }
}

function startScheduler () {
  stopScheduler()
  schedulerTimer = setInterval(() => {
    const cfg = getConfig()
    if (!cfg.enabled || !cfg.url || !cfg.branchId) return
    const now = moment()
    const today = now.format('YYYY-MM-DD')
    if (now.format('HH:mm') === (cfg.time || DEFAULT_CONFIG.time) && lastScheduledDate !== today) {
      lastScheduledDate = today
      runNow('scheduled').catch(() => {})
    }
  }, 60 * 1000)
  if (schedulerTimer.unref) schedulerTimer.unref()
}

function stopScheduler () {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
}

function getSshPublicKey () {
  const home = os.homedir()
  const candidates = []
  if (process.env.SSH_KEY) {
    candidates.push(process.env.SSH_KEY.replace(/\.pub$/, '') + '.pub')
  }
  candidates.push(
    path.join(home, '.ssh', 'id_ed25519.pub'),
    path.join(home, '.ssh', 'id_rsa.pub'),
    path.join(home, '.ssh', 'id_ecdsa.pub')
  )
  for (const p of candidates) {
    try {
      const content = fs.readFileSync(p, 'utf8').trim()
      if (content) return { key: content, path: p, found: true }
    } catch (e) {}
  }
  return { key: '', path: '', found: false }
}

module.exports = { getConfig, saveConfig, getStatus, runNow, startScheduler, stopScheduler, getSshPublicKey }
