const express = require('express')
const router = express.Router()
const passport = require('passport')
const cups = require('../../plugins/Cups')

// $route POST api/print
// @desc 列印 Raw ESC/POS 到 CUPS 佇列
// @access private
// body: { queue, data(base64 string | Buffer), jobName, copies }
router.post(
  '/',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const { queue, jobName, copies } = req.body
      let { data } = req.body
      if (!queue) return res.status(400).json({ error: 'queue required' })
      if (Buffer.isBuffer(data)) {
        // 已是 Buffer，直接使用
      } else if (typeof data === 'string') {
        data = Buffer.from(data, 'base64')
      } else {
        return res.status(400).json({ error: 'data required (base64 string or Buffer)' })
      }
      const result = await cups.printRaw(queue, data, { jobName, copies })
      res.json({ ok: true, ...result })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: e.message })
    }
  }
)

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

// $route GET api/print/queues
// @desc 列出 CUPS 上所有印表機佇列
// @access private
router.get(
  '/queues',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const printers = await cups.listPrinters()
      res.json({ ok: true, printers })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: e.message })
    }
  }
)

// $route POST api/print/queues
// @desc 建立 CUPS Raw 佇列（socket://IP:9100）
// @access private
// body: { name, ip, port }
router.post(
  '/queues',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const { name, ip, port } = req.body
      const result = await cups.addPrinter(name, ip, port || 9100)
      res.json({ ok: true, ...result })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: e.message })
    }
  }
)

// $route DELETE api/print/queues/:name
// @desc 刪除 CUPS 佇列
// @access private
router.delete(
  '/queues/:name',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      await cups.deletePrinter(req.params.name)
      res.json({ ok: true })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: e.message })
    }
  }
)

// $route GET api/print/jobs
// @desc 查詢 CUPS 佇列中的 Jobs（排隊中 / 已完成）
// @access private
// query: queue, which(not-completed | completed | all)
router.get(
  '/jobs',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const { queue, which } = req.query
      if (!queue) return res.status(400).json({ error: 'queue required' })
      const jobs = await cups.listJobs(queue, which || 'all')
      res.json({ ok: true, jobs })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: e.message })
    }
  }
)

// $route POST api/print/jobs/:id/cancel
// @desc 取消卡住的列印 Job
// @access private
// body: { queue }
router.post(
  '/jobs/:id/cancel',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const { queue } = req.body
      if (!queue) return res.status(400).json({ error: 'queue required' })
      await cups.cancelJob(queue, req.params.id)
      res.json({ ok: true, jobId: req.params.id })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: e.message })
    }
  }
)

module.exports = router
