// CUPS / IPP 列印客戶端
// 統一經由 CUPS 佇列送單，避免多台工作站直接連印表機造成卡單/漏單。
// 印表機在 CUPS 需以「Raw」佇列新增（socket://<IP>:9100），確保 ESC/POS 位元組原封不動。
const ipp = require('@sealsystems/ipp')

const CUPS_URL = process.env.CUPS_URL || 'http://cups:631'
const CUPS_USER = process.env.CUPS_USER || 'admin'
const CUPS_PASSWORD = process.env.CUPS_PASSWORD || ''

// HTTP Basic 認證（Cancel-Job 等操作需 @OWNER/@SYSTEM 權限）
const CUPS_AUTH = CUPS_PASSWORD ? `${CUPS_USER}:${CUPS_PASSWORD}` : undefined

function printerUri (queueName) {
  return `${CUPS_URL}/printers/${encodeURIComponent(queueName)}`
}

// 將 Basic 認證嵌入 URL（供直接 ipp.request 使用）
function withAuth (urlStr) {
  if (!CUPS_PASSWORD) return urlStr
  const u = new URL(urlStr)
  u.username = CUPS_USER
  u.password = CUPS_PASSWORD
  return u.toString()
}

const JOB_STATES = {
  3: 'pending',
  4: 'pending-held',
  5: 'processing',
  6: 'processing-stopped',
  7: 'canceled',
  8: 'aborted',
  9: 'completed'
}
function jobStateName (code) {
  if (typeof code === 'string') return code // 已是字串狀態（如 completed）
  return JOB_STATES[code] || 'unknown'
}

// 傳送 Raw ESC/POS Buffer 到指定 CUPS 佇列（Print-Job）
function printRaw (queueName, buffer, opts = {}) {
  return new Promise((resolve, reject) => {
    const printer = ipp.Printer(printerUri(queueName), { auth: CUPS_AUTH })
    printer.execute('Print-Job', {
      'operation-attributes-tag': {
        'requesting-user-name': opts.user || CUPS_USER,
        'document-format': 'application/octet-stream', // Raw 直通
        'job-name': opts.jobName || 'POS',
        copies: opts.copies || 1
      },
      data: buffer
    }, (err, res) => {
      if (err) return reject(err)
      // 檢查 IPP 狀態碼：佇列不存在等錯誤 @sealsystems/ipp 不會回傳 err，需自行判斷
      const status = (res && res.statusCode) || ''
      if (status && status.indexOf('successful-ok') !== 0) return reject(new Error(status))
      const attrs = res['job-attributes-tag'] || {}
      resolve({
        jobId: attrs['job-id'],
        jobUri: attrs['job-uri'],
        queueName
      })
    })
  })
}

// 查詢佇列 Jobs（which: not-completed | completed | all）
function listJobs (queueName, which = 'all', limit = 100) {
  return new Promise((resolve, reject) => {
    const printer = ipp.Printer(printerUri(queueName), { auth: CUPS_AUTH })
    printer.execute('Get-Jobs', {
      'operation-attributes-tag': {
        'requesting-user-name': CUPS_USER,
        'which-jobs': which,
        limit,
        'requested-attributes': [
          'job-id', 'job-name', 'job-state',
          'job-originating-user-name', 'time-at-creation', 'time-at-completed'
        ]
      }
    }, (err, res) => {
      if (err) return reject(err)
      // 單一 Job 時 parser 回傳 object，多個 Job 時回傳 array，統一轉成 array
      let raw = res['job-attributes-tag'] || []
      if (!Array.isArray(raw)) raw = [raw]
      const jobs = raw.map(j => {
        // job-state 在 @sealsystems/ipp 已解析成字串（如 completed），但也相容數值
        const stateCode = j['job-state']
        const state = jobStateName(stateCode)
        return {
          jobId: j['job-id'],
          name: j['job-name'],
          state,
          stateCode,
          user: j['job-originating-user-name'],
          createdAt: toUnixSeconds(j['time-at-creation']),
          completedAt: toUnixSeconds(j['time-at-completed'])
        }
      })
      resolve(jobs)
    })
  })
}

// 把 parser 回傳的 Date / ISO 字串 / 數值統一轉成 unix 秒（前端再 *1000 顯示）
function toUnixSeconds (v) {
  if (v == null) return 0
  if (v instanceof Date) return Math.floor(v.getTime() / 1000)
  if (typeof v === 'number') return v
  const t = Date.parse(v)
  return isNaN(t) ? 0 : Math.floor(t / 1000)
}

// 取消卡住的 Job（Cancel-Job）
function cancelJob (queueName, jobId) {
  return new Promise((resolve, reject) => {
    const printer = ipp.Printer(printerUri(queueName), { auth: CUPS_AUTH })
    printer.execute('Cancel-Job', {
      'operation-attributes-tag': {
        'requesting-user-name': CUPS_USER,
        'job-id': Number(jobId)
      }
    }, (err) => {
      if (err) return reject(err)
      resolve(true)
    })
  })
}

// 查詢單一 Job 狀態（Get-Job-Attributes），供送單後確認是否真正列印完成
function getJobAttributes (queueName, jobId) {
  return new Promise((resolve, reject) => {
    const printer = ipp.Printer(printerUri(queueName), { auth: CUPS_AUTH })
    printer.execute('Get-Job-Attributes', {
      'operation-attributes-tag': {
        'requesting-user-name': CUPS_USER,
        'job-id': Number(jobId),
        'requested-attributes': ['job-id', 'job-state']
      }
    }, (err, res) => {
      if (err) return reject(err)
      const status = (res && res.statusCode) || ''
      if (status && status.indexOf('successful-ok') !== 0) return reject(new Error(status))
      let raw = res['job-attributes-tag'] || {}
      if (Array.isArray(raw)) raw = raw[0] || {}
      resolve({
        jobId: raw['job-id'],
        state: jobStateName(raw['job-state']),
        stateCode: raw['job-state']
      })
    })
  })
}

// 列出 CUPS 上所有印表機/佇列（CUPS-Get-Printers）
function listPrinters () {
  return new Promise((resolve, reject) => {
    const msg = {
      version: '2.0',
      operation: 'CUPS-Get-Printers',
      'operation-attributes-tag': {
        'attributes-charset': 'utf-8',
        'attributes-natural-language': 'en-us',
        'requesting-user-name': CUPS_USER,
        'requested-attributes': ['printer-name', 'printer-state', 'printer-is-accepting-jobs']
      }
    }
    ipp.request(withAuth(`${CUPS_URL}/`), ipp.serialize(msg), (err, res) => {
      if (err) return reject(err)
      // 單一印表機時 parser 回傳 object，多台時回傳 array，統一轉成 array
      let raw = res['printer-attributes-tag'] || []
      if (!Array.isArray(raw)) raw = [raw]
      const printers = raw.map(p => ({
        name: p['printer-name'],
        state: p['printer-state'],
        accepting: p['printer-is-accepting-jobs']
      }))
      resolve(printers)
    })
  })
}

// ---- CUPS 管理操作（建立 / 刪除佇列）----

// IPP 值標籤（RFC 2910 §3.5.2）
const IPP_TAGS = {
  boolean: 0x22,
  name: 0x42,
  uri: 0x45,
  charset: 0x47,
  naturalLanguage: 0x48
}

// CUPS 管理操作碼（CUPS 專用 0x4000 + 偏移；標準操作見 @sealsystems/ipp enums）
const CUPS_OPERATIONS = {
  'CUPS-Add-Modify-Printer': 0x4003,
  'CUPS-Delete-Printer': 0x4004,
  'Resume-Printer': 0x0011
}

// 手動序列化 IPP 請求。
// @sealsystems/ipp 的 serializer 未定義 device-uri 等屬性，會靜默丟棄，
// 故 CUPS 管理操作改用手動建構，確保 device-uri / printer-name 正確送出。
function buildIppRequest (operationId, attrs) {
  const chunks = []
  chunks.push(Buffer.from([0x02, 0x00])) // version 2.0
  chunks.push(Buffer.from([(operationId >> 8) & 0xff, operationId & 0xff])) // operation-id
  chunks.push(Buffer.from([0x00, 0x00, 0x00, 0x01])) // request-id
  chunks.push(Buffer.from([0x01])) // operation-attributes-tag
  attrs.forEach(a => {
    chunks.push(Buffer.from([a.tag]))
    const name = Buffer.from(a.name, 'ascii')
    chunks.push(Buffer.from([(name.length >> 8) & 0xff, name.length & 0xff]))
    chunks.push(name)
    if (a.tag === IPP_TAGS.boolean) {
      chunks.push(Buffer.from([0x00, 0x01]))
      chunks.push(Buffer.from([a.value ? 0x01 : 0x00]))
    } else {
      const value = Buffer.from(String(a.value), 'ascii')
      chunks.push(Buffer.from([(value.length >> 8) & 0xff, value.length & 0xff]))
      chunks.push(value)
    }
  })
  chunks.push(Buffer.from([0x03])) // end-of-attributes-tag
  return Buffer.concat(chunks)
}

// 送出 CUPS 管理請求並檢查 IPP 狀態碼
function cupsAdminRequest (operation, attrs) {
  return new Promise((resolve, reject) => {
    ipp.request(withAuth(`${CUPS_URL}/`), buildIppRequest(operation, attrs), (err, res) => {
      if (err) return reject(err)
      const status = (res && res.statusCode) || ''
      if (status && status.indexOf('successful-ok') !== 0) {
        return reject(new Error(status))
      }
      resolve(res)
    })
  })
}

// 建立 / 修改 CUPS Raw 佇列（socket://IP:9100）
function addPrinter (queueName, ip, port = 9100) {
  const name = String(queueName || '').trim()
  if (!name) return Promise.reject(new Error('佇列名稱不能為空'))
  if (!ip) return Promise.reject(new Error('打印機 IP 不能為空'))
  const printerUri = `${CUPS_URL}/printers/${encodeURIComponent(name)}`
  const createAttrs = [
    { tag: IPP_TAGS.charset, name: 'attributes-charset', value: 'utf-8' },
    { tag: IPP_TAGS.naturalLanguage, name: 'attributes-natural-language', value: 'en-us' },
    { tag: IPP_TAGS.uri, name: 'printer-uri', value: printerUri },
    { tag: IPP_TAGS.name, name: 'requesting-user-name', value: CUPS_USER },
    { tag: IPP_TAGS.name, name: 'printer-name', value: name },
    { tag: IPP_TAGS.uri, name: 'device-uri', value: `socket://${ip}:${port}` },
    { tag: IPP_TAGS.boolean, name: 'printer-is-accepting-jobs', value: true }
  ]
  const resumeAttrs = [
    { tag: IPP_TAGS.charset, name: 'attributes-charset', value: 'utf-8' },
    { tag: IPP_TAGS.naturalLanguage, name: 'attributes-natural-language', value: 'en-us' },
    { tag: IPP_TAGS.uri, name: 'printer-uri', value: printerUri },
    { tag: IPP_TAGS.name, name: 'requesting-user-name', value: CUPS_USER }
  ]
  // 新建立的 Raw 佇列預設為 stopped（disabled），需 Resume-Printer 啟用為 idle
  return cupsAdminRequest(CUPS_OPERATIONS['CUPS-Add-Modify-Printer'], createAttrs)
    .then(() => cupsAdminRequest(CUPS_OPERATIONS['Resume-Printer'], resumeAttrs))
    .then(() => ({ name, deviceUri: `socket://${ip}:${port}` }))
}

// 刪除 CUPS 佇列
function deletePrinter (queueName) {
  const name = String(queueName || '').trim()
  if (!name) return Promise.reject(new Error('佇列名稱不能為空'))
  const attrs = [
    { tag: IPP_TAGS.charset, name: 'attributes-charset', value: 'utf-8' },
    { tag: IPP_TAGS.naturalLanguage, name: 'attributes-natural-language', value: 'en-us' },
    { tag: IPP_TAGS.uri, name: 'printer-uri', value: `${CUPS_URL}/printers/${encodeURIComponent(name)}` },
    { tag: IPP_TAGS.name, name: 'requesting-user-name', value: CUPS_USER }
  ]
  return cupsAdminRequest(CUPS_OPERATIONS['CUPS-Delete-Printer'], attrs).then(() => ({ name }))
}

module.exports = { printRaw, listJobs, cancelJob, getJobAttributes, listPrinters, addPrinter, deletePrinter }
