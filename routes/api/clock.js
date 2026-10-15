const express = require('express')
const router = express.Router()
const ClockRecord = require('../../models/ClockRecord')
const Staff = require('../../models/Staff')

// $route POST /api/clock/in
// @desc 上班打卡（純打卡紀錄，不影響 POS 操作）
// @access public
router.post('/in', async (req, res) => {
  try {
    const staffNo = (req.body.staffNo || '').trim()
    const terminalCode = req.body.terminalCode || ''
    if (!staffNo) return res.status(400).send('請輸入員工編號！')

    // 依後台「用戶管理」的員工編號查詢，取得姓名並確認存在
    const staff = await Staff.findOne({ no: staffNo, enabled: true })
    if (!staff) return res.status(400).send('員工編號不存在或已停用！')

    // 檢查該員工 + 該收銀機是否已有上班中的紀錄
    const existing = await ClockRecord.findOne({
      staffNo,
      terminalCode,
      status: 'active'
    }).exec()
    if (existing) {
      return res.status(400).send('你已在這個收銀機上班中！請先下班再重新上班。')
    }

    const record = await ClockRecord.create({
      staffNo: staff.no,
      staffName: staff.name,
      terminalCode,
      clockInTime: new Date(),
      status: 'active'
    })

    res.json({
      success: true,
      message: '上班打卡成功！',
      shift: {
        _id: record._id,
        staffName: record.staffName,
        terminalCode: record.terminalCode,
        clockInTime: record.clockInTime
      }
    })
  } catch (err) {
    console.log(err)
    res.status(400).send('上班打卡失敗！')
  }
})

// $route POST /api/clock/out
// @desc 下班打卡（純打卡紀錄，不影響 POS 操作）
// @access public
router.post('/out', async (req, res) => {
  try {
    const { shiftId, staffNo, terminalCode, remark } = req.body
    let record = null
    if (shiftId) {
      record = await ClockRecord.findById(shiftId).exec()
    } else {
      const no = (staffNo || '').trim()
      if (!no) return res.status(400).send('請輸入員工編號！')
      record = await ClockRecord.findOne({
        staffNo: no,
        terminalCode: terminalCode || '',
        status: 'active'
      }).sort({ clockInTime: -1 }).exec()
    }
    if (!record) return res.status(400).send('找不到上班中的打卡紀錄！')
    if (record.status === 'closed') return res.status(400).send('此打卡紀錄已下班！')

    record.clockOutTime = new Date()
    record.remark = remark || ''
    record.status = 'closed'
    await record.save()

    res.json({
      success: true,
      message: '下班打卡成功！',
      report: {
        staffName: record.staffName,
        terminalCode: record.terminalCode,
        clockInTime: record.clockInTime,
        clockOutTime: record.clockOutTime
      }
    })
  } catch (err) {
    console.log(err)
    res.status(400).send('下班打卡失敗！')
  }
})

// $route POST /api/clock/current
// @desc 查詢當前上班狀態（員工 + 收銀機）
// @access public
router.post('/current', async (req, res) => {
  try {
    const { staffNo, terminalCode } = req.body
    if (!staffNo) return res.status(400).send('缺少員工編號！')

    const filter = { staffNo, status: 'active' }
    if (terminalCode) filter.terminalCode = terminalCode

    const record = await ClockRecord.findOne(filter).sort({ clockInTime: -1 }).lean().exec()
    if (!record) return res.json({ shift: null })

    res.json({
      shift: {
        _id: record._id,
        staffName: record.staffName,
        terminalCode: record.terminalCode,
        clockInTime: record.clockInTime,
        status: record.status
      }
    })
  } catch (err) {
    console.log(err)
    res.status(400).send('查詢失敗！')
  }
})

module.exports = router
