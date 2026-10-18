const express = require('express')
const router = express.Router()
const passport = require('passport')
const jwt = require('jsonwebtoken')
const { secretKey } = require('../../config/config')
const { requireVendor } = require('../../middleware/auth')
const vendor = require('../../utils/vendor')
const license = require('../../utils/license')
const PosTerminal = require('../../models/PosTerminal')
const TerminalLicense = require('../../models/TerminalLicense')

// $route POST /api/vendor/login
// @desc 廠商登入（密碼存於 vendor.key / VENDOR_PASSWORD）
// @access public
router.post('/login', (req, res) => {
  const password = (req.body && req.body.password) || ''
  if (!vendor.hasVendorPassword()) {
    return res.status(403).json({ msg: '尚未設定廠商密碼（請在伺服器建立 vendor.key）' })
  }
  if (!vendor.verifyVendorPassword(password)) {
    return res.status(400).json({ msg: '廠商密碼錯誤' })
  }
  const rules = { id: 'vendor', kind: 'vendor' }
  jwt.sign(rules, secretKey, { expiresIn: 36000 }, (err, token) => {
    if (err) return res.status(500).json({ msg: '登入失敗' })
    res.json({ success: true, token: 'Bearer ' + token })
  })
})

// $route GET /api/vendor/terminals
// @desc 列出所有分機及其授權狀態
// @access vendor
router.get(
  '/terminals',
  passport.authenticate('jwt', { session: false }), requireVendor,
  async (req, res) => {
    try {
      const terminals = await PosTerminal.find().sort({ code: 1 }).lean().exec()
      const licenses = await TerminalLicense.find()
      const licMap = {}
      licenses.forEach(l => { licMap[l.code] = l })
      const result = terminals.map(t => {
        const l = licMap[t.code]
        let status = 'unlicensed'
        let payload = null
        let maskedKey = ''
        if (l) {
          const checked = license.checkTerminalLicense(l.key, license.getMachineId(), t.code)
          if (checked.valid) {
            status = 'licensed'
            payload = checked.payload || {}
            maskedKey = license.maskKey(l.key)
          } else {
            status = checked.reason === 'EXPIRED' ? 'expired' : 'invalid'
          }
        }
        return {
          code: t.code,
          name: t.name,
          type: t.type,
          enabled: t.enabled,
          location: t.location || '',
          status,
          maskedKey,
          customer: payload && payload.customer ? payload.customer : '',
          edition: payload && payload.edition ? payload.edition : '',
          expiresAt: payload && payload.exp ? payload.exp : null
        }
      })
      res.json(result)
    } catch (e) {
      console.log(e)
      res.status(500).json({ msg: '取得分機清單失敗' })
    }
  }
)

// $route POST /api/vendor/activate
// @desc 啟用分機授權（驗證授權碼並寫入資料庫）
// @access vendor
router.post(
  '/activate',
  passport.authenticate('jwt', { session: false }), requireVendor,
  async (req, res) => {
    const terminalCode = ((req.body && req.body.terminalCode) || '').trim()
    const key = (req.body && req.body.licenseKey) || ''
    if (!terminalCode) return res.status(400).json({ msg: '缺少收銀機編號' })
    if (!key) return res.status(400).json({ msg: '請輸入授權碼' })
    const result = license.checkTerminalLicense(key, license.getMachineId(), terminalCode)
    if (!result.valid) {
      return res.status(400).json({ msg: '授權碼無效', code: result.reason })
    }
    try {
      await TerminalLicense.findOneAndUpdate(
        { code: terminalCode },
        { $set: { key, activatedAt: new Date() } },
        { upsert: true, new: true }
      )
    } catch (e) {
      return res.status(500).json({ msg: '授權碼儲存失敗：' + e.message })
    }
    res.json({ msg: '分機授權成功', terminalCode })
  }
)

// $route POST /api/vendor/revoke
// @desc 撤銷分機授權（刪除授權記錄）
// @access vendor
router.post(
  '/revoke',
  passport.authenticate('jwt', { session: false }), requireVendor,
  async (req, res) => {
    const terminalCode = ((req.body && req.body.terminalCode) || '').trim()
    if (!terminalCode) return res.status(400).json({ msg: '缺少收銀機編號' })
    try {
      await TerminalLicense.findOneAndRemove({ code: terminalCode })
      res.json({ msg: '分機授權已撤銷', terminalCode })
    } catch (e) {
      res.status(500).json({ msg: '撤銷失敗' })
    }
  }
)

// $route POST /api/vendor/changePassword
// @desc 修改廠商密碼
// @access vendor
router.post(
  '/changePassword',
  passport.authenticate('jwt', { session: false }), requireVendor,
  (req, res) => {
    const password = (req.body && req.body.password) || ''
    if (!password || password.length < 6) {
      return res.status(400).json({ msg: '密碼長度至少 6 位' })
    }
    try {
      const file = vendor.saveVendorPassword(password)
      res.json({ msg: '廠商密碼已更新', file })
    } catch (e) {
      res.status(500).json({ msg: '密碼儲存失敗：' + e.message })
    }
  }
)

// $route GET /api/vendor/canGenerate
// @desc 查詢此機是否具備產生授權碼能力（私鑰存在才可）
// @access vendor
router.get(
  '/canGenerate',
  passport.authenticate('jwt', { session: false }), requireVendor,
  (req, res) => {
    res.json({ canGenerate: license.hasPrivateKey() })
  }
)

// $route POST /api/vendor/generate
// @desc 產生授權碼（僅私鑰存在的廠商端可操作）
// @access vendor
router.post(
  '/generate',
  passport.authenticate('jwt', { session: false }), requireVendor,
  (req, res) => {
    const privateKey = license.readPrivateKey()
    if (!privateKey) {
      return res.status(403).json({ msg: '此機未設定私鑰，無法產生授權碼（請在廠商端操作）' })
    }
    const mid = ((req.body && req.body.mid) || '').trim()
    if (!mid) {
      return res.status(400).json({ msg: '缺少機器識別碼／收銀機編號' })
    }
    const payload = {
      mid,
      customer: (req.body && req.body.customer) || '',
      edition: (req.body && req.body.edition) || 'full',
      features: Array.isArray(req.body && req.body.features) ? req.body.features : []
    }
    // 分機授權綁定客戶主機 machine_id，使授權碼跨餐廳唯一
    if ((req.body && req.body.edition) === 'terminal' && req.body && req.body.machineId) {
      payload.machineId = String(req.body.machineId).trim()
    }
    if (req.body && req.body.exp) payload.exp = req.body.exp
    const key = license.generateLicense(payload, privateKey)
    res.json({ licenseKey: key })
  }
)

module.exports = router
