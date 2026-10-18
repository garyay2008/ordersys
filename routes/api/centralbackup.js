const express = require('express')
const router = express.Router()
const passport = require('passport')
const { requireLevel } = require('../../middleware/auth')
const centralBackup = require('../../utils/centralBackup')

// $route GET api/centralbackup/config
// @desc 取得中央備份上傳設定
// @access private (level 4)
router.get('/config', passport.authenticate('jwt', { session: false }), requireLevel(4), (req, res) => {
  res.json(centralBackup.getConfig())
})

// $route POST api/centralbackup/config
// @desc 儲存中央備份上傳設定
// @access private (level 4)
router.post('/config', passport.authenticate('jwt', { session: false }), requireLevel(4), (req, res) => {
  try {
    const cfg = centralBackup.saveConfig(req.body || {})
    res.json({ msg: '中央備份設定已儲存', config: cfg })
  } catch (e) {
    res.status(500).json({ msg: '儲存失敗：' + e.message })
  }
})

// $route GET api/centralbackup/status
// @desc 取得最近一次上傳結果
// @access private (level 4)
router.get('/status', passport.authenticate('jwt', { session: false }), requireLevel(4), (req, res) => {
  res.json(centralBackup.getStatus())
})

// $route POST api/centralbackup/run
// @desc 立即執行一次備份並上傳
// @access private (level 4)
router.post('/run', passport.authenticate('jwt', { session: false }), requireLevel(4), async (req, res) => {
  try {
    const result = await centralBackup.runNow('manual')
    res.json({ msg: '備份上傳成功', result })
  } catch (e) {
    res.status(500).json({ msg: '備份上傳失敗：' + e.message })
  }
})

// $route GET api/centralbackup/sshkey
// @desc 取得本機 SSH 公鑰（供複製到中央後台註冊分店）
// @access private (level 4)
router.get('/sshkey', passport.authenticate('jwt', { session: false }), requireLevel(4), (req, res) => {
  res.json(centralBackup.getSshPublicKey())
})

module.exports = router
