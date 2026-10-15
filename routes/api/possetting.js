const express = require('express')
const router = express.Router()
const passport = require('passport')
const fs = require('fs')
const path = require('path')
const formidable = require('formidable')
const PosSetting = require('../../models/PosSetting')
const { DEFAULT_BTN_PERMS } = require('../../models/PosSetting')
const socketio = require('../../plugins/SocketIO')
const config = require('../../config/config')

// $route GET api/possetting/get
// @desc 获取 POS 设置（含各按钮最低权限等级）
// @access public（前台 POS 也要读）
router.get('/get', (req, res) => {
  PosSetting.findOne()
    .then(result => {
      const data = result ? result.toObject() : { serviceChargeEnabled: false, serviceChargeRate: 10 }
      // 合併默认权限
      data.btnPerms = Object.assign({}, DEFAULT_BTN_PERMS, (result && result.btnPerms) || {})
      if (!data.posBtnSettings) {
        data.posBtnSettings = { fontSize: 18, width: 60, rowsPerPage: 2, perRow: 8 }
      } else {
        if (data.posBtnSettings.perRow == null) data.posBtnSettings.perRow = 8
        if (data.posBtnSettings.rowsPerPage == null) data.posBtnSettings.rowsPerPage = 2
      }
      if (!data.catBtnSettings) {
        data.catBtnSettings = { fontSize: 13, width: 0, height: 40, padding: 20, paddingY: 0, gapX: 10, gapY: 10, cols: 4, rows: 6 }
      } else {
        if (data.catBtnSettings.fontSize == null) data.catBtnSettings.fontSize = 13
        if (data.catBtnSettings.width == null) data.catBtnSettings.width = 0
        if (data.catBtnSettings.height == null) data.catBtnSettings.height = 40
        if (data.catBtnSettings.padding == null) data.catBtnSettings.padding = 20
        if (data.catBtnSettings.paddingY == null) data.catBtnSettings.paddingY = 0
        if (data.catBtnSettings.gapX == null) data.catBtnSettings.gapX = 10
        if (data.catBtnSettings.gapY == null) data.catBtnSettings.gapY = 10
        if (data.catBtnSettings.cols == null) data.catBtnSettings.cols = 4
        if (data.catBtnSettings.rows == null) data.catBtnSettings.rows = 6
      }
      if (!data.foodBtnSettings) {
        data.foodBtnSettings = { cols: 0, rows: 0, fontSize: 25, width: 0, height: 0, minHeight: 88, imageSize: 40, paddingX: 3, paddingY: 6, gapX: 6, gapY: 6, showPlu: true, showPrice: true, showStock: true }
      } else {
        if (data.foodBtnSettings.cols == null) data.foodBtnSettings.cols = 0
        if (data.foodBtnSettings.rows == null) data.foodBtnSettings.rows = 0
        if (data.foodBtnSettings.fontSize == null) data.foodBtnSettings.fontSize = 25
        if (data.foodBtnSettings.width == null) data.foodBtnSettings.width = 0
        if (data.foodBtnSettings.height == null) data.foodBtnSettings.height = 0
        if (data.foodBtnSettings.minHeight == null) data.foodBtnSettings.minHeight = 88
        if (data.foodBtnSettings.imageSize == null) data.foodBtnSettings.imageSize = 40
        if (data.foodBtnSettings.paddingX == null) data.foodBtnSettings.paddingX = 3
        if (data.foodBtnSettings.paddingY == null) data.foodBtnSettings.paddingY = 6
        if (data.foodBtnSettings.gapX == null) data.foodBtnSettings.gapX = 6
        if (data.foodBtnSettings.gapY == null) data.foodBtnSettings.gapY = 6
        if (data.foodBtnSettings.showPlu == null) data.foodBtnSettings.showPlu = true
        if (data.foodBtnSettings.showPrice == null) data.foodBtnSettings.showPrice = true
        if (data.foodBtnSettings.showStock == null) data.foodBtnSettings.showStock = true
      }
      if (!data.sidebarSettings || !Object.keys(data.sidebarSettings).length) {
        data.sidebarSettings = { fontSize: 12, width: 130 }
      }
      if (!data.calledTagStyle) {
        data.calledTagStyle = { color: '#ea580c', background: '#ffedd5', border: '#fed7aa' }
      }
      if (!data.boardLayout || !Object.keys(data.boardLayout).length) {
        data.boardLayout = { cardHeight: 110, cardWidth: 0, gridCols: 0, gridRows: 0, gap: 10 }
      }
      if (!data.managerMenu || !data.managerMenu.length) {
        data.managerMenu = [
          { funcCode: '18', visible: true },
          { funcCode: '17', visible: true },
          { funcCode: '44', visible: true },
          { funcCode: '43', visible: true },
          { funcCode: '49', visible: true },
          { funcCode: '56', visible: true }
        ]
      } else {
        if (!data.managerMenu.some(m => String(m.funcCode) === '44')) {
          data.managerMenu.push({ funcCode: '44', visible: true })
        }
        if (!data.managerMenu.some(m => String(m.funcCode) === '49')) {
          data.managerMenu.push({ funcCode: '49', visible: true })
        }
        if (!data.managerMenu.some(m => String(m.funcCode) === '56')) {
          data.managerMenu.push({ funcCode: '56', visible: true })
        }
      }
      if (!data.sideQtyMode) {
        data.sideQtyMode = 'pending'
      }
      if (!data.modCodeUIMode) {
        data.modCodeUIMode = 'A'
      }
      if (!Array.isArray(data.categoryOrder)) {
        data.categoryOrder = []
      }
      if (!Array.isArray(data.qrCategoryOrder)) {
        data.qrCategoryOrder = []
      }
      if (data.reprintMinLevel == null) {
        data.reprintMinLevel = 3
      }
      if (data.dineInPrintCopies == null) {
        data.dineInPrintCopies = 1
      }
      if (data.takeawayPrintCopies == null) {
        data.takeawayPrintCopies = 1
      }
      if (!data.jumpPriceRules) {
        data.jumpPriceRules = []
      }
      if (data.jumpPriceEnabled == null) {
        data.jumpPriceEnabled = true
      }
      if (data.teaChargesRequired == null) {
        data.teaChargesRequired = false
      }
      if (data.requiredCategoryId == null) {
        data.requiredCategoryId = ''
      }
      if (data.teaSeatSyncPax == null) {
        data.teaSeatSyncPax = false
      }
      if (data.servingNewItemsOnly == null) {
        data.servingNewItemsOnly = false
      }
      if (data.comboNameOnce == null) {
        data.comboNameOnce = false
      }
      if (data.failoverNotify == null) {
        data.failoverNotify = true
      }
      if (data.failoverTimeout == null) {
        data.failoverTimeout = 45
      }
      if (data.soldOutDailyReset == null) {
        data.soldOutDailyReset = false
      }
      if (!data.cancelItemPrint) {
        data.cancelItemPrint = { kitchen: true, workstation: false }
      }
      if (!data.cancelAllPrint) {
        data.cancelAllPrint = { kitchen: true }
      }
      if (!data.sidebarButtons || !data.sidebarButtons.length) {
        data.sidebarButtons = [
          { id: 'grid', label: '枱號圖', funcCode: '23', visible: true, bgColor: '', textColor: '' },
          { id: 'takeaway', label: '外賣枱', funcCode: '24', visible: true, bgColor: '', textColor: '' },
          { id: 'dineIn', label: '堂食', funcCode: '25', visible: true, bgColor: '', textColor: '' },
          { id: 'delivery', label: '外賣', funcCode: '57', visible: true, bgColor: '', textColor: '' },
          { id: 'list', label: '查看單據', funcCode: '26', visible: true, bgColor: '', textColor: '' },
          { id: 'search', label: '搜尋編號', funcCode: '27', visible: true, bgColor: '', textColor: '' },
          { id: 'history', label: '往日單據', funcCode: '28', visible: true, bgColor: '', textColor: '' },
          { id: 'refresh', label: '重新整理', funcCode: '29', visible: true, bgColor: '', textColor: '' },
          { id: 'addTable', label: '快速開枱', funcCode: '30', visible: true, bgColor: '', textColor: '' },
          { id: 'batchPrint', label: '批量列印', funcCode: '31', visible: true, bgColor: '', textColor: '' },
          { id: 'report', label: '報表', funcCode: '32', visible: true, bgColor: '', textColor: '' },
          { id: 'settings', label: '經理功能', funcCode: '33', visible: true, bgColor: '', textColor: '' }
        ]
      } else {
        var sbMap = {}
        data.sidebarButtons.forEach(function (b) { sbMap[b.id] = b })
        var sbIds = ['grid', 'takeaway', 'dineIn', 'delivery', 'list', 'search', 'history', 'refresh', 'addTable', 'batchPrint', 'report', 'settings']
        var sbLabels = { grid: '枱號圖', takeaway: '外賣枱', dineIn: '堂食', delivery: '外賣', list: '查看單據', search: '搜尋編號', history: '往日單據', refresh: '重新整理', addTable: '快速開枱', batchPrint: '批量列印', report: '報表', settings: '經理功能' }
        var sbDefaultFc = { grid: '23', takeaway: '24', dineIn: '25', delivery: '57', list: '26', search: '27', history: '28', refresh: '29', addTable: '30', batchPrint: '31', report: '32', settings: '33' }
        data.sidebarButtons = sbIds.map(function (id) {
          var saved = sbMap[id] || {}
          return { id: id, label: saved.label || sbLabels[id], funcCode: saved.funcCode || sbDefaultFc[id], visible: saved.visible !== false, bgColor: saved.bgColor || '', textColor: saved.textColor || '' }
        })
      }
      res.json(data)
    })
    .catch(err => {
      console.log(err)
      res.json({ serviceChargeEnabled: false, serviceChargeRate: 10, btnPerms: DEFAULT_BTN_PERMS })
    })
})

// $route POST api/possetting/save
// @desc 保存 POS 设置
// @access private
router.post(
  '/save',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const data = req.body
      delete data._id
      const count = await PosSetting.countDocuments().exec()
      if (count === 0) {
        await PosSetting.create(data)
      } else {
        await PosSetting.findOneAndUpdate({}, { $set: data }).exec()
      }
      // 更新列印相關 PosSetting 快取（外賣枱枱號範圍等同步票據欄位）
      try {
        const updated = await PosSetting.findOne().lean().exec()
        require('../../plugins/Printer').setPosSettingCache(updated)
      } catch (e) {}
      res.send('POS 設置保存成功！')
      try {
        const io = socketio.getIO()
        if (io) {
          io.emit('posSettingChanged')
          // 跳價規則／公眾假期／分市時間會影響菜單價格，儲存後通知前台重載菜單
          if (data.jumpPriceRules !== undefined || data.publicHolidays !== undefined || data.slots !== undefined || data.jumpPriceEnabled !== undefined) {
            io.emit('menuChanged')
          }
        }
      } catch (e) {}
    } catch (err) {
      console.log(err)
      res.status(400).send('保存失敗，請重試！')
    }
  }
)

// $route POST api/possetting/uploadfont
// @desc 上傳 POS 自訂字型檔（ttf/otf/woff/woff2）
// @access private
router.post(
  '/uploadfont',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    const uploadDir = path.join(config.publicDir, 'fonts', 'uploaded')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    const form = new formidable.IncomingForm()
    form.uploadDir = uploadDir
    form.keepExtensions = true
    form.parse(req, (err, fields, files) => {
      if (err) {
        console.log(err)
        return res.status(400).send('上傳失敗，請重試！')
      }
      const file = files.file
      if (!file) {
        return res.status(400).send('未收到字型檔！')
      }
      const ext = path.extname(file.name || '').toLowerCase()
      if (['.ttf', '.otf', '.woff', '.woff2'].indexOf(ext) < 0) {
        return res.status(400).send('只支援 ttf / otf / woff / woff2 字型檔！')
      }
      const base = (fields && fields.name) || 'posfont'
      const safe = String(base).replace(/[^\w\u4e00-\u9fa5-]/g, '_')
      const finalName = `${Date.now()}_${safe}${ext}`
      fs.rename(file.path, path.join(uploadDir, finalName), renameErr => {
        if (renameErr) {
          console.log(renameErr)
          return res.status(400).send('上傳失敗，請重試！')
        }
        const url = `/fonts/uploaded/${finalName}`
        res.json({ status: 'ok', url })
      })
    })
  }
)

module.exports = router
