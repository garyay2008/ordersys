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

// 完整檢查：簽名 + 機器比對 + 到期日
function checkLicense (key, publicKey) {
  const parsed = parseLicense(key, publicKey)
  if (!parsed.valid) return parsed
  const p = parsed.payload || {}
  if (p.mid && p.mid !== getMachineId()) {
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

// 讀取授權碼：優先 LICENSE_KEY 環境變數，其次專案根目錄 license.key
function readLicenseKey () {
  if (process.env.LICENSE_KEY) return String(process.env.LICENSE_KEY).trim()
  const file = path.join(__dirname, '..', 'license.key')
  try {
    return fs.readFileSync(file, 'utf8').trim()
  } catch (e) {
    return ''
  }
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
  parseLicense,
  checkLicense,
  readLicenseKey,
  getLicenseStatus,
  maskKey
}
