const express = require('express')
const router = express.Router()
const passport = require('passport')
const KioskSetting = require('../../models/KioskSetting')
const Order = require('../../models/Order')
const Printer = require('../../models/Printer')
const escpos = require('../../plugins/Printer')
const printQueue = require('../../plugins/printQueue')
const io = require('../../plugins/SocketIO').getIO()

const DEFAULTS = {
  paymentMethods: ['八達通', '行動支付'],
  fpsQrImage: '',
  showImages: true,
  terminalCode: '',
  dineIn: true,
  takeaway: true,
  payByOrderNo: true
}

// $route GET api/kiosk/setting
// @desc 取得自助機設定
// @access public（自助機免登入）
router.get('/setting', (req, res) => {
  KioskSetting.findOne()
    .then(result => {
      res.json(Object.assign({}, DEFAULTS, result ? result.toObject() : {}))
    })
    .catch(err => {
      console.log(err)
      res.json(DEFAULTS)
    })
})

// $route POST api/kiosk/setting/save
// @desc 保存自助機設定（單例 upsert）
// @access private
router.post(
  '/setting/save',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const data = req.body || {}
      delete data._id
      delete data.date
      if (!Array.isArray(data.paymentMethods)) data.paymentMethods = DEFAULTS.paymentMethods
      const count = await KioskSetting.countDocuments().exec()
      if (count === 0) {
        await KioskSetting.create(data)
      } else {
        await KioskSetting.findOneAndUpdate({}, { $set: data }).exec()
      }
      res.send('自助機設定保存成功！')
    } catch (err) {
      console.log(err)
      res.status(400).send('保存失敗，請重試！')
    }
  }
)

// $route GET api/kiosk/order/:orderNo
// @desc 依單號查詢未結訂單（查單付款用）
// @access public
router.get('/order/:orderNo', async (req, res) => {
  try {
    const orderNo = String(req.params.orderNo || '').trim()
    if (!orderNo) return res.json(null)
    const order = await Order.findOne({ orderNo }).lean().exec()
    if (!order) return res.json(null)
    res.json({
      orderNo: order.orderNo,
      deskNo: order.deskNo,
      zone: order.zone,
      order: order.order,
      totalPrice: order.totalPrice,
      state: order.state,
      payMethod: order.payMethod || '',
      date: order.date
    })
  } catch (err) {
    console.log(err)
    res.json(null)
  }
})

// $route POST api/kiosk/pay
// @desc 自助付款：將未結訂單結帳並印客戶收據
// @access public（自助機免登入）
router.post('/pay', async (req, res) => {
  try {
    const orderNo = String(req.body.orderNo || '').trim()
    const payMethod = req.body.payMethod || ''
    if (!orderNo) return res.status(400).send('缺少訂單編號')
    if (!payMethod) return res.status(400).send('請選擇付款方式')
    const order = await Order.findOne({ orderNo }).exec()
    if (!order) return res.status(400).send('找不到該訂單')
    if (order.state === 1) return res.status(400).send('該訂單已付款')
    order.state = 1
    order.payMethod = payMethod
    await order.save()
    // 印客戶收據（有設定收據打印機才印）
    try {
      const setting = await Printer.findOne().exec()
      if (setting) {
        const receipt = escpos.resolveTicketPrinter(setting, 'receipt')
        if (receipt && receipt.ip) {
          await printQueue.enqueuePrint(setting, receipt, await escpos.buildReceipt(receipt, order, { invoiceNo: order.orderNo, payMethod: order.payMethod }), order)
        }
      }
    } catch (e) {
      console.log('[Kiosk] 收據列印失敗：' + e.message)
    }
    if (io) io.emit('tableUpdate')
    res.json({ success: true, orderNo: order.orderNo, totalPrice: order.totalPrice, payMethod: order.payMethod })
  } catch (err) {
    console.log(err)
    res.status(400).send('付款失敗，請重試')
  }
})

module.exports = router
