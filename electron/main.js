const { app, BrowserWindow, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const net = require('net')
const { spawn } = require('child_process')

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

// 等待某 TCP 埠可用（用於等 mongod / 後端 HTTP 就緒）
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

// 尋找捆綁的 mongod 二進位（開發期在專案根 mongodb/，打包後在 resources/mongodb/）
function findMongod () {
  const name = process.platform === 'win32' ? 'mongod.exe' : 'mongod'
  const candidates = [
    path.join(APP_ROOT, 'mongodb', name),
    path.join(process.resourcesPath, 'mongodb', name)
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return null
}

let mongodProc = null
const mongoPort = Number(process.env.MONGO_PORT || 27017)
const serverPort = Number(process.env.PORT || 3000)

// 啟動捆綁的 mongod；未捆綁時回傳 null，交由外部 MongoDB 連線
async function startMongod () {
  const bin = findMongod()
  if (!bin) {
    console.log('[Electron] 未找到捆綁的 mongod，改用外部 MongoDB（MONGO_URI）')
    return null
  }
  const dbPath = path.join(app.getPath('userData'), 'data', 'db')
  fs.mkdirSync(dbPath, { recursive: true })
  console.log(`[Electron] 啟動 mongod（dbpath=${dbPath}, port=${mongoPort}）`)
  mongodProc = spawn(bin, [
    '--dbpath', dbPath,
    '--port', String(mongoPort),
    '--bind_ip', '127.0.0.1',
    '--quiet'
  ], { stdio: 'ignore' })
  mongodProc.on('error', (e) => console.error('[Electron] mongod 啟動失敗：' + e.message))
  mongodProc.on('exit', (code) => console.log(`[Electron] mongod 已退出 code=${code}`))
  await waitForPort(mongoPort, '127.0.0.1', 30000)
  return mongodProc
}

// 在 Electron 主程序內載入後端（server.js 會在 MongoDB 連上後才 listen）
function startServer () {
  if (mongodProc) {
    process.env.MONGO_URI = `mongodb://127.0.0.1:${mongoPort}/orderSYS`
  } else if (!process.env.MONGO_URI) {
    process.env.MONGO_URI = `mongodb://127.0.0.1:${mongoPort}/orderSYS`
  }
  process.env.JWT_SECRET = ensureSecret('jwt.secret')
  process.env.LICENSE_SECRET = ensureSecret('license.secret')
  process.env.MACHINE_ID = ensureMachineId()
  process.env.PUBLIC_DIR = path.join(app.getPath('userData'), 'public')
  process.env.PORT = String(serverPort)

  seedPublicDir()

  // 讓後端內依賴 cwd 的相對路徑正確解析（安全網）
  process.chdir(APP_ROOT)
  require(path.join(APP_ROOT, 'server.js'))
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'orderSYS',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  win.loadURL(`http://127.0.0.1:${serverPort}/`)
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  return win
}

let mainWindow = null

app.whenReady().then(async () => {
  try {
    await startMongod()
  } catch (e) {
    console.error('[Electron] MongoDB 啟動失敗：' + e.message)
  }
  startServer()
  try {
    await waitForPort(serverPort, '127.0.0.1', 60000)
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

app.on('will-quit', () => {
  if (mongodProc) {
    try { mongodProc.kill() } catch (e) {}
  }
})
