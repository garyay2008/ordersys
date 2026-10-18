const crypto = require('crypto')
const os = require('os')
const fs = require('fs')
const path = require('path')

const PREFIX = 'ORDERSYS'

// 公鑰（客戶端驗證用，非機密）。可由 LICENSE_PUBLIC_KEY 環境變數覆寫。
// 私鑰僅保留在廠商端（tools/.license.private.key），切勿放入客戶映像。
const DEFAULT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAXMF/fuwaROYkENx57Y9L/SPwBe5ue6JmrImyG5AN/Xg=
-----END PUBLIC KEY-----`

function getPublicKey () {
  if (process.env.LICENSE_PUBLIC_KEY) return String(process.env.LICENSE_PUBLIC_KEY).trim()
  return DEFAULT_PUBLIC_KEY
}

// 取得機器識別碼：優先使用環境變數 MACHINE_ID（Docker 建議），
// 其次讀取 Linux 的 /etc/machine-id，最後才退回 MAC 位址。
function getMachineId () {
  if (process.env.MACHINE_ID) return String(process.env.MACHINE_ID).trim()
  try {
    const v = fs.readFileSync('/etc/machine-id', 'utf8').trim()
    if (v) return v
  } catch (e) { /* ignore */ }
  const nets = os.networkInterfaces()
  const macs = []
  Object.keys(nets).forEach(name => {
    ;(nets[name] || []).forEach(net => {
      if (net && !net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
        macs.push(net.mac.replace(/[:-]/g, '').toUpperCase())
      }
    })
  })
  return (macs.sort()[0] || 'NOMAC')
}

// 產生授權碼：ORDERSYS.<base64url(payload)>.<base64url(Ed25519 簽名)>
// 僅廠商端使用，需傳入私鑰（私鑰不落客戶機）。
function generateLicense (payload, privateKey) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.sign(null, Buffer.from(body), privateKey).toString('base64url')
  return `${PREFIX}.${body}.${sig}`
}

// 讀取廠商私鑰：優先 LICENSE_PRIVATE_KEY 環境變數，其次 tools/.license.private.key。
// 私鑰只存在廠商端；客戶機讀不到 → 回傳空字串，前端即可據此隱藏「產生授權碼」功能。
function readPrivateKey () {
  if (process.env.LICENSE_PRIVATE_KEY) return String(process.env.LICENSE_PRIVATE_KEY).trim()
  try {
    const v = fs.readFileSync(path.join(__dirname, '..', 'tools', '.license.private.key'), 'utf8').trim()
    if (v) return v
  } catch (e) { /* ignore */ }
  return ''
}

function hasPrivateKey () {
  return !!readPrivateKey()
}

// 解析並驗證簽名（客戶端，使用公鑰），回傳 { valid, reason, payload }
function parseLicense (key, publicKey) {
  if (!key) return { valid: false, reason: 'NO_LICENSE' }
  const parts = String(key).trim().split('.')
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    return { valid: false, reason: 'MALFORMED' }
  }
  const [, body, sig] = parts
  const pub = publicKey || getPublicKey()
  let ok = false
  try {
    ok = crypto.verify(null, Buffer.from(body), pub, Buffer.from(sig, 'base64url'))
  } catch (e) {
    ok = false
  }
  if (!ok) {
    return { valid: false, reason: 'SIGNATURE_MISMATCH' }
  }
  let payload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch (e) {
    return { valid: false, reason: 'MALFORMED' }
  }
  return { valid: true, payload }
}

// 完整檢查：簽名 + 指定 ID 比對 + 到期日（主機用 getMachineId，分機用收銀機編號）
function checkLicenseForId (key, id, publicKey) {
  const parsed = parseLicense(key, publicKey)
  if (!parsed.valid) return parsed
  const p = parsed.payload || {}
  if (p.mid && p.mid !== id) {
    return { valid: false, reason: 'MACHINE_MISMATCH', payload: p }
  }
  if (p.exp) {
    const t = new Date(p.exp).getTime()
    if (!isNaN(t) && t < Date.now()) {
      return { valid: false, reason: 'EXPIRED', payload: p }
    }
  }
  return parsed
}

// 分機授權檢查：綁定收銀機編號 + 主機機器識別碼（machine_id）
// machineId 為客戶主機的機器識別碼，使授權碼跨餐廳唯一；舊授權碼無 machineId 時僅依編號驗證（向後相容）
function checkTerminalLicense (key, machineId, terminalCode, publicKey) {
  const parsed = parseLicense(key, publicKey)
  if (!parsed.valid) return parsed
  const p = parsed.payload || {}
  if (p.mid && p.mid !== terminalCode) {
    return { valid: false, reason: 'MACHINE_MISMATCH', payload: p }
  }
  if (p.machineId && machineId && p.machineId !== machineId) {
    return { valid: false, reason: 'MACHINE_MISMATCH', payload: p }
  }
  if (p.exp) {
    const t = new Date(p.exp).getTime()
    if (!isNaN(t) && t < Date.now()) {
      return { valid: false, reason: 'EXPIRED', payload: p }
    }
  }
  return parsed
}

// 主機授權檢查：綁定本機機器識別碼
function checkLicense (key, publicKey) {
  return checkLicenseForId(key, getMachineId(), publicKey)
}

// 授權碼檔案路徑：可經 LICENSE_FILE 覆寫（桌面版指向 userData/license.key）
function licenseFilePath () {
  return process.env.LICENSE_FILE || path.join(__dirname, '..', 'license.key')
}

// 讀取授權碼：優先 LICENSE_KEY 環境變數，其次授權碼檔案
function readLicenseKey () {
  if (process.env.LICENSE_KEY) return String(process.env.LICENSE_KEY).trim()
  try {
    return fs.readFileSync(licenseFilePath(), 'utf8').trim()
  } catch (e) {
    return ''
  }
}

// 儲存授權碼（啟用流程）：寫入授權碼檔案，供下次讀取驗證
function saveLicenseKey (key) {
  const file = licenseFilePath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, String(key).trim(), 'utf8')
  return file
}

function maskKey (key) {
  const parts = String(key).split('.')
  if (parts.length !== 3) return '****'
  const [, body, sig] = parts
  return `${PREFIX}.${body.slice(0, 6)}...${body.slice(-4)}.${sig.slice(0, 4)}...`
}

// 目前授權狀態（供啟動日誌與 /api/license/status 使用）
function getLicenseStatus () {
  const key = readLicenseKey()
  const result = checkLicense(key)
  const p = result.payload || {}
  return {
    valid: result.valid,
    reason: result.reason,
    enforced: process.env.LICENSE_ENFORCE === '1',
    machineId: getMachineId(),
    maskedKey: key ? maskKey(key) : '',
    customer: p.customer || '',
    edition: p.edition || '',
    features: p.features || [],
    expiresAt: p.exp || null
  }
}

module.exports = {
  PREFIX,
  getMachineId,
  getPublicKey,
  generateLicense,
  readPrivateKey,
  hasPrivateKey,
  parseLicense,
  checkLicense,
  checkLicenseForId,
  checkTerminalLicense,
  readLicenseKey,
  saveLicenseKey,
  getLicenseStatus,
  maskKey
}
