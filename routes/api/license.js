const express = require('express')
const router = express.Router()
const license = require('../../utils/license')

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

// 機器識別碼（供啟用頁顯示，向廠商索取授權碼時提供）
router.get('/machineid', (req, res) => {
  res.json({ machineId: license.getMachineId() })
})

module.exports = router
