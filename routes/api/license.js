const express = require('express')
const router = express.Router()
const license = require('../../utils/license')
const TerminalLicense = require('../../models/TerminalLicense')

// 授權啟用：驗證授權碼並寫入檔案（LICENSE_ENFORCE 下豁免，見 server.js）
router.post('/activate', (req, res) => {
  const key = (req.body && req.body.licenseKey) || ''
  if (!key) {
    return res.status(400).json({ msg: '請輸入授權碼' })
  }
  const result = license.checkLicense(key)
  if (!result.valid) {
    return res.status(400).json({ msg: '授權碼無效', code: result.reason })
  }
  try {
    license.saveLicenseKey(key)
  } catch (e) {
    return res.status(500).json({ msg: '授權碼儲存失敗：' + e.message })
  }
  res.json({ msg: '授權成功', machineId: license.getMachineId() })
})

// 分機授權啟用：驗證授權碼（綁定收銀機編號）並存入資料庫
router.post('/activate-terminal', async (req, res) => {
  const terminalCode = ((req.body && req.body.terminalCode) || '').trim()
  const key = (req.body && req.body.licenseKey) || ''
  if (!terminalCode) {
    return res.status(400).json({ msg: '缺少收銀機編號' })
  }
  if (!key) {
    return res.status(400).json({ msg: '請輸入授權碼' })
  }
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
})

// 分機授權狀態查詢（供啟用頁/前端判斷是否導向啟用頁）
router.get('/terminal-status', async (req, res) => {
  const code = ((req.query && req.query.code) || '').trim()
  if (!code) {
    return res.json({ licensed: false })
  }
  try {
    const doc = await TerminalLicense.findOne({ code })
    const licensed = !!(doc && license.checkTerminalLicense(doc.key, license.getMachineId(), code).valid)
    res.json({ licensed, code, machineId: license.getMachineId() })
  } catch (e) {
    res.json({ licensed: false, code })
  }
})

// 機器識別碼（供啟用頁顯示，向廠商索取授權碼時提供）
router.get('/machineid', (req, res) => {
  res.json({ machineId: license.getMachineId() })
})

module.exports = router
