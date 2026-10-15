const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')

// 廠商（vendor）登入密碼：與餐廳管理員帳號徹底隔離，僅廠商可登入做分機授權。
// 密碼以 bcrypt 雜湊存於檔案（VENDOR_FILE，桌面版指向 userData/vendor.key），
// 或經 VENDOR_PASSWORD 環境變數提供明文（Docker / 伺服器版）。
function vendorFilePath () {
  return process.env.VENDOR_FILE || path.join(__dirname, '..', 'vendor.key')
}

function readVendorHash () {
  try {
    return fs.readFileSync(vendorFilePath(), 'utf8').trim()
  } catch (e) {
    return ''
  }
}

function hasVendorPassword () {
  return !!(process.env.VENDOR_PASSWORD || readVendorHash())
}

function verifyVendorPassword (input) {
  if (!input) return false
  const envPwd = process.env.VENDOR_PASSWORD
  if (envPwd) {
    const a = Buffer.from(String(input))
    const b = Buffer.from(String(envPwd))
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  }
  const hash = readVendorHash()
  if (!hash) return false
  return bcrypt.compareSync(String(input), hash)
}

function saveVendorPassword (input) {
  const file = vendorFilePath()
  const hash = bcrypt.hashSync(String(input), 10)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, hash, 'utf8')
  return file
}

module.exports = {
  vendorFilePath,
  readVendorHash,
  hasVendorPassword,
  verifyVendorPassword,
  saveVendorPassword
}
