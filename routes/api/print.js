const express = require('express')
const router = express.Router()
const passport = require('passport')

// $route POST api/print/queueui-session
// @desc 建立 Bull Board 監控會話（經 JWT 驗證後寫入 cookie，供 PrintMonitor 內嵌 iframe 免 Basic Auth）
// @access private
router.post(
  '/queueui-session',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    res.cookie('queueui_auth', 'ok', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/'
    })
    res.json({ ok: true })
  }
)

module.exports = router
