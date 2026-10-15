const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const net = require('net')

// 專案根目錄（server.js / config / models / plugins 等所在）
const APP_ROOT = path.join(__dirname, '..')

// 固定的 JWT / License secret（存放於 userData，跨重啟穩定，
// 避免每次重開導致 staff/admin 登出或授權簽名失效）
function ensureSecret (name) {
  const file = path.join(app.getPath('userData'), name)
  try {
    const v = fs.readFileSync(file, 'utf8').trim()
    if (v) return v
  } catch (e) { /* 不存在，首次啟動 */ }
  const secret = crypto.randomBytes(32).toString('hex')
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(file, secret, 'utf8')
  } catch (e) { /* 忽略寫入失敗，仍回傳本次 secret */ }
  return secret
}

// 穩定機器識別碼：Mac/Win 無 /etc/machine-id，故持久化於 userData，
// 作為授權 (license) 綁定的機器碼，避免 MAC 位址變動導致授權失效
function ensureMachineId () {
  const file = path.join(app.getPath('userData'), 'machine-id')
  try {
    const v = fs.readFileSync(file, 'utf8').trim()
    if (v) return v
  } catch (e) { /* 不存在，首次啟動 */ }
  const id = crypto.randomBytes(12).toString('hex').toUpperCase()
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(file, id, 'utf8')
  } catch (e) { /* 忽略寫入失敗 */ }
  return id
}

// 把隨 App 打包的 public/ 預設內容複製到 userData/public（可寫目錄），
// 已存在的檔案不覆寫，避免蓋掉使用者上傳的圖片/字型
function seedPublicDir () {
  const src = path.join(APP_ROOT, 'public')
  const dst = process.env.PUBLIC_DIR
  if (!src || !dst || !fs.existsSync(src)) return
  const walk = (from, to) => {
    fs.mkdirSync(to, { recursive: true })
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const s = path.join(from, entry.name)
      const d = path.join(to, entry.name)
      if (entry.isDirectory()) walk(s, d)
      else if (!fs.existsSync(d)) fs.copyFileSync(s, d)
    }
  }
  try { walk(src, dst) } catch (e) {
    console.error('[Electron] 初始化 public 目錄失敗：' + e.message)
  }
}

// 等待某 TCP 埠可用（用於等後端 HTTP 就緒）
function waitForPort (port, host, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ port, host })
      socket.once('connect', () => { socket.destroy(); resolve() })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() > deadline) {
          return reject(new Error(`等待 ${host}:${port} 逾時`))
        }
        setTimeout(attempt, 200)
      })
    }
    attempt()
  })
}

const serverPort = Number(process.env.PORT || 3000)

// 讀取 userData/app-config.json（若存在且格式正確），供啟動路徑/主機自訂
function readAppConfig () {
  const cfgFile = path.join(app.getPath('userData'), 'app-config.json')
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'))
    return (cfg && typeof cfg === 'object') ? cfg : {}
  } catch (e) { return {} }
}

// 合併寫入 userData/app-config.json，回傳寫入後的完整設定
function writeAppConfig (patch) {
  const cfgFile = path.join(app.getPath('userData'), 'app-config.json')
  const next = Object.assign({}, readAppConfig(), patch || {})
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(cfgFile, JSON.stringify(next, null, 2), 'utf8')
  } catch (e) {
    console.error('[Electron] 寫入 app-config.json 失敗：' + e.message)
  }
  return next
}

// 啟動路徑（登入後開啟的畫面）：優先取環境變數 APP_START_PATH，其次取
// app-config.json 的 startPath，最後預設 /pos（直接進 POS）
function getStartPath () {
  const env = process.env.APP_START_PATH
  if (env && env.trim()) return env.trim()
  const cfg = readAppConfig()
  if (cfg.startPath && String(cfg.startPath).trim()) return String(cfg.startPath).trim()
  return '/pos'
}

// 連線主機/IP：優先取環境變數 APP_START_HOST，其次取 app-config.json 的 host
//（或 ip），最後預設 127.0.0.1（本機後端）
function getStartHost () {
  const env = process.env.APP_START_HOST
  if (env && env.trim()) return env.trim()
  const cfg = readAppConfig()
  const host = cfg.host || cfg.ip
  if (host && String(host).trim()) return String(host).trim()
  return '127.0.0.1'
}

// 後端 HTTP 埠：優先取環境變數 PORT，其次取 app-config.json 的 port，預設 3000
function getStartPort () {
  const cfg = readAppConfig()
  const p = Number(cfg.port)
  if (p && Number.isInteger(p)) return p
  return serverPort
}

// 在 Electron 主程序內載入後端（server.js 會在 PostgreSQL 連上後才 listen）
function startServer () {
  // PostgreSQL：由 app-config.json 的 pgConn 或環境變數 PG_CONN 指定；
  // 未設定時沿用 config/config.js 的預設 pgConn
  const cfg = readAppConfig()
  if (!process.env.PG_CONN && cfg.pgConn && String(cfg.pgConn).trim()) {
    process.env.PG_CONN = String(cfg.pgConn).trim()
  }
  process.env.JWT_SECRET = ensureSecret('jwt.secret')
  process.env.MACHINE_ID = ensureMachineId()
  process.env.PUBLIC_DIR = path.join(app.getPath('userData'), 'public')
  process.env.PORT = String(getStartPort())
  // 授權：桌面版強制驗證，授權碼寫入 userData/license.key（經啟用頁啟用）
  process.env.LICENSE_FILE = path.join(app.getPath('userData'), 'license.key')
  process.env.LICENSE_ENFORCE = '1'
  // 廠商登入密碼（分機授權管理）：存於 userData/vendor.key
  process.env.VENDOR_FILE = path.join(app.getPath('userData'), 'vendor.key')

  seedPublicDir()

  // 讓後端內依賴 cwd 的相對路徑正確解析（安全網）
  process.chdir(APP_ROOT)
  require(path.join(APP_ROOT, 'server.js'))
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    title: 'orderSYS',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })
  const startPath = getStartPath()
  const startHost = getStartHost()
  const startPort = getStartPort()
  const startURL = `http://${startHost}:${startPort}${startPath}`
  console.log(`[Electron] 啟動位置：${startURL}`)
  win.loadURL(startURL)
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  // 連線失敗兜底：改錯 IP 後仍能回到設定（重設本機 / 重新載入）
  win.webContents.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (!isMainFrame) return
    const choice = dialog.showMessageBoxSync(win, {
      type: 'error',
      title: '連線失敗',
      message: `無法連線到 ${startURL}`,
      detail: `${desc} (${code})\n\n請確認伺服器 IP / 連接埠 / PostgreSQL 連線是否正確。`,
      buttons: ['重設為本機 (127.0.0.1)', '重新載入', '取消'],
      defaultId: 0,
      cancelId: 2
    })
    if (choice === 0) {
      writeAppConfig({ host: '127.0.0.1' })
      win.loadURL(`http://127.0.0.1:${startPort}${startPath}`)
    } else if (choice === 1) {
      win.reload()
    }
  })
  return win
}

// IPC：供前端（經 preload）讀取/寫入連線設定；寫入後重載視窗套用
function registerIpc () {
  ipcMain.handle('app-config:get', () => readAppConfig())
  ipcMain.handle('app-config:set', (e, patch) => {
    const cfg = writeAppConfig(patch && typeof patch === 'object' ? patch : {})
    const win = BrowserWindow.getFocusedWindow() || mainWindow
    const startPath = getStartPath()
    const startHost = getStartHost()
    const startPort = getStartPort()
    if (win) win.loadURL(`http://${startHost}:${startPort}${startPath}`)
    return cfg
  })
}

let mainWindow = null

app.whenReady().then(async () => {
  registerIpc()
  startServer()
  try {
    await waitForPort(getStartPort(), '127.0.0.1', 60000)
  } catch (e) {
    dialog.showErrorBox('啟動失敗', '後端伺服器未能啟動：' + e.message)
    app.quit()
    return
  }
  mainWindow = createWindow()
  mainWindow.on('closed', () => { mainWindow = null })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) mainWindow = createWindow()
})
