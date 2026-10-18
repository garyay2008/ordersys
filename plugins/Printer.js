/**
 * ESC/POS 熱敏打印機插件
 * 支持網絡打印機（TCP :9100），58/80mm 紙寬，中文 GBK 編碼
 * 小票內容可通過 Printer.format 配置（字段開關/字號/對齊），支持後廚/結賬/上菜紙三種
 */
const net = require('net')
const fs = require('fs')
const path = require('path')
const iconv = require('iconv-lite')
const moment = require('moment')
const qrcode = require('qrcode')
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas')
const config = require('../config/config')

const ESC = 0x1b
const GS = 0x1d
const FS = 0x1c

// ---- 圖像打印模式（文字轉圖）----
// 用於不具中文內建字庫的打印機（例如泰文型號）：將中文文字在伺服器端
// 以 Noto Sans TC 字型繪製成點陣圖，再以 GS v 0 圖形指令送出。
const FONT_FILE = path.join(__dirname, '..', 'fonts', 'NotoSansTC.ttf')
const FONT_FAMILY = 'NotoPrint'
// 圖像模式可選字體（熱敏 imagePrint / 針機 dotImagePrint 共用）
const IMAGE_FONTS = {
  noto: { file: path.join(__dirname, '..', 'fonts', 'NotoSansTC.ttf'), family: 'NotoPrint' },
  serif: { file: path.join(__dirname, '..', 'fonts', 'NotoSerifTC.ttf'), family: 'NotoSerifPrint' },
  stheiti: { file: path.join(__dirname, '..', 'fonts', 'STHeitiMedium.ttc'), family: 'STHeitiMedium' },
  arial: { file: path.join(__dirname, '..', 'fonts', 'ArialUnicode.ttf'), family: 'ArialUnicode' }
}
const BAND_H = 256 // 每次輸出點陣圖的最高像素（超過即分段）
let fontReady = false
let currentFontFamily = 'NotoPrint' // 目前繪圖使用的字體（熱敏依 thermalFont，針機依 dotImageFont）
let imageCtx = null // { canvas, ctx, y, bands, color, header }

function ensureFont () {
  if (fontReady) return
  try {
    GlobalFonts.registerFromPath(FONT_FILE, FONT_FAMILY)
    // 針機可選字體一併註冊（忽略重複/載入失敗）
    for (const key of Object.keys(IMAGE_FONTS)) {
      const f = IMAGE_FONTS[key]
      if (f.family !== FONT_FAMILY) {
        try { GlobalFonts.registerFromPath(f.file, f.family) } catch (e) { /* 忽略 */ }
      }
    }
    fontReady = true
  } catch (e) {
    console.log('[Printer] 中文字體載入失敗：' + e.message)
  }
}

function pixelWidth (paperWidth, dpi = 180) {
  // 熱敏圖像模式點陣寬。180dpi（TM-T88VI）基準：80mm=512 點、58mm=360 點；
  // 其他 dpi（如 XP-80TS=203dpi）按比例換算，維持可印區一致。
  const base = paperWidth === 80 ? 512 : 360
  return Math.round(base * (dpi || 180) / 180)
}

// 針機 ESC * m=0 單密度點陣（TM-U220 80dpi 水平 / 72dpi 垂直）。
// 76mm 紙每行上限：DIP SW2-1 OFF=200 點 / ON=192 點；採 192 以同時兼容兩種設定，
// 避免右側（右下台號 deskNo2）被裁切。57.5mm 紙採 SW2-1 ON 的 148 點。
function dotPixelWidth (paperWidth) {
  return paperWidth === 80 ? 192 : 148
}

// 默認小票格式（fields: 字段級 show/size/align）
const DEFAULT_FORMAT = {
  kitchen: {
    title: '後廚小票',
    fields: {
      title: { show: false, size: 1, align: 'center' },
      shopName: { show: false, size: 4, align: 'center' },
      deskNo: { show: true, size: 1, align: 'left' },
      deskNo2: { show: true, size: 1, align: 'right' },
      orderNo: { show: true, size: 1, align: 'left' },
      orderNoStation: { show: false, size: 1, align: 'left' },
      dateSendTimeWaiter: { show: false, size: 1, align: 'left' },
      items: { show: true, size: 1, align: 'left' },
      total: { show: true, size: 1, align: 'right' },
      remark: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      divider1: { show: true, type: '=' },
      divider2: { show: true, type: '-' },
      divider3: { show: true, type: '-' },
      divider4: { show: true, type: '=' }
    }
  },
  receipt: {
    title: '結賬小票',
    fields: {
      title: { show: true, size: 1, align: 'center' },
      shopName: { show: true, size: 4, align: 'center' },
      address: { show: true, size: 1, align: 'center' },
      phone: { show: true, size: 1, align: 'center' },
      deskNo: { show: false, size: 4, align: 'center' },
      deskNoBig: { show: true, size: 5, align: 'left' },
      orderNo: { show: true, size: 1, align: 'left' },
      items: { show: true, size: 1, align: 'left' },
      remark: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      date: { show: true, size: 1, align: 'left' },
      total: { show: true, size: 4, align: 'right' },
      serviceCharge: { show: true, size: 1, align: 'right' },
      grandTotal: { show: true, size: 4, align: 'right' },
      payMethod: { show: true, size: 1, align: 'right' },
      reprint: { show: true, size: 2, align: 'left' },
      footer: { show: true, size: 1, align: 'center' },
      divider1: { show: true, type: '=' },
      divider2: { show: true, type: '-' },
      divider3: { show: true, type: '-' },
      divider4: { show: true, type: '=' }
    }
  },
  serving: {
    title: '上菜紙',
    fields: {
      title: { show: true, size: 1, align: 'center' },
      shopName: { show: true, size: 4, align: 'center' },
      deskNo: { show: true, size: 4, align: 'center' },
      orderNo: { show: true, size: 1, align: 'left' },
      people: { show: true, size: 1, align: 'left' },
      date: { show: true, size: 1, align: 'left' },
      items: { show: true, size: 1, align: 'left' },
      items2: { show: false, size: 1, align: 'left' },
      remark: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      footer: { show: true, size: 1, align: 'center' },
      divider1: { show: true, type: '=' },
      divider2: { show: true, type: '-' },
      divider3: { show: true, type: '-' },
      divider4: { show: true, type: '=' }
    }
  },
  print: {
    title: '印單小票',
    fields: {
      title: { show: true, size: 1, align: 'center' },
      shopName: { show: true, size: 4, align: 'center' },
      address: { show: true, size: 1, align: 'center' },
      phone: { show: true, size: 1, align: 'center' },
      deskNo: { show: true, size: 4, align: 'center' },
      deskNoBig: { show: true, size: 5, align: 'left' },
      barcode: { show: false },
      orderNo: { show: true, size: 1, align: 'left' },
      seq: { show: true, size: 1, align: 'left' },
      items: { show: true, size: 1, align: 'left' },
      remark: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      date: { show: true, size: 1, align: 'left' },
      total: { show: true, size: 4, align: 'right' },
      serviceCharge: { show: true, size: 1, align: 'right' },
      grandTotal: { show: true, size: 4, align: 'right' },
      reprint: { show: true, size: 2, align: 'left' },
      divider1: { show: true, type: '=' },
      divider2: { show: true, type: '-' },
      divider3: { show: true, type: '-' },
      divider4: { show: true, type: '=' }
    }
  },
  qrcode: {
    title: '二維碼小票',
    fields: {
      title: { show: true, size: 1, align: 'center' },
      shopName: { show: true, size: 4, align: 'center' },
      deskNo: { show: true, size: 4, align: 'center' },
      orderNo: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      qr: { show: true, size: 2 },
      divider1: { show: true, type: '=' },
      divider2: { show: true, type: '-' },
      divider3: { show: true, type: '=' }
    }
  },
  tableqr: {
    title: '掃碼點餐',
    fields: {
      title: { show: true, size: 3, align: 'center' },
      shopName: { show: true, size: 3, align: 'center' },
      deskNo: { show: true, size: 3, align: 'center' },
      barcode: { show: false, size: 1 },
      orderNo: { show: true, size: 1, align: 'left' },
      date: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      hint: { show: true, size: 1, align: 'center' },
      qr: { show: true, size: 3 },
      divider1: { show: true, type: '-' }
    }
  },
  chase: {
    title: '【追單】',
    fields: {
      title: { show: true, size: 4, align: 'center' },
      shopName: { show: true, size: 4, align: 'center' },
      deskNo: { show: true, size: 4, align: 'center' },
      orderNo: { show: true, size: 1, align: 'left' },
      items: { show: true, size: 1, align: 'left' },
      remark: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      divider1: { show: true, type: '=' },
      divider2: { show: true, type: '-' },
      divider3: { show: true, type: '-' },
      divider4: { show: true, type: '=' }
    }
  },
  pantry: {
    title: '【班地厘訊息】',
    fields: {
      title: { show: true, size: 4, align: 'center' },
      shopName: { show: true, size: 4, align: 'center' },
      deskNo: { show: true, size: 1, align: 'left' },
      orderNo: { show: true, size: 1, align: 'left' },
      message: { show: true, size: 3, align: 'left' },
      waiter: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      divider1: { show: true, type: '=' },
      divider2: { show: true, type: '-' },
      divider3: { show: true, type: '-' },
      divider4: { show: true, type: '=' }
    }
  },
  cancelitem: {
    title: '已取消',
    fields: {
      title: { show: true, size: 3, align: 'center', bold: true },
      shopName: { show: true, size: 4, align: 'center' },
      deskNo: { show: true, size: 1, align: 'left' },
      orderNo: { show: true, size: 1, align: 'left' },
      waiter: { show: true, size: 1, align: 'left' },
      items: { show: true, size: 1, align: 'left' },
      reason: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      divider1: { show: true, type: '=' },
      divider2: { show: true, type: '-' },
      divider3: { show: true, type: '-' },
      divider4: { show: true, type: '=' }
    }
  },
  cancelall: {
    title: '整單取消',
    fields: {
      title: { show: true, size: 3, align: 'center', bold: true },
      shopName: { show: true, size: 4, align: 'center' },
      deskNo: { show: true, size: 1, align: 'left' },
      orderNo: { show: true, size: 1, align: 'left' },
      waiter: { show: true, size: 1, align: 'left' },
      items: { show: true, size: 1, align: 'left' },
      reason: { show: true, size: 1, align: 'left' },
      total: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      divider1: { show: true, type: '=' },
      divider2: { show: true, type: '-' },
      divider3: { show: true, type: '-' },
      divider4: { show: true, type: '=' }
    }
  }
}

// 補充新欄位默認配置：開單員工（waiter）與菜品明細2（items2，含入單時間）
Object.keys(DEFAULT_FORMAT).forEach(type => {
  const fields = DEFAULT_FORMAT[type].fields
  if (!fields) return
  const simple = type === 'qrcode' || type === 'tableqr' || type === 'cancelitem' || type === 'cancelall'
  if (!simple && !fields.waiter) fields.waiter = { show: true, size: 1, align: 'left' }
  if (!simple && !fields.items2) fields.items2 = { show: false, size: 1, align: 'left' }
  if (!simple && !fields.mods) fields.mods = { show: true, size: 1, align: 'left' }
  if (!simple && type !== 'pantry' && !fields.sendTime) fields.sendTime = { show: true, size: 1, align: 'left' }
  if (!simple && type !== 'pantry' && !fields.sendWaiter) fields.sendWaiter = { show: true, size: 1, align: 'left' }
  if (!simple && type !== 'pantry' && !fields.people) fields.people = { show: true, size: 1, align: 'left' }
  if (!simple && !fields.items3) fields.items3 = { show: true, size: 1, align: 'left' }
})

// 字號級別 → 寬高縮放倍率（w=寬 / h=高）
// 1=正常(1x) 2=大(1.5x) 3=特大(2x) 4=超大(3x) 5=最大(4x) 6=極大(5x，僅圖像模式生效)
const SIZE_SCALE = {
  1: { w: 1, h: 1 },
  2: { w: 1.5, h: 1.5 },
  3: { w: 2, h: 2 },
  4: { w: 3, h: 3 },
  5: { w: 4, h: 4 },
  6: { w: 5, h: 5 }
}

// 可變字重字體（NotoSansTC.ttf）的 wght 命名實例。Skia 對中間值（如 350/450/550）渲染不穩，
// 筆畫會變細/字距錯亂，故將字重吸附到最近的命名實例，確保輸出穩定。
const WEIGHT_INSTANCES = [100, 200, 300, 400, 500, 600, 700, 800, 900]
function snapWeight (w) {
  const v = Math.max(100, Math.min(900, Math.round(w || 400)))
  let best = WEIGHT_INSTANCES[0]
  for (const inst of WEIGHT_INSTANCES) {
    if (Math.abs(inst - v) < Math.abs(best - v)) best = inst
  }
  return best
}

// 解析字重與描邊寬度：字重軸在 @napi-rs/canvas 對中間值（如 550/580）渲染不穩（會爆粗），
// 故字重先吸附到穩定命名實例；粗細的細微差異改由描邊(stroke)寬度補足，
// 使 550/580 等中間設定能產生漸進差異（500=0px、550/580=0.5px、600/700=1px、800=2px）。
function resolveWeight (w, bold) {
  if (bold) return { weight: 900, stroke: 2 }
  const raw = Math.max(100, Math.min(900, Math.round(w || 400)))
  const weight = snapWeight(raw)
  let stroke = 0
  if (raw >= 800) stroke = 2
  else if (raw >= 600) stroke = 1
  else if (raw >= 550) stroke = 0.5
  return { weight, stroke }
}

// 各小票類型的預設欄位順序（用戶可上下調整）
const DEFAULT_ORDER = {
  kitchen: ['shopName', 'title', 'divider1', 'deskNo', 'orderNo', 'waiter', 'sendWaiter', 'people', 'station', 'orderNoStation', 'dateSendTimeWaiter', 'divider2', 'items', 'items2', 'items3', 'total', 'divider3', 'remark', 'time', 'sendTime', 'deskNo2', 'divider4'],
  serving: ['shopName', 'title', 'divider1', 'deskNo', 'orderNo', 'waiter', 'sendWaiter', 'people', 'date', 'divider2', 'items', 'items2', 'items3', 'divider3', 'remark', 'time', 'sendTime', 'footer', 'divider4'],
  print: ['shopName', 'title', 'address', 'phone', 'divider1', 'deskNo', 'barcode', 'deskNoBig', 'orderNo', 'seq', 'reprint', 'waiter', 'sendWaiter', 'people', 'divider2', 'items', 'items2', 'items3', 'divider3', 'total', 'serviceCharge', 'grandTotal', 'remark', 'time', 'sendTime', 'date', 'divider4'],
  qrcode: ['shopName', 'title', 'divider1', 'deskNo', 'orderNo', 'waiter', 'divider2', 'time', 'divider3'],
  tableqr: ['shopName', 'title', 'deskNo', 'barcode', 'orderNo', 'date', 'time', 'hint', 'divider1'],
  chase: ['title', 'shopName', 'divider1', 'deskNo', 'orderNo', 'waiter', 'sendWaiter', 'people', 'divider2', 'items', 'items2', 'items3', 'divider3', 'remark', 'time', 'sendTime', 'divider4'],
  receipt: ['shopName', 'title', 'address', 'phone', 'divider1', 'deskNo', 'deskNoBig', 'orderNo', 'reprint', 'waiter', 'sendWaiter', 'people', 'divider2', 'items', 'items2', 'items3', 'divider3', 'total', 'serviceCharge', 'grandTotal', 'payMethod', 'remark', 'time', 'sendTime', 'date', 'divider4', 'footer'],
  pantry: ['shopName', 'title', 'divider1', 'deskNo', 'orderNo', 'divider2', 'message', 'divider3', 'waiter', 'time', 'divider4'],
  cancelitem: ['shopName', 'title', 'divider1', 'deskNo', 'orderNo', 'waiter', 'divider2', 'items', 'reason', 'divider3', 'time', 'divider4'],
  cancelall: ['shopName', 'title', 'divider1', 'deskNo', 'orderNo', 'waiter', 'divider2', 'items', 'reason', 'total', 'divider3', 'time', 'divider4']
}

// 展開分組 order（元素可為字串或陣列），供舊資料相容檢查使用
function flattenOrder (order) {
  const out = []
  for (const item of order || []) {
    if (Array.isArray(item)) out.push(...item)
    else out.push(item)
  }
  return out
}

function mergeFormat (type, setting) {
  const base = DEFAULT_FORMAT[type] || {}
  const custom = (setting && setting.format && setting.format[type]) || {}
  const merged = Object.assign({}, base, custom)
  if (base.fields) {
    const fields = Object.assign({}, base.fields)
    if (custom.fields) {
      for (const k of Object.keys(custom.fields)) {
        fields[k] = Object.assign({}, fields[k], custom.fields[k])
      }
    }
    // 兼容舊 showXxx 布爾格式
    const map = {
      deskno: 'deskNo', orderno: 'orderNo', items: 'items', remark: 'remark', time: 'time',
      address: 'address', phone: 'phone', price: 'price', total: 'total', footer: 'footer'
    }
    for (const k of Object.keys(custom)) {
      if (k.startsWith('show') && typeof custom[k] === 'boolean') {
        const target = map[k.slice(4).toLowerCase()]
        if (target && fields[target]) fields[target].show = custom[k]
      }
    }
    merged.fields = fields
  }
  const defaultOrder = DEFAULT_ORDER[type] || Object.keys(merged.fields || {})
  if (custom.order && custom.order.length) {
    // 舊資料相容：order 需包含全部默認常規欄位與分隔線，否則套用新預設順序
    const flatOrder = flattenOrder(custom.order)
    const defaultRegular = defaultOrder.filter(k => k && k.indexOf('divider') !== 0)
    const defaultDivider = defaultOrder.filter(k => k && k.indexOf('divider') === 0)
    const hasAllRegular = defaultRegular.every(k => flatOrder.indexOf(k) >= 0)
    const hasDivider = (defaultDivider.length === 0) || flatOrder.some(k => k && k.indexOf('divider') === 0)
    if (hasAllRegular && hasDivider) {
      merged.order = custom.order
    } else if (hasDivider) {
      // 有分隔線但缺少新欄位（例如 footer）：保留用戶自訂順序，補上缺失欄位（插到最後一個分隔線之前）
      const missing = defaultRegular.filter(k => flatOrder.indexOf(k) < 0)
      const order = custom.order.slice()
      let insertAt = order.length
      for (let i = order.length - 1; i >= 0; i--) {
        const it = order[i]
        if (typeof it === 'string' && it.indexOf('divider') === 0) { insertAt = i; break }
      }
      order.splice(insertAt, 0, ...missing)
      merged.order = order
    } else {
      merged.order = defaultOrder
    }
  } else {
    merged.order = defaultOrder
  }
  // 確保有文字內容的自定義欄位一定被渲染（即使 order 遺漏了 custom 欄位，避免「有時顯示不了」）
  if (merged.fields) {
    const flat = flattenOrder(merged.order || [])
    const missingCustom = Object.keys(merged.fields).filter(k => {
      const cf = merged.fields[k]
      return k.indexOf('custom') === 0 && cf && cf.show !== false && cf.text && flat.indexOf(k) < 0
    })
    if (missingCustom.length) {
      merged.order = (merged.order || []).slice().concat(missingCustom)
    }
  }
  return merged
}

function concat (arrs) {
  if (imageCtx) {
    // 圖像模式：所有文字已繪入 canvas，這裡把剩餘圖帶與開頭指令一併輸出
    flushImageBand()
    const out = Buffer.concat([imageCtx.header].concat(imageCtx.bands))
    imageCtx = null
    return out
  }
  return Buffer.concat(arrs.map(a => (Buffer.isBuffer(a) ? a : Buffer.from(a))))
}

// 把 RGBA 像素轉成單色點陣（黑=1），並包成 GS v 0 指令
function imageToRaster (rgba, w, h, threshold) {
  const th = (threshold == null || threshold < 0) ? 160 : threshold
  const bytesPerRow = Math.ceil(w / 8)
  const rows = []
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(bytesPerRow)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const r = rgba[i]
      const g = rgba[i + 1]
      const b = rgba[i + 2]
      const a = rgba[i + 3]
      const lum = (r * 299 + g * 587 + b * 114) / 1000
      if (a > 128 && lum < th) row[Math.floor(x / 8)] |= 0x80 >> (x % 8)
    }
    rows.push(row)
  }
  const xL = bytesPerRow % 256
  const xH = Math.floor(bytesPerRow / 256)
  const yL = h % 256
  const yH = Math.floor(h / 256)
  const head = Buffer.from([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH])
  return Buffer.concat([head, ...rows])
}

// 針機點陣圖：將 RGBA 轉成 ESC * m=0（8-dot column-major），行距 16/144 吋讓 band 無縫
// 支援紅色像素：當 canvas 中出現紅字（如小計金額）時，按列切換色帶（ESC r）分段輸出
function dotImageToRaster (rgba, w, h, threshold) {
  const th = (threshold == null || threshold < 0) ? 160 : threshold
  const out = []
  out.push(Buffer.from([ESC, 0x33, 16])) // 行距 16/144 吋（實測無縫）
  let curRed = 0 // 色帶狀態跨 8 點帶保持（0=黑, 1=紅）
  for (let y0 = 0; y0 < h; y0 += 8) {
    const cols = Buffer.alloc(w)
    const redCol = Buffer.alloc(w)
    let hasRed = false
    for (let x = 0; x < w; x++) {
      let byte = 0
      let red = 0
      let black = 0
      for (let bit = 0; bit < 8; bit++) {
        const y = y0 + bit
        if (y >= h) break
        const i = (y * w + x) * 4
        const r = rgba[i]
        const g = rgba[i + 1]
        const b = rgba[i + 2]
        const a = rgba[i + 3]
        if (a <= 128) continue
        if (r > 128 && g < 120 && b < 120) {
          red = 1
          byte |= 0x80 >> bit
        } else {
          const lum = (r * 299 + g * 587 + b * 114) / 1000
          if (lum < th) {
            byte |= 0x80 >> bit
            black = 1
          }
        }
      }
      cols[x] = byte
      // 同列若同時有黑與紅像素，黑色優先，避免紅字（金額）暈染到黑字（數量/品名）
      redCol[x] = (red && !black) ? 1 : 0
      if (redCol[x]) hasRed = true
    }
    if (!hasRed) {
      if (curRed !== 0) {
        out.push(Buffer.from([ESC, 0x72, 0x00]))
        curRed = 0
      }
      const nL = w % 256
      const nH = Math.floor(w / 256)
      out.push(Buffer.from([ESC, 0x2a, 0, nL, nH]))
      out.push(cols)
      out.push(Buffer.from([0x0a])) // LF
      continue
    }
    // 含紅色：空列（如金額文字內部空隙）跟隨當前色帶不切換，僅在有筆畫的列切換色帶
    let segStart = 0
    for (let x = 0; x < w; x++) {
      if (cols[x] === 0) continue
      const wantRed = redCol[x] ? 1 : 0
      if (wantRed !== curRed) {
        out.push(Buffer.from([ESC, 0x72, curRed ? 0x01 : 0x00]))
        const len = x - segStart
        const nL = len % 256
        const nH = Math.floor(len / 256)
        out.push(Buffer.from([ESC, 0x2a, 0, nL, nH]))
        out.push(cols.slice(segStart, x))
        segStart = x
        curRed = wantRed
      }
    }
    out.push(Buffer.from([ESC, 0x72, curRed ? 0x01 : 0x00]))
    const lastLen = w - segStart
    const lastNL = lastLen % 256
    const lastNH = Math.floor(lastLen / 256)
    out.push(Buffer.from([ESC, 0x2a, 0, lastNL, lastNH]))
    out.push(cols.slice(segStart, w))
    out.push(Buffer.from([0x0a])) // LF
  }
  return Buffer.concat(out)
}

// 將目前 canvas 已繪製的部分輸出成 GS v 0 並清空
function flushImageBand () {
  if (!imageCtx) return
  const w = imageCtx.canvas.width
  const h = Math.min(BAND_H, Math.floor(imageCtx.y))
  if (h > 0) {
    const img = imageCtx.ctx.getImageData(0, 0, w, h)
    imageCtx.bands.push(dotImageMode ? dotImageToRaster(img.data, w, h) : imageToRaster(img.data, w, h))
    imageCtx.ctx.fillStyle = '#fff'
    imageCtx.ctx.fillRect(0, 0, w, imageCtx.canvas.height)
  }
  imageCtx.y = 0
}

// 確保 canvas 有足夠高度容納下一行，不夠則先輸出一個圖帶
function ensureImageSpace (h) {
  if (!imageCtx) return
  if (imageCtx.y + h > BAND_H) flushImageBand()
}

// 把過長文字按像素寬度換行（針機點陣圖模式，字太大避免超寬裁切）
function wrapText (ctx, str, maxWidth) {
  const lines = []
  let line = ''
  for (const ch of str) {
    const test = line + ch
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line)
      line = ch
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

// 在圖像模式下把一行文字畫入 canvas（scale 支援小數倍率，如大=寬1.5x）
function drawText (str, opts = {}) {
  const { align = 'left', doubleWidth = false, doubleHeight = false, scale, bold = false } = opts
  const ctx = imageCtx.ctx
  const w = imageCtx.canvas.width
  // 針機點陣圖模式依字號倍率縮放（size 4/5 放大右下台號等欄位），縮放後過寬時換行避免裁切
  const s = dotImageMode ? (scale || { w: 1, h: 1 }) : (scale || { w: (doubleWidth ? 2 : 1), h: (doubleHeight ? 2 : 1) })
  const fontSize = dotImageMode ? dotImageBaseSize : 24
  const lineHeight = dotImageMode ? Math.round(dotImageBaseSize * 1.2 * s.h) : Math.round(32 * s.h)
  const { weight, stroke: strokeWidth } = resolveWeight(imageCtx.weight, bold)
  ctx.font = weight + ' ' + fontSize + 'px ' + currentFontFamily
  ctx.fillStyle = imageCtx.color || '#000'
  ctx.strokeStyle = imageCtx.color || '#000'
  ctx.lineJoin = 'round'
  ctx.lineWidth = strokeWidth
  ctx.textBaseline = 'top'
  const strVal = String(str == null ? '' : str)
  // 針機點陣圖模式：字太大時自動換行（否則會超出紙寬被裁切）；依水平倍率換算可用寬度
  const lines = dotImageMode ? wrapText(ctx, strVal, (w - 8) / s.w) : [strVal]
  for (const line of lines) {
    ensureImageSpace(lineHeight)
    // flushImageBand() 會把 fillStyle 重設為 '#fff'，須在確保空間後重設前景色，
    // 否則新圖帶首行的 fillText 會以白色填充而看不見（僅剩 stroke 輪廓）。
    ctx.fillStyle = imageCtx.color || '#000'
    ctx.strokeStyle = imageCtx.color || '#000'
    ctx.lineWidth = strokeWidth
    const tw = ctx.measureText(line).width * s.w
    let x = 4
    if (align === 'center') x = Math.max(0, (w - tw) / 2)
    else if (align === 'right') x = Math.max(0, w - tw - 4)
    ctx.save()
    ctx.translate(x, imageCtx.y)
    if (s.w !== 1 || s.h !== 1) ctx.scale(s.w, s.h)
    if (strokeWidth > 0) ctx.strokeText(line, 0, 0)
    ctx.fillText(line, 0, 0)
    ctx.restore()
    imageCtx.y += lineHeight
  }
  return Buffer.alloc(0)
}

// 針機點陣圖模式：在同一行繪製黑色 head + 紅色 redStr（如小計金額紅字），金額緊跟數量
function drawTextRowRedTail (head, redStr, opt) {
  const scale = SIZE_SCALE[opt.size] || SIZE_SCALE[1]
  const s = scale || { w: 1, h: 1 }
  const fontSize = dotImageBaseSize
  const lineHeight = Math.round(fontSize * 1.2 * s.h)
  const { weight, stroke: strokeWidth } = resolveWeight(imageCtx.weight, opt.bold)
  const ctx = imageCtx.ctx
  const w = imageCtx.canvas.width
  ctx.font = weight + ' ' + fontSize + 'px ' + currentFontFamily
  const headLines = wrapText(ctx, String(head), (w - 8) / s.w)
  const lastIdx = headLines.length - 1
  headLines.forEach((line, i) => {
    ensureImageSpace(lineHeight)
    ctx.font = weight + ' ' + fontSize + 'px ' + currentFontFamily
    ctx.lineJoin = 'round'
    ctx.lineWidth = strokeWidth
    ctx.textBaseline = 'top'
    const y = imageCtx.y
    const drawPart = (str, color, x) => {
      ctx.fillStyle = color
      ctx.strokeStyle = color
      ctx.save()
      ctx.translate(x, y)
      if (s.w !== 1 || s.h !== 1) ctx.scale(s.w, s.h)
      if (strokeWidth > 0) ctx.strokeText(str, 0, 0)
      ctx.fillText(str, 0, 0)
      ctx.restore()
    }
    drawPart(line, '#000', 4)
    if (i === lastIdx) {
      const x = 4 + Math.ceil(ctx.measureText(line).width * s.w)
      drawPart(String(redStr), '#ff0000', x)
    }
    imageCtx.y += lineHeight
  })
  return Buffer.alloc(0)
}

// 中文編碼對照（FS C n）：big5=繁體 / gbk=簡體 / gb18030 / utf8
const CHARSET_CODE = {
  big5: 0x02,
  gbk: 0x01,
  gb2312: 0x01,
  gb18030: 0x08,
  utf8: null
}

// 當前小票建置使用的編碼（build 函式皆同步執行，故安全）
let currentCharset = 'big5'
// 當前打印機是否為針式（TM-U220 等），針式用 ESC ! 控制字號、熱敏用 GS !
let currentIsDot = false
// 針式點陣圖模式（dotImagePrint）：以 ESC * m=0 取代內建字庫，突破 2x2 字號上限
let dotImageMode = false
let dotImageBaseSize = 31

function encode (str) {
  const cs = currentCharset === 'gb2312' ? 'gbk' : currentCharset
  return iconv.encode(str == null ? '' : String(str), cs)
}

// 進入中文模式並選字碼系統（需在 ESC @ 之後呼叫）
function chinesePreamble () {
  if (currentCharset === 'utf8') {
    // FS ( C 02 00 30 02：選擇 UTF-8
    return Buffer.from([FS, 0x28, 0x43, 0x02, 0x00, 0x30, 0x02])
  }
  const code = CHARSET_CODE[currentCharset]
  if (code == null) return Buffer.alloc(0)
  return Buffer.from([FS, 0x26, FS, 0x43, code]) // FS & + FS C n
}

// 初始化打印機（ESC @ + 進入中文模式），並設定本單編碼
// imagePrint 模式下改以文字轉圖方式輸出，避免依賴打印機內建中文字庫
function initPrinter (setting) {
  currentCharset = (setting && setting.charset) || 'big5'
  const isDot = !!(setting && setting.tech === 'dot')
  currentIsDot = isDot
  dotImageMode = false
  currentFontFamily = (IMAGE_FONTS[(setting && setting.thermalFont) || 'noto'] || IMAGE_FONTS.noto).family
  // 熱敏 imagePrint 模式：整張以文字轉圖輸出（針機 dotImagePrint 不在此啟用，僅菜品明細局部使用）
  if (!isDot && setting && setting.imagePrint) {
    ensureFont()
    const w = pixelWidth(setting.paperWidth, setting.dpi)
    const canvas = createCanvas(w, BAND_H)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, BAND_H)
    imageCtx = {
      canvas,
      ctx,
      y: 4,
      bands: [],
      color: '#000',
      weight: (setting && setting.imageWeight) || 400,
      header: Buffer.from([ESC, 0x40, ESC, 0x33, 0x00])
    }
    return Buffer.alloc(0)
  }
  imageCtx = null
  // 針機文字模式：行距縮半（n=12/144 吋 = 1/12 吋）
  if (isDot) return concat([Buffer.from([ESC, 0x40, ESC, 0x33, 12]), chinesePreamble()])
  return concat([Buffer.from([ESC, 0x40]), chinesePreamble()])
}

// 針機點陣圖模式（dotImagePrint）：僅針對菜品明細以 ESC * m=0 輸出，突破內建 2x2 字號上限
// 在後廚小票渲染 items 前後呼叫；返回空 Buffer（實際內容累積於 imageCtx.bands）
function beginDotImage (setting, red) {
  ensureFont()
  const w = dotPixelWidth(setting.paperWidth)
  dotImageMode = true
  dotImageBaseSize = (setting && setting.dotImageSize) || 31
  const dotFont = IMAGE_FONTS[(setting && setting.dotImageFont) || 'noto'] || IMAGE_FONTS.noto
  currentFontFamily = dotFont.family
  const canvas = createCanvas(w, BAND_H)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, BAND_H)
  imageCtx = {
    canvas,
    ctx,
    y: 4,
    bands: [],
    color: '#000',
    weight: (setting && setting.dotImageWeight) || (setting && setting.imageWeight) || 400,
    header: red
      ? Buffer.from([ESC, 0x40, ESC, 0x33, 16, ESC, 0x72, 0x01]) // 重置 + 行距 + 紅
      : Buffer.from([ESC, 0x40, ESC, 0x33, 16]) // 重置 + 行距 16/144 吋（實測無縫）
  }
  return Buffer.alloc(0)
}

// 結束針機點陣圖模式：輸出 imageCtx 點陣並回到文字模式（重置 + 重新進入中文模式）
function endDotImage () {
  if (!imageCtx) return Buffer.alloc(0)
  flushImageBand()
  const out = Buffer.concat([imageCtx.header].concat(imageCtx.bands))
  imageCtx = null
  dotImageMode = false
  return Buffer.concat([out, Buffer.from([ESC, 0x40, ESC, 0x33, 12]), chinesePreamble()])
}

// 顯示寬度：中文/全角=2，其餘=1
function displayWidth (str) {
  str = String(str == null ? '' : str)
  let w = 0
  for (const ch of str) {
    w += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 2 : 1
  }
  return w
}

function pad (str, width, align) {
  str = String(str == null ? '' : str)
  const w = displayWidth(str)
  const gap = Math.max(0, width - w)
  if (align === 'right') return ' '.repeat(gap) + str
  if (align === 'center') {
    const left = Math.floor(gap / 2)
    return ' '.repeat(left) + str + ' '.repeat(gap - left)
  }
  return str + ' '.repeat(gap)
}

// 一行文本（可對齊、可放大）
function textLine (str, opts = {}) {
  if (imageCtx) return drawText(str, opts)
  const { align = 'left', width, doubleWidth = false, doubleHeight = false, bold = false } = opts
  let s = str
  if (width) s = pad(s, width, align)
  if (currentIsDot) {
    // 針式（TM-U220 等）用 ESC ! 選取列印模式：bit5=雙倍寬 / bit4=雙倍高 / bit3=粗體
    const mode = (doubleWidth ? 0x20 : 0) | (doubleHeight ? 0x10 : 0) | (bold ? 0x08 : 0)
    return concat([[ESC, 0x21, mode], encode(s), [0x0a]])
  }
  const sizeByte = (doubleWidth ? 0x10 : 0) | (doubleHeight ? 0x01 : 0)
  if (bold) {
    // 熱敏：ESC E 開啟/關閉強調（粗體）
    return concat([[ESC, 0x45, 0x01], [GS, 0x21, sizeByte], encode(s), [ESC, 0x45, 0x00], [0x0a]])
  }
  return concat([[GS, 0x21, sizeByte], encode(s), [0x0a]])
}

// 字段行：根據字段配置（size/align）渲染
// size: 1=正常 2=大(寬1.5x) 3=特大(寬2x) 4=超大(寬高各2x) 5=最大(寬高各3x，僅圖像模式生效)
function fieldLine (str, opt, w) {
  const scale = SIZE_SCALE[opt.size] || SIZE_SCALE[1]
  const align = opt.align || 'left'
  // 文字模式僅有 1x / 2x 兩級，1.5x 與 2x 皆取 2x 寬；圖像模式用 scale 精確縮放
  const dw = scale.w >= 1.5
  const dh = scale.h >= 2
  return textLine(str, {
    align,
    width: Math.floor(w / (dw ? 2 : 1)),
    doubleWidth: dw,
    doubleHeight: dh,
    bold: !!opt.bold,
    scale
  })
}

// 一行文字，其中 redStr 尾部以紅色列印（如「小計金額」紅字）：
// 針機/熱敏文字模式用 ESC r 內聯切換色帶；針機點陣圖模式同一行黑 + 紅；熱敏圖像模式無法打紅則合併為黑
function fieldLineRedTail (head, redStr, opt, w) {
  const scale = SIZE_SCALE[opt.size] || SIZE_SCALE[1]
  const dw = scale.w >= 1.5
  const dh = scale.h >= 2
  const bold = !!opt.bold
  if (imageCtx) {
    if (dotImageMode) return drawTextRowRedTail(head, redStr, opt)
    return fieldLine(head + redStr, opt, w)
  }
  if (currentIsDot) {
    const mode = (dw ? 0x20 : 0) | (dh ? 0x10 : 0) | (bold ? 0x08 : 0)
    return concat([[ESC, 0x21, mode], encode(head), [ESC, 0x72, 0x01], encode(redStr), [ESC, 0x72, 0x00], [0x0a]])
  }
  const sizeByte = (dw ? 0x10 : 0) | (dh ? 0x01 : 0)
  if (bold) {
    return concat([[ESC, 0x45, 0x01], [GS, 0x21, sizeByte], encode(head), [ESC, 0x72, 0x01], encode(redStr), [ESC, 0x72, 0x00], [ESC, 0x45, 0x00], [0x0a]])
  }
  return concat([[GS, 0x21, sizeByte], encode(head), [ESC, 0x72, 0x01], encode(redStr), [ESC, 0x72, 0x00], [0x0a]])
}

function divider (width, ch = '-') {
  if (imageCtx) {
    // 圖像模式：畫分隔線（寬度依紙寬）；'=' 為雙線，其餘為單線
    const ctx = imageCtx.ctx
    const w = imageCtx.canvas.width
    const lineH = ch === '=' ? 16 : 12
    ensureImageSpace(lineH)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1
    const ys = ch === '=' ? [imageCtx.y + 5, imageCtx.y + 11] : [imageCtx.y + lineH / 2]
    for (const y of ys) {
      ctx.beginPath()
      ctx.moveTo(4, y)
      ctx.lineTo(w - 4, y)
      ctx.stroke()
    }
    imageCtx.y += lineH
    return Buffer.alloc(0)
  }
  // 針式（TM-U220 76mm）中文模式下半形字元最多約 33 欄，縮短分隔線避免超出紙寬換行
  const w = currentIsDot ? Math.min(width, 33) : width
  return textLine(ch.repeat(w), { width: w })
}

function feedLines (n = 1) {
  if (imageCtx) {
    // 圖像模式：直接走紙，避免送出整段空白點陣
    flushImageBand()
    if (dotImageMode) {
      // 針機：回到默認行距（1/6 吋）後走紙 n 行，供撕紙用
      imageCtx.bands.push(Buffer.from([ESC, 0x32, ESC, 0x64, Math.min(255, n)]))
      return Buffer.alloc(0)
    }
    imageCtx.bands.push(Buffer.from([ESC, 0x4a, Math.min(255, n * 32)]))
    return Buffer.alloc(0)
  }
  return Buffer.from([ESC, 0x64, n])
}

function cut () {
  if (imageCtx) {
    flushImageBand()
    // 針機無自動切紙，僅保留走紙；熱敏送 GS V B 切紙
    if (!dotImageMode) imageCtx.bands.push(Buffer.from([GS, 0x56, 0x42, 0x00]))
    return Buffer.alloc(0)
  }
  return Buffer.from([GS, 0x56, 0x42, 0x00])
}

// 紅色字（改碼/口味備註用）；針機點陣圖模式下切換色帶（ESC r）並分段輸出
function redOn () {
  if (imageCtx) {
    if (dotImageMode) {
      flushImageBand()
      imageCtx.bands.push(Buffer.from([ESC, 0x72, 0x01]))
      return Buffer.alloc(0)
    }
    return Buffer.alloc(0)
  }
  return Buffer.from([ESC, 0x72, 0x01])
}

function redOff () {
  if (imageCtx) {
    if (dotImageMode) {
      flushImageBand()
      imageCtx.bands.push(Buffer.from([ESC, 0x72, 0x00]))
      return Buffer.alloc(0)
    }
    return Buffer.alloc(0)
  }
  return Buffer.from([ESC, 0x72, 0x00])
}

// 結賬小票品項單價：加價改碼計入單價，免費/自訂價/折扣與點餐端 calcUnit 一致
function receiptUnitPrice (item) {
  const modsExtra = (item.mods || []).reduce((sum, m) => sum + (m && typeof m === 'object' && m.price ? Number(m.price) || 0 : 0), 0)
  const base = item.free ? 0 : ((item.customPrice > 0 ? item.customPrice : (item.price || 0)) + modsExtra)
  return Math.round(base * (item.discount || 1) * 100) / 100
}

// 品項小計：單價 × 數量（count 為顯示數量，與左側 x 數量一致）
function itemSubtotal (item, count) {
  return Math.round(receiptUnitPrice(item) * (count || 1) * 100) / 100
}

// 單一改碼轉印單文字：支援舊字串 '走蔥' 與新物件 {name, price, station}
function modText (m) {
  if (typeof m === 'string') return m
  if (!m) return ''
  const name = m.name || ''
  const price = Number(m.price || 0)
  return price > 0 ? `${name}(+$${price})` : name
}

// 套餐內容行 + 其改碼（紅色，與品項改碼一致）；modField 提供改碼欄位格式
function pushComboContents (p, item, w, modField) {
  if (!item.contents || !item.contents.length) return
  for (const c of item.contents) {
    p.push(textLine(`   - ${c.name}`, { width: w }))
    if (!c.mods || !c.mods.length) continue
    p.push(redOn())
    for (const m of c.mods) {
      const t = modText(m)
      if (t) p.push(fieldLine('　　　' + t, modField || { show: true, size: 1, align: 'left' }, w))
    }
    p.push(redOff())
  }
}

// 不列印套餐名：把套餐子品項當獨立品項打印（不印套餐名標題、不縮排），lineFn 供不同票種套用自己的行格式
function pushComboItemsFlat (p, item, w, modField, lineFn) {
  if (!item.contents || !item.contents.length) return
  const qty = item.count || 1
  for (const c of item.contents) {
    lineFn(`${c.name}  x${qty}`)
    if (c.mods && c.mods.length) {
      p.push(redOn())
      for (const m of c.mods) {
        const t = modText(m)
        if (t) p.push(fieldLine('　' + t, modField || { show: true, size: 1, align: 'left' }, w))
      }
      p.push(redOff())
    }
  }
}

// 套餐名稱只印一次（comboNameOnce）：依前一個品項是否同一套餐，決定是否先印套餐名標題行。
// 回傳 { header, label, count, isSub }：
//   header 非空代表此品項是該套餐第一個子品項（需先印「套餐名 x數量」標題行）
//   isSub 為 true 時 label 為縮排後的子品項名（不帶數量）
//   state 為 { last }，由呼叫端在每個票種的渲染迴圈外建立（null 表示不啟用分組）
function comboLine (item, state) {
  const name = item.name2 || item.name
  const count = (item._comboCount || 1) * (item.count || 1)
  if (state && item._comboName) {
    const header = state.last === item._comboName ? null : item._comboName
    state.last = item._comboName
    return { header, label: `   - ${name}`, count, isSub: true }
  }
  if (state) state.last = null
  return { header: null, label: item._comboName ? `${item._comboName}·${name}` : name, count, isSub: false }
}

// 生成 QR Code 光柵圖像（GS v 0），moduleSize 為每個模塊的點數
// 點餐碼 QR 尺寸：1=小 2=正常 3=中 4=大 5=特大 6=最大（對應模塊尺寸 2/3/4/5/6/7）
function qrModuleSize (size) {
  switch (size) {
    case 1: return 2
    case 2: return 3
    case 3: return 4
    case 4: return 5
    case 5: return 6
    case 6: return 7
    default: return 4
  }
}

function buildQRImage (text, moduleSize = 3) {
  try {
    const q = qrcode.create(text, { errorCorrectionLevel: 'M' })
    const size = q.modules.size
    // 單一 GS v 0 光柵高度上限（與 BAND_H 一致）：超過時縮小模塊尺寸，避免打印機截斷 QR 使內容缺損（token 被截斷會導致點餐碼掃碼失效）
    const ms = size * moduleSize > 255 ? Math.max(1, Math.floor(255 / size)) : moduleSize
    const big = size * ms
    const bytesPerRow = Math.ceil(big / 8)
    const rows = []
    for (let y = 0; y < big; y++) {
      const row = Buffer.alloc(bytesPerRow)
      const my = Math.floor(y / ms)
      for (let x = 0; x < big; x++) {
        const mx = Math.floor(x / ms)
        if (q.modules.data[my * size + mx]) {
          row[Math.floor(x / 8)] |= 0x80 >> (x % 8)
        }
      }
      rows.push(row)
    }
    const xL = bytesPerRow % 256
    const xH = Math.floor(bytesPerRow / 256)
    const yL = big % 256
    const yH = Math.floor(big / 256)
    const head = Buffer.from([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH])
    return Buffer.concat([head, ...rows])
  } catch (e) {
    return Buffer.alloc(0)
  }
}

// ---- CODE128 條碼（圖像式 GS v 0）----
// 以 Code Set B 編碼（支援 ASCII 32–127），輸出 1=bar / 0=space 的模塊位元字串
const CODE128_PATTERNS = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100', '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110', '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100', '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000', '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110', '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000', '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100', '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010', '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100', '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110', '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000', '11010011100', '11000111010'
]

function code128Bars (text) {
  const codes = [104] // Start B
  let checksum = 104
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i)
    if (c < 32 || c > 127) c = 32 // 不可列印字元回退為空格
    const v = c - 32
    codes.push(v)
    checksum += v * (i + 1)
  }
  codes.push(checksum % 103)
  codes.push(106) // Stop
  let bits = ''
  for (const c of codes) bits += CODE128_PATTERNS[c]
  bits += '11' // 終止符（2 模塊）
  return bits
}

// 生成 CODE128 條碼光柵圖像（GS v 0）。moduleWidth=每模塊點數、height=條碼高度點數。
function buildBarcodeImage (text, moduleWidth = 2, height = 48) {
  try {
    if (!text) return Buffer.alloc(0)
    const bits = code128Bars(String(text))
    const quiet = 10 // 左右靜默區（模塊數，掃描辨識所需）
    const totalModules = bits.length + quiet * 2
    const big = totalModules * moduleWidth
    const bytesPerRow = Math.ceil(big / 8)
    const rows = []
    for (let y = 0; y < height; y++) {
      const row = Buffer.alloc(bytesPerRow)
      for (let x = 0; x < big; x++) {
        const m = Math.floor(x / moduleWidth) - quiet
        if (m >= 0 && m < bits.length && bits[m] === '1') {
          row[Math.floor(x / 8)] |= 0x80 >> (x % 8)
        }
      }
      rows.push(row)
    }
    const xL = bytesPerRow % 256
    const xH = Math.floor(bytesPerRow / 256)
    const yL = height % 256
    const yH = Math.floor(height / 256)
    const head = Buffer.from([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH])
    return Buffer.concat([head, ...rows])
  } catch (e) {
    return Buffer.alloc(0)
  }
}

// 居中打印 QR（在指定紙寬下居中）
function qrLine (data, paperWidth) {
  if (imageCtx) {
    flushImageBand()
    imageCtx.bands.push(Buffer.from([ESC, 0x61, 0x01]))
    imageCtx.bands.push(data)
    imageCtx.bands.push(Buffer.from([ESC, 0x61, 0x00]))
    return Buffer.alloc(0)
  }
  return concat([[ESC, 0x61, 0x01], data, [ESC, 0x61, 0x00]])
}

// 對 Logo 像素做 gamma 暗化（gamma>1 壓深中灰），補償低對比/縮圖變淺，讓淺灰內容印得更深
function darkenLogo (rgba, w, h, gamma) {
  for (let i = 0; i < w * h; i++) {
    const a = rgba[i * 4 + 3]
    if (a <= 128) continue
    const r = rgba[i * 4]
    const g = rgba[i * 4 + 1]
    const b = rgba[i * 4 + 2]
    const lum = (r * 299 + g * 587 + b * 114) / 1000
    const nl = Math.round(255 * Math.pow(lum / 255, gamma))
    rgba[i * 4] = nl
    rgba[i * 4 + 1] = nl
    rgba[i * 4 + 2] = nl
  }
}

// Otsu 自動門檻：依亮度直方圖求最佳二值化門檻，處理低對比（淺灰/彩色）Logo
function otsuThreshold (rgba, w, h) {
  const hist = new Array(256).fill(0)
  let n = 0
  for (let i = 0; i < w * h; i++) {
    const a = rgba[i * 4 + 3]
    if (a <= 128) continue
    const r = rgba[i * 4]
    const g = rgba[i * 4 + 1]
    const b = rgba[i * 4 + 2]
    const lum = Math.round((r * 299 + g * 587 + b * 114) / 1000)
    hist[lum]++
    n++
  }
  if (!n) return 160
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sumB = 0
  let wB = 0
  let maxVar = -1
  let threshold = 160
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (wB === 0) continue
    const wF = n - wB
    if (wF === 0) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) * (mB - mF)
    if (between > maxVar) {
      maxVar = between
      threshold = t
    }
  }
  return threshold
}

// 載入店舖 Logo 並轉成單色點陣（熱敏 GS v 0 / 針式 ESC * m=0），依紙寬縮放
async function buildLogoImage (setting) {
  // 店舖 Logo 總開關：關閉後所有小票都不印 Logo
  if (setting && setting.logoEnabledAll === false) return Buffer.alloc(0)
  const logo = setting && setting.logo
  if (!logo) return Buffer.alloc(0)
  try {
    const absPath = path.join(config.publicDir, logo)
    if (!fs.existsSync(absPath)) return Buffer.alloc(0)
    const img = await loadImage(absPath)
    if (!img || !img.width || !img.height) return Buffer.alloc(0)
    const isDot = !!(setting && setting.tech === 'dot')
    const w = isDot ? dotPixelWidth(setting.paperWidth) : pixelWidth(setting.paperWidth, setting.dpi)
    // 限制 Logo 尺寸：寬最多 78% 紙寬、高最多 52% 紙寬，避免太大且單一圖帶過高被打印機截斷
    const maxW = Math.round(w * 0.78)
    const maxH = Math.round(w * 0.52)
    const scale = Math.min(maxW / img.width, maxH / img.height, 1)
    const dw = Math.max(1, Math.round(img.width * scale))
    const dh = Math.max(1, Math.round(img.height * scale))
    const canvas = createCanvas(dw, dh)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, dw, dh)
    ctx.drawImage(img, 0, 0, dw, dh)
    const imgData = ctx.getImageData(0, 0, dw, dh)
    const buf = Buffer.from(imgData.data)
    // 先 gamma 暗化（壓深中灰）再以 Otsu 二值化，避免低對比/縮圖變淺導致 Logo 印得太淺
    darkenLogo(buf, dw, dh, 1.8)
    const threshold = otsuThreshold(buf, dw, dh)
    // 依帶高分段輸出（安全起見保留，正常尺寸下 dh < BAND_H 不會分段）
    const out = []
    for (let y0 = 0; y0 < dh; y0 += BAND_H) {
      const bh = Math.min(BAND_H, dh - y0)
      const band = buf.subarray(y0 * dw * 4, (y0 + bh) * dw * 4)
      out.push(isDot ? dotImageToRaster(band, dw, bh, threshold) : imageToRaster(band, dw, bh, threshold))
    }
    return Buffer.concat(out)
  } catch (e) {
    console.log('[Printer] Logo 載入失敗：' + e.message)
    return Buffer.alloc(0)
  }
}

function lineWidthOf (paperWidth) {
  return paperWidth === 80 ? 48 : 32
}

// 列印相關 PosSetting 快取（票據生成為同步流程，需避免逐票查庫；由 server 啟動與 PosSetting 存檔時更新）
let _posSettingCache = null
function setPosSettingCache (s) { _posSettingCache = s || null }

// 外賣枱枱號前綴：枱號落在設定範圍內（預設 901–999）時，票據枱號前顯示「外賣」二字
// 以枱號範圍判斷（不依 zone），因外賣枱枱號目前仍以 zone=堂食 入單（POS enterTable 未依枱面 zone 切換）
function deskLabel (setting, order) {
  const desk = order && order.deskNo
  if (desk === undefined || desk === null || String(desk) === '' || String(desk) === '0') {
    // 外賣叫號：deskNo=0 且有叫號時，顯示叫號（取代「0」）
    if (order && order.takeawayNo) return String(order.takeawayNo)
    return String(desk == null ? '' : desk)
  }
  const ps = _posSettingCache || setting || {}
  const from = ps.takeawayTableFrom || '901'
  const to = ps.takeawayTableTo || '999'
  const n = Number(desk)
  const nf = Number(from)
  const nt = Number(to)
  if (!Number.isNaN(n) && !Number.isNaN(nf) && !Number.isNaN(nt) && n >= nf && n <= nt) {
    return `外賣${desk}`
  }
  return String(desk)
}

// 生成各簡單欄位的文字內容（供單欄或同列分組使用）
function buildTexts (setting, order, fmt, type) {
  const d = order.date || new Date()
  const isFull = type === 'receipt' || type === 'qrcode'
  const timeLabel = '開單時間'
  let timeText
  if (type === 'serving' || type === 'receipt' || type === 'print') {
    timeText = moment(d).format('HH:mm')
  } else if (type === 'tableqr') {
    timeText = moment(d).format('HH:mm:ss')
  } else if (isFull) {
    timeText = moment(d).format('YYYY-MM-DD HH:mm:ss')
  } else {
    timeText = moment(d).format('MM-DD HH:mm:ss')
  }
  return {
    title: fmt.title,
    shopName: setting.shopName || '',
    address: setting.address || '',
    phone: setting.phone ? `電話：${setting.phone}` : '',
    deskNo: type === 'serving' ? `${deskLabel(setting, order)}` : `台號：${deskLabel(setting, order)}`,
    orderNo: `訂單號：${order.orderNo}`,
    people: `人數：${order.pax || 0}`,
    date: `日期：${moment(d).format('YYYY-MM-DD')}`,
    total: `合計：$${Number((order.totalPrice || 0) - (order.serviceCharge || 0)).toFixed(2)}`,
    serviceCharge: `服務費：$${Number(order.serviceCharge || 0).toFixed(2)}`,
    grandTotal: `總金額：$${Number((order.totalPrice || 0) + (order.rounding || 0)).toFixed(2)}`,
    remark: order.remark ? `備註：${order.remark}` : '',
    time: `${timeLabel}：${timeText}`,
    sendTime: `送單時間：${orderSendTime(order)}`,
    waiter: order.waiter ? `開單員工：${order.waiter}` : '',
    sendWaiter: order.waiter ? `送單員工：${order.waiter}` : '',
    footer: setting.footer || ''
  }
}

// 品項入單時間（供菜品明細2 顯示），無紀錄時退回整單下單時間
function itemAddTime (item, order) {
  const t = item.addTime || item.time || (order && order.date) || new Date()
  return moment(t).format('HH:mm:ss')
}

// 品項入單員工（項目明細顯示即時入單員工，而非開枱員工）
function itemWaiterText (item) {
  const w = item && item.waiter
  return w ? String(w) : ''
}

// 送單時間：取訂單內品項最晚的入單時間（無紀錄時退回整單下單時間）
function orderSendTime (order) {
  const items = (order && order.order) || []
  let latest = null
  for (const item of items) {
    const t = item && (item.addTime || item.time)
    if (!t) continue
    const ts = new Date(t).getTime()
    if (!Number.isNaN(ts) && (latest === null || ts > latest)) latest = ts
  }
  if (latest === null) {
    const d = (order && order.date) || new Date()
    return moment(d).format('HH:mm:ss')
  }
  return moment(latest).format('HH:mm:ss')
}

// 開單員工與菜品明細2（含入單時間）共用渲染器
function extraRenderers (f, w, order, type, setting) {
  return {
    waiter: (p) => { if (f('waiter').show && order.waiter) p.push(fieldLine(`開單員工：${order.waiter}`, f('waiter'), w)) },
    sendWaiter: (p) => { if (f('sendWaiter').show && order.waiter) p.push(fieldLine(`送單員工：${order.waiter}`, f('sendWaiter'), w)) },
    people: (p) => { if (f('people').show) p.push(fieldLine(`人數：${order.pax || 0}`, f('people'), w)) },
    sendTime: (p) => { if (f('sendTime').show) p.push(fieldLine(`送單時間：${orderSendTime(order)}`, f('sendTime'), w)) },
    items2: (p) => {
      if (!f('items2').show) return
      const items = order.order || []
      const size = f('items2').size || 1
      const comboState = (setting && setting.comboNameOnce) ? { last: null } : null
      for (const item of items) {
        const d = comboLine(item, comboState)
        if (d.header) {
          const headerText = type === 'kitchen' ? `x${d.count}  ${d.header}` : `${d.header}  x${d.count}`
          const hcells = [{ text: headerText, align: 'left', size }]
          if (imageCtx) p.push(drawTextRow(hcells))
          else p.push(textRow(hcells, w))
        }
        const iw = itemWaiterText(item)
        const itemLabel = (d.isSub ? d.label : (type === 'kitchen' ? `x${d.count}  ${d.label}` : `${d.label}  x${d.count}`)) + (iw ? ` [${iw}]` : '')
        const cells = [
          { text: itemLabel, align: 'left', size },
          { text: itemAddTime(item, order), align: 'right', size }
        ]
        if (imageCtx) p.push(drawTextRow(cells))
        else p.push(textRow(cells, w))
        if (item.mods && item.mods.length) {
          p.push(redOn())
          for (const m of item.mods) {
            const t = modText(m)
            if (t) p.push(fieldLine('　' + t, f('mods'), w))
          }
          p.push(redOff())
        }
        if (item.contents && item.contents.length) pushComboContents(p, item, w, f('mods'))
      }
    },
    items3: (p) => {
      if (!f('items3').show) return
      const items = order.order || []
      if (!items.length) return
      // 針機點陣圖放大：與菜品明細一致，維持相同字體大小
      const useDot = currentIsDot && !!(setting && setting.dotImagePrint)
      if (useDot) p.push(beginDotImage(setting))
      const comboState = (setting && setting.comboNameOnce) ? { last: null } : null
      for (const item of items) {
        const d = comboLine(item, comboState)
        if (d.header) {
          // 套餐標題行：數量 2 或以上整行紅色
          const red = d.count >= 2
          if (red) p.push(redOn())
          p.push(fieldLine(`x${d.count}  ${d.header}`, f('items3'), w))
          if (red) p.push(redOff())
        }
        if (d.isSub) {
          // 子品項：縮排顯示，不重複金額
          p.push(fieldLine(d.label, f('items3'), w))
        } else if (type === 'kitchen') {
          // 後廚：數量 + 品項 + 金額 單行
          const red = d.count >= 2
          if (red) p.push(redOn())
          p.push(fieldLine(`x${d.count}  ${d.label}  $${Math.round(itemSubtotal(item, d.count))}`, f('items3'), w))
          if (red) p.push(redOff())
        } else {
          // 數量 2 或以上整行紅色，否則整行黑色（TM-U220 ESC r 為行導向，整行同色最可靠）
          const red = d.count >= 2
          if (red) p.push(redOn())
          p.push(fieldLine(`x${d.count}  ${d.label}`, f('items3'), w))
          p.push(fieldLine(`$${Math.round(itemSubtotal(item, d.count))}`, Object.assign({}, f('items3'), { align: 'right' }), w))
          if (red) p.push(redOff())
        }
        if (item.mods && item.mods.length) {
          p.push(redOn())
          for (const m of item.mods) {
            const t = modText(m)
            if (t) p.push(fieldLine('　' + t, f('mods'), w))
          }
          p.push(redOff())
        }
        if (item.contents && item.contents.length) pushComboContents(p, item, w, f('mods'))
      }
      if (useDot) p.push(endDotImage())
    }
  }
}

// 文字模式：把同列多個單元各自補齊寬度後拼接成一行（ESC/POS 整行同一字號，取最大字號）
function textRow (cells, w) {
  let maxSize = 1
  let bold = false
  cells.forEach(c => { if ((c.size || 1) > maxSize) maxSize = c.size; if (c.bold) bold = true })
  const scale = SIZE_SCALE[maxSize] || SIZE_SCALE[1]
  const dw = scale.w >= 1.5
  const dh = scale.h >= 2
  const totalW = Math.floor(w / (dw ? 2 : 1))
  const cellW = Math.floor(totalW / cells.length)
  const s = cells.map(c => pad(c.text, cellW, c.align)).join('')
  return textLine(s, { doubleWidth: dw, doubleHeight: dh, bold })
}

// 圖像模式：把同列多個單元畫在同一水平線（各自依 align/size 對齊所屬欄位）
function drawTextRow (cells) {
  const ctx = imageCtx.ctx
  const w = imageCtx.canvas.width
  const cellW = Math.floor(w / cells.length)
  const fontSize = dotImageMode ? dotImageBaseSize : 24
  let maxScaleH = 1
  let bold = false
  cells.forEach(c => { const s = dotImageMode ? { w: 1, h: 1 } : (SIZE_SCALE[c.size] || SIZE_SCALE[1]); if (s.h > maxScaleH) maxScaleH = s.h; if (c.bold) bold = true })
  const lineHeight = dotImageMode ? Math.round(dotImageBaseSize * 1.2 * maxScaleH) : Math.round(32 * maxScaleH)
  ensureImageSpace(lineHeight)
  const { weight, stroke: strokeWidth } = resolveWeight(imageCtx.weight, bold)
  ctx.font = weight + ' ' + fontSize + 'px ' + currentFontFamily
  ctx.fillStyle = imageCtx.color || '#000'
  ctx.strokeStyle = imageCtx.color || '#000'
  ctx.lineJoin = 'round'
  ctx.lineWidth = strokeWidth
  ctx.textBaseline = 'top'
  const y = imageCtx.y
  cells.forEach((c, i) => {
    const s = dotImageMode ? { w: 1, h: 1 } : (SIZE_SCALE[c.size] || SIZE_SCALE[1])
    const strVal = String(c.text == null ? '' : c.text)
    const tw = ctx.measureText(strVal).width
    const scaledW = tw * s.w
    const cellX = i * cellW
    let x = cellX + 4
    if (c.align === 'center') x = cellX + Math.max(0, (cellW - scaledW) / 2)
    else if (c.align === 'right') x = cellX + Math.max(0, cellW - scaledW - 4)
    ctx.save()
    ctx.translate(x, y)
    if (s.w !== 1 || s.h !== 1) ctx.scale(s.w, s.h)
    if (strokeWidth > 0) ctx.strokeText(strVal, 0, 0)
    ctx.fillText(strVal, 0, 0)
    ctx.restore()
  })
  imageCtx.y += lineHeight
  return Buffer.alloc(0)
}

// 同列分組：僅渲染有文字內容的簡單欄位，依各自 align 在同一行左右排列
function renderRow (parts, keys, texts, fields, w) {
  const cells = []
  for (const k of keys) {
    if (!k || k.indexOf('divider') === 0) continue
    if (!texts || !Object.prototype.hasOwnProperty.call(texts, k) || texts[k] == null) continue
    const opt = (fields && fields[k]) || { show: true, size: 1, align: 'left' }
    if (opt.show === false) continue
    cells.push({ text: texts[k], align: opt.align || 'left', size: opt.size || 1, bold: !!opt.bold })
  }
  if (!cells.length) return
  if (imageCtx) parts.push(drawTextRow(cells))
  else parts.push(textRow(cells, w))
}

// 依 order 依序渲染欄位；order 項目可為字串（單欄）或陣列（同列分組）
// key 以 divider 開頭者為分隔線欄位（show/type 可配置）
function renderFields (parts, orderList, renderers, texts, fields, w) {
  for (let i = 0; i < orderList.length; i++) {
    const item = orderList[i]
    if (Array.isArray(item)) {
      renderRow(parts, item, texts, fields, w)
      continue
    }
    if (item && item.indexOf('divider') === 0) {
      const opt = (fields && fields[item]) || { show: true, type: '-' }
      if (opt.show !== false) parts.push(divider(w, opt.type === '=' ? '=' : '-'))
      continue
    }
    if (item && item.indexOf('custom') === 0) {
      // 用戶自定義文字欄位（key 以 custom 開頭，text 為用戶輸入內容）
      const opt = (fields && fields[item]) || { show: true, size: 1, align: 'left', text: '' }
      if (opt.show !== false && opt.text) parts.push(fieldLine(opt.text, opt, w))
      continue
    }
    const r = renderers[item]
    if (!r) continue
    r(parts)
  }
}

// 生成後廚備菜小票
function buildKitchenOrder (setting, order, station) {
  const fmt = mergeFormat('kitchen', setting)
  const fields = fmt.fields || {}
  const f = (key) => fields[key] || { show: true, size: 1, align: 'left' }
  const w = lineWidthOf(setting.paperWidth)
  const parts = [initPrinter(setting)]
  const texts = buildTexts(setting, order, fmt, 'kitchen')
  // 檔口欄位：供同列分組（renderRow）與獨立欄位（renderers.station）共用，避免被分組時遺漏
  texts.station = station ? `【${station}檔】` : null
  texts.orderNoStation = `單號 ${order.orderNo} 檔口 ${station}`
  texts.dateSendTimeWaiter = `${moment(order.date || new Date()).format('YYYY-MM-DD')} ${orderSendTime(order)}${order.waiter ? ' ' + order.waiter : ''}`
  const renderers = {
    shopName: (p) => {
      if (f('shopName').show) p.push(textLine(setting.shopName || '後廚小票', { align: 'center', width: Math.floor(w / 2), doubleWidth: true, doubleHeight: true }))
    },
    station: (p) => { if (f('station').show && station) p.push(fieldLine(`【${station}檔】`, f('station'), w)) },
    orderNoStation: (p) => { if (f('orderNoStation').show) p.push(fieldLine(`單號 ${order.orderNo} 檔口 ${station}`, f('orderNoStation'), w)) },
    dateSendTimeWaiter: (p) => { if (f('dateSendTimeWaiter').show) p.push(fieldLine(`${moment(order.date || new Date()).format('YYYY-MM-DD')} ${orderSendTime(order)}${order.waiter ? ' ' + order.waiter : ''}`, f('dateSendTimeWaiter'), w)) },
    title: (p) => { if (f('title').show && fmt.title) p.push(fieldLine(fmt.title, f('title'), w)) },
    deskNo: (p) => {
      if (!f('deskNo').show) return
      // 針機點陣圖放大：枱號與菜品明細以 ESC * m=0 輸出（其餘欄位維持內建字庫）
      const useDot = currentIsDot && !!(setting && setting.dotImagePrint)
      const zone = order.zone || '堂食'
      const hasDesk = order.deskNo !== undefined && order.deskNo !== null && String(order.deskNo) !== '' && String(order.deskNo) !== '0'
      // 堂食只印枱號；外賣枱/外賣等非堂食先印區域，再印枱號（無枱號時只印區域，避免出現「0」）
      const lines = (zone === '堂食') ? [deskLabel(setting, order)] : (hasDesk ? [zone, deskLabel(setting, order)] : (order.takeawayNo ? [`${zone} ${order.takeawayNo}`] : [zone]))
      if (useDot) p.push(beginDotImage(setting, true))
      else p.push(redOn())
      for (const line of lines) p.push(fieldLine(line, f('deskNo'), w))
      if (useDot) p.push(endDotImage())
      else p.push(redOff())
    },
    deskNo2: (p) => {
      if (!f('deskNo2').show) return
      // 無枱號（外賣枱/外賣 deskNo=0）不印右下台號，避免出現「0」
      const hasDesk = order.deskNo !== undefined && order.deskNo !== null && String(order.deskNo) !== '' && String(order.deskNo) !== '0'
      if (!hasDesk) return
      // 與左上角枱號一致：針機點陣圖放大輸出
      const useDot = currentIsDot && !!(setting && setting.dotImagePrint)
      if (useDot) p.push(beginDotImage(setting, true))
      else p.push(redOn())
      p.push(fieldLine(deskLabel(setting, order), f('deskNo2'), w))
      if (useDot) p.push(endDotImage())
      else p.push(redOff())
    },
    orderNo: (p) => { if (f('orderNo').show) p.push(fieldLine(`訂單號：${order.orderNo}`, f('orderNo'), w)) },
    items: (p) => {
      if (!f('items').show) return
      const items = order.order || []
      if (!items.length) return
      // 針機點陣圖放大：僅菜品明細以 ESC * m=0 輸出（其餘欄位維持內建字庫）
      const useDot = currentIsDot && !!(setting && setting.dotImagePrint)
      if (useDot) p.push(beginDotImage(setting))
      const comboState = (setting && setting.comboNameOnce) ? { last: null } : null
      for (const item of items) {
        const d = comboLine(item, comboState)
        if (d.header) {
          p.push(redOn())
          p.push(fieldLine(`x${d.count}  ${d.header}`, f('items'), w))
          p.push(redOff())
        }
        p.push(fieldLine(d.isSub ? d.label : `x${d.count}  ${d.label}`, f('items'), w))
        if (item.mods && item.mods.length) {
          p.push(redOn())
          for (const m of item.mods) {
            const t = modText(m)
            if (t) p.push(fieldLine('　' + t, f('mods'), w))
          }
          p.push(redOff())
        }
        if (item.contents && item.contents.length) pushComboContents(p, item, w, f('mods'))
      }
      if (useDot) p.push(endDotImage())
    },
    remark: (p) => { if (f('remark').show && order.remark) p.push(fieldLine(`備註：${order.remark}`, f('remark'), w)) },
    time: (p) => { if (f('time').show) p.push(fieldLine(texts.time, f('time'), w)) },
    total: (p) => {
      if (f('total').show) p.push(fieldLine(`合計：$${Math.round(Number((order.totalPrice || 0) - (order.serviceCharge || 0)))}`, f('total'), w))
    }
  }
  Object.assign(renderers, extraRenderers(f, w, order, 'kitchen', setting))
  renderFields(parts, fmt.order, renderers, texts, fields, w)
  parts.push(feedLines(3))
  parts.push(cut())
  return concat(parts)
}

// 廚房分檔拆分：按條目 station/stations（可多檔口，最多3個）分組，路由到對應檔口打印機
function buildKitchenByStation (setting, order) {
  const rawItems = order.order || []
  const expanded = []
  rawItems.forEach(item => {
    if (item.contents && item.contents.length) {
      item.contents.forEach(c => {
        expanded.push(Object.assign({}, c, {
          _comboName: item.noPrintComboName ? '' : (item.name2 || item.name),
          _comboCount: item.count || 1
        }))
      })
    } else {
      expanded.push(item)
    }
  })
  const grouped = {}
  expanded.forEach(item => {
    const stations = (item.stations && item.stations.length)
      ? item.stations
      : [item.station || '通用']
    stations.forEach(station => {
      if (!grouped[station]) grouped[station] = []
      grouped[station].push(item)
    })
  })
  const orderZone = (order.zone === '外賣' || order.zone === '外賣枱') ? '外賣' : '堂食'
  const tickets = []
  Object.keys(grouped).forEach(station => {
    const printer = resolvePrinter(setting, station) // 按檔口名匹配
    // 長短單：堂食單 / 外賣單各自獨立設定（long=長單 / short=短單 / ''=不印）
    const mode = orderZone === '堂食' ? (printer.dineInMode || '') : (printer.takeawayMode || '')
    if (!mode) return
    const items = grouped[station]
    const isShort = mode === 'short'
    if (isShort) {
      // 短單：每個品項獨立一張後廚小票
      items.forEach(item => {
        const stationOrder = Object.assign({}, toPlain(order), { order: [item] })
        tickets.push({ station, printer, data: buildKitchenOrder(printer, stationOrder, station) })
      })
    } else {
      // 長單：整檔全部品項一張後廚小票
      const stationOrder = Object.assign({}, toPlain(order), { order: items })
      tickets.push({ station, printer, data: buildKitchenOrder(printer, stationOrder, station) })
    }
  })
  return tickets
}

// 全單明細（不切單，整桌完整菜單，用於劃單核對/預結單）
function buildExpeditorOrder (setting, order, title) {
  const printer = resolvePrinter(setting, 'expeditor')
  const w = lineWidthOf(printer.paperWidth)
  const parts = []
  parts.push(initPrinter(printer))
  parts.push(textLine(printer.shopName || '全單明細', { align: 'center', width: Math.floor(w / 2), doubleWidth: true, doubleHeight: true }))
  parts.push(textLine(title || '【傳菜總檯·全單明細】', { align: 'center', width: w }))
  parts.push(divider(w, '='))
  parts.push(textLine(`台號：${deskLabel(setting, order)}`, { width: w }))
  parts.push(textLine(`訂單號：${order.orderNo}`, { width: w }))
  parts.push(divider(w))
  const items = order.order || []
  for (const item of items) {
    if (item.contents && item.contents.length && item.noPrintComboName) {
      pushComboItemsFlat(parts, item, w, null, (s) => parts.push(textLine(s, { width: w })))
    } else {
      parts.push(textLine(`${(item.name2 || item.name)}  x${item.count}`, { width: w }))
      if (item.contents && item.contents.length) pushComboContents(parts, item, w)
    }
  }
  parts.push(divider(w))
  if (order.remark) parts.push(textLine(`備註：${order.remark}`, { width: w }))
  parts.push(textLine(`開單時間：${moment(order.date).format('MM-DD HH:mm:ss')}`, { width: w }))
  parts.push(divider(w, '='))
  parts.push(feedLines(3))
  parts.push(cut())
  return concat(parts)
}

// 生成上菜紙（服務員端菜用，不含價格，桌號放大）
async function buildServingOrder (setting, order, newCount) {
  const fmt = mergeFormat('serving', setting)
  const fields = fmt.fields || {}
  const f = (key) => fields[key] || { show: true, size: 1, align: 'left' }
  const w = lineWidthOf(setting.paperWidth)
  const parts = [initPrinter(setting)]
  // 只列印後加項目：newCount>0 時只取訂單最後 N 個品項（其餘欄位沿用整單資料）
  const allItems = order.order || []
  const effectiveOrder = (newCount > 0)
    ? Object.assign({}, order.toObject ? order.toObject() : order, { order: allItems.slice(-newCount) })
    : order
  // 店舖 Logo（若已設定且啟用 logoEnabledServing 則印在最上方）
  if (setting.logoEnabledServing) {
    const logoData = await buildLogoImage(setting)
    if (logoData.length) parts.push(qrLine(logoData, setting.paperWidth))
  }
  const texts = buildTexts(setting, effectiveOrder, fmt, 'serving')
  const renderers = {
    shopName: (p) => { if (f('shopName').show) p.push(textLine(setting.shopName || '上菜紙', { align: 'center', width: Math.floor(w / 2), doubleWidth: true, doubleHeight: true })) },
    title: (p) => { if (f('title').show && fmt.title) p.push(fieldLine(fmt.title, f('title'), w)) },
    deskNo: (p) => { if (f('deskNo').show) p.push(fieldLine(`${deskLabel(setting, order)}`, f('deskNo'), w)) },
    orderNo: (p) => { if (f('orderNo').show) p.push(fieldLine(`訂單號：${order.orderNo}`, f('orderNo'), w)) },
    people: (p) => { if (f('people').show) p.push(fieldLine(`人數：${order.pax || 0}`, f('people'), w)) },
    date: (p) => { if (f('date').show) p.push(fieldLine(texts.date, f('date'), w)) },
    items: (p) => {
      if (!f('items').show) return
      const items = effectiveOrder.order || []
      for (const item of items) {
        if (item.contents && item.contents.length && item.noPrintComboName) {
          pushComboItemsFlat(p, item, w, f('mods'), (s) => p.push(fieldLine(s, f('items'), w)))
          continue
        }
        p.push(fieldLine(`${item.name}  x${item.count}`, f('items'), w))
        // 改碼（口味備註）紅色字
        if (item.mods && item.mods.length) {
          p.push(redOn())
          for (const m of item.mods) {
            const t = modText(m)
            if (t) p.push(fieldLine('　' + t, f('mods'), w))
          }
          p.push(redOff())
        }
        if (item.contents && item.contents.length) pushComboContents(p, item, w, f('mods'))
      }
    },
    remark: (p) => { if (f('remark').show && order.remark) p.push(fieldLine(`備註：${order.remark}`, f('remark'), w)) },
    time: (p) => { if (f('time').show) p.push(fieldLine(texts.time, f('time'), w)) },
    footer: (p) => { if (f('footer').show && setting.footer) p.push(fieldLine(setting.footer, f('footer'), w)) }
  }
  Object.assign(renderers, extraRenderers(f, w, effectiveOrder, 'serving', setting))
  renderFields(parts, fmt.order, renderers, texts, fields, w)
  parts.push(feedLines(3))
  parts.push(cut())
  return concat(parts)
}

// 生成印單小票（打印單：廚房已收到，用於標記已印單）
async function buildPrintOrder (setting, order) {
  const fmt = mergeFormat('print', setting)
  const fields = fmt.fields || {}
  const f = (key) => fields[key] || { show: true, size: 1, align: 'left' }
  const w = lineWidthOf(setting.paperWidth)
  const parts = [initPrinter(setting)]
  // 條碼：固定印在單據最左上角、大台號之上（掃描跳枱用），僅熱敏打印機支援
  if (f('barcode').show && setting.tech !== 'dot') {
    const desk = order && order.deskNo
    const hasDesk = desk !== undefined && desk !== null && String(desk) !== '' && String(desk) !== '0'
    if (hasDesk) {
      const barSize = Number(f('barcode').size || 1)
      const moduleWidth = (barSize >= 3 ? 4 : barSize === 2 ? 3 : 2) * 2
      const barHeight = Math.round((barSize >= 3 ? 96 : barSize === 2 ? 72 : 48) * 1.5)
      parts.push(qrLine(buildBarcodeImage(String(desk), moduleWidth, barHeight), setting.paperWidth))
    }
  }
  // 大台號：固定印在單據最左上角（Logo 之上），不受字段排序影響
  if (f('deskNoBig').show) {
    parts.push(fieldLine(`${deskLabel(setting, order)}`, Object.assign({}, f('deskNoBig'), { align: 'left' }), w))
  }
  // 店舖 Logo（若已設定且啟用 logoEnabledPrint 則印在最上方）
  if (setting.logoEnabledPrint) {
    const logoData = await buildLogoImage(setting)
    if (logoData.length) parts.push(qrLine(logoData, setting.paperWidth))
  }
  const texts = buildTexts(setting, order, fmt, 'print')
  const renderers = {
    shopName: (p) => { if (f('shopName').show) p.push(textLine(setting.shopName || '印單小票', { align: 'center', width: Math.floor(w / 2), doubleWidth: true, doubleHeight: true })) },
    title: (p) => { if (f('title').show && fmt.title) p.push(fieldLine(fmt.title, f('title'), w)) },
    address: (p) => { if (f('address').show && setting.address) p.push(fieldLine(setting.address, f('address'), w)) },
    phone: (p) => { if (f('phone').show && setting.phone) p.push(fieldLine(`電話：${setting.phone}`, f('phone'), w)) },
    deskNo: (p) => { if (f('deskNo').show) p.push(fieldLine(`台號：${deskLabel(setting, order)}`, f('deskNo'), w)) },
    deskNoBig: (p) => { if (f('deskNoBig').show) p.push(fieldLine(`${deskLabel(setting, order)}`, f('deskNoBig'), w)) },
    orderNo: (p) => { if (f('orderNo').show) p.push(fieldLine(`訂單號：${order.orderNo}`, f('orderNo'), w)) },
    seq: (p) => { if (f('seq').show && order.orderSeq) p.push(fieldLine(`流水號：${order.orderSeq}`, f('seq'), w)) },
    items: (p) => {
      if (!f('items').show) return
      const items = order.order || []
      const size = f('items').size || 1
      for (const item of items) {
        const unit = receiptUnitPrice(item)
        const sub = Math.round(unit * (item.count || 1) * 100) / 100
        const cells = [
          { text: item.name, align: 'left', size },
          { text: `${item.count}`, align: 'right', size },
          { text: `$${sub.toFixed(2)}`, align: 'right', size }
        ]
        if (imageCtx) p.push(drawTextRow(cells))
        else p.push(textRow(cells, w))
        if (item.mods && item.mods.length) {
          p.push(redOn())
          for (const m of item.mods) {
            const t = modText(m)
            if (t) p.push(fieldLine('　' + t, f('mods'), w))
          }
          p.push(redOff())
        }
        if (item.contents && item.contents.length) pushComboContents(p, item, w, f('mods'))
      }
    },
    remark: (p) => { if (f('remark').show && order.remark) p.push(fieldLine(`備註：${order.remark}`, f('remark'), w)) },
    time: (p) => { if (f('time').show) p.push(fieldLine(texts.time, f('time'), w)) },
    date: (p) => { if (f('date').show) p.push(fieldLine(texts.date, f('date'), w)) },
    total: (p) => { if (f('total').show) p.push(fieldLine(texts.total, f('total'), w)) },
    serviceCharge: (p) => {
      if (f('serviceCharge').show && Number(order.serviceCharge || 0) > 0) p.push(fieldLine(texts.serviceCharge, f('serviceCharge'), w))
    },
    grandTotal: (p) => { if (f('grandTotal').show) p.push(fieldLine(texts.grandTotal, f('grandTotal'), w)) },
    reprint: (p) => {
      const n = Number(order.reprintCount || 0)
      if (f('reprint').show && n > 0) p.push(fieldLine(`**重印** ${n}：${order.reprintBy || ''}`, f('reprint'), w))
    }
  }
  Object.assign(renderers, extraRenderers(f, w, order, 'print', setting))
  // 大台號與條碼已提前印在左上角，跳過原欄位避免重複列印
  renderFields(parts, (fmt.order || []).filter(k => k !== 'deskNoBig' && k !== 'barcode'), renderers, texts, fields, w)
  parts.push(feedLines(3))
  parts.push(cut())
  return concat(parts)
}

// 生成二維碼小票（供顧客掃碼，內容為訂單號）
async function buildQrcodeOrder (setting, order) {
  const fmt = mergeFormat('qrcode', setting)
  const fields = fmt.fields || {}
  const f = (key) => fields[key] || { show: true, size: 1, align: 'left' }
  const w = lineWidthOf(setting.paperWidth)
  const parts = [initPrinter(setting)]
  // 店舖 Logo（若已設定且啟用 logoEnabledQrcode 則印在最上方）
  if (setting.logoEnabledQrcode) {
    const logoData = await buildLogoImage(setting)
    if (logoData.length) parts.push(qrLine(logoData, setting.paperWidth))
  }
  const texts = buildTexts(setting, order, fmt, 'qrcode')
  const renderers = {
    shopName: (p) => { if (f('shopName').show) p.push(textLine(setting.shopName || '二維碼小票', { align: 'center', width: Math.floor(w / 2), doubleWidth: true, doubleHeight: true })) },
    title: (p) => { if (f('title').show && fmt.title) p.push(fieldLine(fmt.title, f('title'), w)) },
    deskNo: (p) => { if (f('deskNo').show) p.push(fieldLine(`台號：${deskLabel(setting, order)}`, f('deskNo'), w)) },
    orderNo: (p) => { if (f('orderNo').show) p.push(fieldLine(`訂單號：${order.orderNo}`, f('orderNo'), w)) },
    qr: (p) => {
      if (f('qr').show === false) return
      p.push(qrLine(buildQRImage(order.orderNo, qrModuleSize(f('qr').size)), setting.paperWidth))
    },
    time: (p) => { if (f('time').show) p.push(fieldLine(texts.time, f('time'), w)) }
  }
  // QR 為固定內容（非可調整欄位），固定置於 time 之前
  const orderList = fmt.order.slice()
  const timeIdx = orderList.indexOf('time')
  orderList.splice(timeIdx >= 0 ? timeIdx : orderList.length, 0, 'qr')
  Object.assign(renderers, extraRenderers(f, w, order, 'qrcode', setting))
  renderFields(parts, orderList, renderers, texts, fields, w)
  parts.push(feedLines(3))
  parts.push(cut())
  return concat(parts)
}

// 生成枱面點餐碼小票（供顧客掃碼進入 QR 點餐版面，內容為點餐網址）
async function buildTableQrOrder (setting, order, url) {
  const fmt = mergeFormat('tableqr', setting)
  const fields = fmt.fields || {}
  const f = (key) => fields[key] || { show: true, size: 1, align: 'left' }
  const w = lineWidthOf(setting.paperWidth)
  const parts = [initPrinter(setting)]
  // 枱號條碼：固定印在單據最左上角（掃描跳枱用），僅熱敏打印機支援
  if (f('barcode').show && setting.tech !== 'dot') {
    const desk = order && order.deskNo
    const hasDesk = desk !== undefined && desk !== null && String(desk) !== '' && String(desk) !== '0'
    if (hasDesk) {
      const barSize = Number(f('barcode').size || 1)
      const moduleWidth = (barSize >= 3 ? 4 : barSize === 2 ? 3 : 2) * 2
      const barHeight = Math.round((barSize >= 3 ? 96 : barSize === 2 ? 72 : 48) * 1.5)
      parts.push(qrLine(buildBarcodeImage(String(desk), moduleWidth, barHeight), setting.paperWidth))
    }
  }
  if (setting.logoEnabledQrcode) {
    const logoData = await buildLogoImage(setting)
    if (logoData.length) parts.push(qrLine(logoData, setting.paperWidth))
  }
  const texts = buildTexts(setting, order, fmt, 'tableqr')
  const renderers = {
    shopName: (p) => { if (f('shopName').show) p.push(textLine(setting.shopName || '歡迎光臨', { align: 'center', width: Math.floor(w / 2), doubleWidth: true, doubleHeight: true })) },
    title: (p) => { if (f('title').show && fmt.title) p.push(fieldLine(fmt.title, f('title'), w)) },
    deskNo: (p) => { if (f('deskNo').show) p.push(fieldLine(`台號：${deskLabel(setting, order)}`, f('deskNo'), w)) },
    orderNo: (p) => { if (f('orderNo').show && order.orderNo) p.push(fieldLine(`訂單號：${order.orderNo}`, f('orderNo'), w)) },
    date: (p) => { if (f('date').show) p.push(fieldLine(texts.date, f('date'), w)) },
    time: (p) => { if (f('time').show) p.push(fieldLine(texts.time, f('time'), w)) },
    hint: (p) => { if (f('hint').show) p.push(fieldLine('請用手機相機掃描下單', f('hint'), w)) },
    qr: (p) => {
      if (f('qr').show === false) return
      p.push(feedLines(1))
      p.push(qrLine(buildQRImage(url, qrModuleSize(f('qr').size)), setting.paperWidth))
      p.push(feedLines(1))
    }
  }
  // QR 為固定內容（非可調整欄位），固定置於 hint 之前；條碼已提前印在左上角，跳過避免重複
  const orderList = (fmt.order || []).filter(k => k !== 'barcode')
  const hintIdx = orderList.indexOf('hint')
  orderList.splice(hintIdx >= 0 ? hintIdx : orderList.length, 0, 'qr')
  Object.assign(renderers, extraRenderers(f, w, order, 'tableqr', setting))
  renderFields(parts, orderList, renderers, texts, fields, w)
  parts.push(feedLines(3))
  parts.push(cut())
  return concat(parts)
}

// 生成追單小票（只列印被選中的品項，醒目【追單】標識）
function buildChaseOrder (setting, order, station) {
  const fmt = mergeFormat('chase', setting)
  const fields = fmt.fields || {}
  const f = (key) => fields[key] || { show: true, size: 1, align: 'left' }
  const w = lineWidthOf(setting.paperWidth)
  const parts = [initPrinter(setting)]
  const texts = buildTexts(setting, order, fmt, 'chase')
  const renderers = {
    title: (p) => {
      if (f('title').show && fmt.title) {
        p.push(redOn())
        p.push(fieldLine(fmt.title, f('title'), w))
        p.push(redOff())
      }
    },
    shopName: (p) => {
      if (f('shopName').show) p.push(textLine(setting.shopName || '', { align: 'center', width: Math.floor(w / 2), doubleWidth: true, doubleHeight: true }))
      if (station) p.push(textLine(`【${station}檔】`, { align: 'center', width: w, doubleWidth: true }))
    },
    deskNo: (p) => { if (f('deskNo').show) p.push(fieldLine(`台號：${deskLabel(setting, order)}`, f('deskNo'), w)) },
    orderNo: (p) => { if (f('orderNo').show) p.push(fieldLine(`訂單號：${order.orderNo}`, f('orderNo'), w)) },
    items: (p) => {
      if (!f('items').show) return
      const items = order.order || []
      const comboState = (setting && setting.comboNameOnce) ? { last: null } : null
      for (const item of items) {
        const d = comboLine(item, comboState)
        if (d.header) {
          p.push(redOn())
          p.push(fieldLine(`${d.header}  x${d.count}`, f('items'), w))
          p.push(redOff())
        }
        p.push(fieldLine(d.isSub ? d.label : `${d.label}  x${d.count}`, f('items'), w))
        if (item.mods && item.mods.length) {
          p.push(redOn())
          for (const m of item.mods) {
            const t = modText(m)
            if (t) p.push(fieldLine('　' + t, f('mods'), w))
          }
          p.push(redOff())
        }
      }
    },
    remark: (p) => { if (f('remark').show && order.remark) p.push(fieldLine(`備註：${order.remark}`, f('remark'), w)) },
    time: (p) => { if (f('time').show) p.push(fieldLine(texts.time, f('time'), w)) }
  }
  Object.assign(renderers, extraRenderers(f, w, order, 'chase', setting))
  renderFields(parts, fmt.order, renderers, texts, fields, w)
  parts.push(feedLines(3))
  parts.push(cut())
  return concat(parts)
}

// 追單按檔口分拆打印
function buildChaseByStation (setting, order) {
  const rawItems = order.order || []
  const expanded = []
  rawItems.forEach(item => {
    if (item.contents && item.contents.length) {
      item.contents.forEach(c => {
        expanded.push(Object.assign({}, c, {
          _comboName: item.noPrintComboName ? '' : (item.name2 || item.name),
          _comboCount: item.count || 1
        }))
      })
    } else {
      expanded.push(item)
    }
  })
  const grouped = {}
  expanded.forEach(item => {
    const stations = (item.stations && item.stations.length)
      ? item.stations
      : [item.station || '通用']
    stations.forEach(station => {
      if (!grouped[station]) grouped[station] = []
      grouped[station].push(item)
    })
  })
  const tickets = []
  Object.keys(grouped).forEach(station => {
    const printer = resolvePrinter(setting, station)
    const stationOrder = Object.assign({}, toPlain(order), { order: grouped[station] })
    tickets.push({ station, printer, data: buildChaseOrder(printer, stationOrder, station) })
  })
  return tickets
}

// 生成班地厘訊息小票（打柯單：收銀員輸入自由文字訊息，送到班地厘/出品部打印機）
function buildPantryMessage (setting, opts) {
  opts = opts || {}
  const fmt = mergeFormat('pantry', setting)
  const fields = fmt.fields || {}
  const f = (key) => fields[key] || { show: true, size: 1, align: 'left' }
  const w = lineWidthOf(setting.paperWidth)
  const parts = [initPrinter(setting)]
  const timeText = moment(new Date()).format('HH:mm')
  const texts = {
    title: fmt.title,
    shopName: setting.shopName || '',
    deskNo: opts.deskNo ? `台號：${deskLabel(setting, { deskNo: opts.deskNo })}` : '',
    orderNo: opts.orderNo ? `訂單號：${opts.orderNo}` : '',
    message: opts.message || '',
    waiter: opts.waiter ? `開單員工：${opts.waiter}` : '',
    time: `開單時間：${timeText}`
  }
  const renderers = {
    shopName: (p) => { if (f('shopName').show) p.push(textLine(setting.shopName || '班地厘訊息', { align: 'center', width: Math.floor(w / 2), doubleWidth: true, doubleHeight: true })) },
    title: (p) => { if (f('title').show && fmt.title) p.push(fieldLine(fmt.title, f('title'), w)) },
    deskNo: (p) => { if (f('deskNo').show && opts.deskNo) p.push(fieldLine(`台號：${deskLabel(setting, { deskNo: opts.deskNo })}`, f('deskNo'), w)) },
    orderNo: (p) => { if (f('orderNo').show && opts.orderNo) p.push(fieldLine(`訂單號：${opts.orderNo}`, f('orderNo'), w)) },
    message: (p) => { if (f('message').show && opts.message) p.push(fieldLine(opts.message, f('message'), w)) },
    waiter: (p) => { if (f('waiter').show && opts.waiter) p.push(fieldLine(`開單員工：${opts.waiter}`, f('waiter'), w)) },
    time: (p) => { if (f('time').show) p.push(fieldLine(`開單時間：${timeText}`, f('time'), w)) }
  }
  renderFields(parts, fmt.order, renderers, texts, fields, w)
  parts.push(feedLines(3))
  parts.push(cut())
  return concat(parts)
}

// 取消項目小票（退菜後列印）：頂頭紅字「已取消」，列出被取消的品項與數量
// opts: { order, items: [{ name, count }], reason, waiter }
function buildCancelItemTicket (setting, opts) {
  opts = opts || {}
  const fmt = mergeFormat('cancelitem', setting)
  const fields = fmt.fields || {}
  const f = (key) => fields[key] || { show: true, size: 1, align: 'left' }
  const w = lineWidthOf(setting.paperWidth)
  const parts = [initPrinter(setting)]
  const timeText = moment(new Date()).format('HH:mm')
  const order = opts.order || {}
  const items = opts.items || []
  const renderers = {
    shopName: (p) => {
      if (f('shopName').show) p.push(textLine(setting.shopName || '', { align: 'center', width: Math.floor(w / 2), doubleWidth: true, doubleHeight: true }))
    },
    title: (p) => {
      if (!f('title').show || !fmt.title) return
      // 針機點陣圖放大：標題「已取消」以 ESC * m=0 輸出（紅字），其餘欄位維持內建字庫
      const useDot = currentIsDot && !!(setting && setting.dotImagePrint)
      if (useDot) p.push(beginDotImage(setting, true))
      else p.push(redOn())
      p.push(fieldLine(fmt.title, f('title'), w))
      if (useDot) p.push(endDotImage())
      else p.push(redOff())
    },
    deskNo: (p) => {
      if (!f('deskNo').show || order.deskNo == null || order.deskNo === '') return
      // 針機點陣圖放大：枱號與後廚小票一致以 ESC * m=0 輸出（紅字）
      const useDot = currentIsDot && !!(setting && setting.dotImagePrint)
      if (useDot) p.push(beginDotImage(setting, true))
      p.push(fieldLine(`台號：${deskLabel(setting, order)}`, f('deskNo'), w))
      if (useDot) p.push(endDotImage())
    },
    orderNo: (p) => {
      if (f('orderNo').show && order.orderNo) p.push(fieldLine(`訂單號：${order.orderNo}`, f('orderNo'), w))
    },
    waiter: (p) => {
      if (f('waiter').show && opts.waiter) p.push(fieldLine(`開單員工：${opts.waiter}`, f('waiter'), w))
    },
    items: (p) => {
      if (!f('items').show) return
      // 針機點陣圖放大：取消項目以 ESC * m=0 輸出，突破內建 2x2 字號上限
      const useDot = currentIsDot && !!(setting && setting.dotImagePrint)
      if (useDot) p.push(beginDotImage(setting))
      for (const it of items) {
        if (!it) continue
        p.push(fieldLine(`${it.name}  x${it.count}  ${timeText}`, f('items'), w))
      }
      if (useDot) p.push(endDotImage())
    },
    reason: (p) => {
      if (!f('reason').show || !opts.reason) return
      // 針機點陣圖放大以紅字輸出原因，其餘文字模式用 ESC r 切換色帶（紅字）
      const useDot = currentIsDot && !!(setting && setting.dotImagePrint)
      if (useDot) p.push(beginDotImage(setting, true))
      else p.push(redOn())
      p.push(fieldLine(`原因：${opts.reason}`, f('reason'), w))
      if (useDot) p.push(endDotImage())
      else p.push(redOff())
    },
    time: (p) => {
      if (f('time').show) p.push(fieldLine(`取消時間：${timeText}`, f('time'), w))
    }
  }
  renderFields(parts, fmt.order, renderers, {}, fields, w)
  parts.push(feedLines(3))
  parts.push(cut())
  return concat(parts)
}

// 整單取消小票（整單取消後列印）：頂頭紅字「整單取消」+ 原因，內容採印單小票格式（品項/數量/小計）
// opts: { order, reason, waiter }
function buildCancelAllTicket (setting, opts) {
  opts = opts || {}
  const fmt = mergeFormat('cancelall', setting)
  const fields = fmt.fields || {}
  const f = (key) => fields[key] || { show: true, size: 1, align: 'left' }
  const w = lineWidthOf(setting.paperWidth)
  const parts = [initPrinter(setting)]
  const timeText = moment(new Date()).format('HH:mm')
  const order = opts.order || {}
  const items = order.order || []
  const renderers = {
    shopName: (p) => {
      if (f('shopName').show) p.push(textLine(setting.shopName || '', { align: 'center', width: Math.floor(w / 2), doubleWidth: true, doubleHeight: true }))
    },
    title: (p) => {
      if (!f('title').show || !fmt.title) return
      const useDot = currentIsDot && !!(setting && setting.dotImagePrint)
      if (useDot) p.push(beginDotImage(setting, true))
      else p.push(redOn())
      p.push(fieldLine(fmt.title, f('title'), w))
      if (useDot) p.push(endDotImage())
      else p.push(redOff())
    },
    deskNo: (p) => {
      if (!f('deskNo').show || order.deskNo == null || order.deskNo === '') return
      p.push(fieldLine(`台號：${deskLabel(setting, order)}`, f('deskNo'), w))
    },
    orderNo: (p) => {
      if (f('orderNo').show && order.orderNo) p.push(fieldLine(`訂單號：${order.orderNo}`, f('orderNo'), w))
    },
    waiter: (p) => {
      if (f('waiter').show && opts.waiter) p.push(fieldLine(`開單員工：${opts.waiter}`, f('waiter'), w))
    },
    items: (p) => {
      if (!f('items').show) return
      const size = f('items').size || 1
      for (const item of items) {
        const unit = receiptUnitPrice(item)
        const sub = Math.round(unit * (item.count || 1) * 100) / 100
        const cells = [
          { text: item.name, align: 'left', size },
          { text: `${item.count}`, align: 'right', size },
          { text: `$${sub.toFixed(2)}`, align: 'right', size }
        ]
        if (imageCtx) p.push(drawTextRow(cells))
        else p.push(textRow(cells, w))
        if (item.mods && item.mods.length) {
          p.push(redOn())
          for (const m of item.mods) {
            const t = modText(m)
            if (t) p.push(fieldLine('　' + t, f('mods'), w))
          }
          p.push(redOff())
        }
        if (item.contents && item.contents.length) pushComboContents(p, item, w, f('mods'))
      }
    },
    reason: (p) => {
      if (!f('reason').show || !opts.reason) return
      const useDot = currentIsDot && !!(setting && setting.dotImagePrint)
      if (useDot) p.push(beginDotImage(setting, true))
      else p.push(redOn())
      p.push(fieldLine(`原因：${opts.reason}`, f('reason'), w))
      if (useDot) p.push(endDotImage())
      else p.push(redOff())
    },
    total: (p) => {
      if (f('total').show) p.push(fieldLine(`合計：$${Number(order.totalPrice || 0).toFixed(2)}`, f('total'), w))
    },
    time: (p) => {
      if (f('time').show) p.push(fieldLine(`取消時間：${timeText}`, f('time'), w))
    }
  }
  renderFields(parts, fmt.order, renderers, {}, fields, w)
  parts.push(feedLines(3))
  parts.push(cut())
  return concat(parts)
}

// 座位分區：根據桌號查找區域打印機（service=服務檯預結單 / cashier=收銀髮票）
function resolveZonePrinter (setting, deskNo, type) {
  const zones = (setting && setting.zones) ? setting.zones : []
  const zone = zones.find(z => (z.desks || []).indexOf(Number(deskNo)) >= 0)
  if (!zone) return null
  if (type === 'service') {
    return zone.serviceIp ? { ip: zone.serviceIp, port: zone.servicePort || 9100, paperWidth: 58 } : null
  }
  return zone.cashierIp ? { ip: zone.cashierIp, port: zone.cashierPort || 9100, paperWidth: 58 } : null
}

// 生成結賬小票
async function buildReceipt (setting, order, opts) {
  const fmt = mergeFormat('receipt', setting)
  const fields = fmt.fields || {}
  const f = (key) => fields[key] || { show: true, size: 1, align: 'left' }
  const w = lineWidthOf(setting.paperWidth)
  const extra = opts || {}
  const parts = [initPrinter(setting)]
  // 大台號：固定印在單據最左上角（Logo 之上），不受字段排序影響
  if (f('deskNoBig').show) {
    parts.push(fieldLine(`${deskLabel(setting, order)}`, Object.assign({}, f('deskNoBig'), { align: 'left' }), w))
  }
  // 店舖 Logo（若已設定且啟用 logoEnabled 則印在最上方）
  if (setting.logoEnabled !== false) {
    const logoData = await buildLogoImage(setting)
    if (logoData.length) parts.push(qrLine(logoData, setting.paperWidth))
  }
  const texts = buildTexts(setting, order, fmt, 'receipt')
  const renderers = {
    shopName: (p) => { if (f('shopName').show) p.push(textLine(setting.shopName || '結賬小票', { align: 'center', width: Math.floor(w / 2), doubleWidth: true, doubleHeight: true })) },
    title: (p) => { if (f('title').show && fmt.title) p.push(fieldLine(fmt.title, f('title'), w)) },
    address: (p) => { if (f('address').show && setting.address) p.push(fieldLine(setting.address, f('address'), w)) },
    phone: (p) => { if (f('phone').show && setting.phone) p.push(fieldLine(`電話：${setting.phone}`, f('phone'), w)) },
    deskNo: (p) => { if (f('deskNo').show) p.push(fieldLine(`台號：${deskLabel(setting, order)}`, f('deskNo'), w)) },
    deskNoBig: (p) => { if (f('deskNoBig').show) p.push(fieldLine(`${deskLabel(setting, order)}`, f('deskNoBig'), w)) },
    orderNo: (p) => {
      if (f('orderNo').show) p.push(fieldLine(`訂單號：${order.orderNo}`, f('orderNo'), w))
      if (extra.invoiceNo) p.push(fieldLine(`發票流水號：${extra.invoiceNo}`, f('orderNo'), w))
    },
    items: (p) => {
      if (!f('items').show) return
      const items = order.order || []
      const size = f('items').size || 1
      for (const item of items) {
        const unit = receiptUnitPrice(item)
        const hasSplit = Array.isArray(item.departmentSplit) && item.departmentSplit.length > 0
        const sub = hasSplit ? 0 : Math.round(unit * (item.count || 1) * 100) / 100
        const cells = [
          { text: item.name, align: 'left', size },
          { text: `${item.count}`, align: 'right', size },
          { text: `$${sub.toFixed(2)}`, align: 'right', size }
        ]
        if (imageCtx) p.push(drawTextRow(cells))
        else p.push(textRow(cells, w))
        if (hasSplit) {
          for (const s of item.departmentSplit) {
            const splitCells = [
              { text: `　分帳 ${s.department}`, align: 'left', size },
              { text: '', align: 'center', size },
              { text: `$${(Number(s.amount) || 0).toFixed(2)}`, align: 'right', size }
            ]
            if (imageCtx) p.push(drawTextRow(splitCells))
            else p.push(textRow(splitCells, w))
          }
        }
        if (item.mods && item.mods.length) {
          p.push(redOn())
          for (const m of item.mods) {
            const t = modText(m)
            if (t) p.push(fieldLine('　' + t, f('mods'), w))
          }
          p.push(redOff())
        }
        if (item.contents && item.contents.length && item.showItems !== false) pushComboContents(p, item, w, f('mods'))
      }
    },
    total: (p) => {
      if (f('total').show) p.push(fieldLine(`合計：$${Number((order.totalPrice || 0) - (order.serviceCharge || 0)).toFixed(2)}`, f('total'), w))
    },
    serviceCharge: (p) => {
      if (f('serviceCharge').show && Number(order.serviceCharge || 0) > 0) p.push(fieldLine(`服務費：$${Number(order.serviceCharge || 0).toFixed(2)}`, f('serviceCharge'), w))
    },
    grandTotal: (p) => {
      if (f('grandTotal').show) p.push(fieldLine(`總金額：$${Number(order.totalPrice || 0).toFixed(2)}`, f('grandTotal'), w))
    },
    payMethod: (p) => {
      if (f('payMethod').show && extra.payMethod) p.push(fieldLine(`收款方式：${extra.payMethod}`, f('payMethod'), w))
    },
    reprint: (p) => {
      const n = Number(order.reprintCount || 0)
      if (f('reprint').show && n > 0) p.push(fieldLine(`**重印** ${n}：${order.reprintBy || ''}`, f('reprint'), w))
    },
    remark: (p) => { if (f('remark').show && order.remark) p.push(fieldLine(`備註：${order.remark}`, f('remark'), w)) },
    time: (p) => { if (f('time').show) p.push(fieldLine(texts.time, f('time'), w)) },
    date: (p) => { if (f('date').show) p.push(fieldLine(texts.date, f('date'), w)) },
    footer: (p) => {
      if (!f('footer').show || !setting.footer) return
      p.push(fieldLine(setting.footer, f('footer'), w))
    }
  }
  Object.assign(renderers, extraRenderers(f, w, order, 'receipt', setting))
  // 大台號已提前印在左上角，跳過原欄位避免重複列印
  renderFields(parts, (fmt.order || []).filter(k => k !== 'deskNoBig'), renderers, texts, fields, w)
  parts.push(feedLines(3))
  parts.push(cut())
  return concat(parts)
}

// 生成測試小票
function buildTestTicket (setting) {
  const w = lineWidthOf(setting.paperWidth)
  const parts = []
  parts.push(initPrinter(setting))
  parts.push(textLine(setting.shopName || '打印機測試', { align: 'center', width: Math.floor(w / 2), doubleWidth: true, doubleHeight: true }))
  parts.push(textLine('測試小票', { align: 'center', width: w }))
  parts.push(divider(w, '='))
  parts.push(textLine('打印機連接成功！', { align: 'center', width: w }))
  parts.push(textLine(`紙寬：${setting.paperWidth}mm`, { width: w }))
  parts.push(textLine(`時間：${moment().format('YYYY-MM-DD HH:mm:ss')}`, { width: w }))
  parts.push(divider(w, '='))
  parts.push(feedLines(3))
  parts.push(cut())
  return concat(parts)
}

// 營業報表：80mm 純文字小票（label + 金額右對齊，超出寬度自動換行）
function buildReportTicket (setting, report) {
  const paperWidth = 80
  const w = lineWidthOf(paperWidth)
  const parts = []
  const printer = Object.assign({}, setting || {}, { paperWidth })
  parts.push(initPrinter(printer))

  const moneyStr = v => (v == null || v === '' || isNaN(Number(v))) ? '' : Number(v).toFixed(2)
  const emitRow = (label, value, bold) => {
    label = String(label == null ? '' : label)
    value = String(value == null ? '' : value)
    if (!value) {
      parts.push(textLine(label, { width: w, bold: !!bold }))
      return
    }
    const gap = w - displayWidth(label) - displayWidth(value)
    if (gap >= 1) {
      parts.push(textLine(label + ' '.repeat(gap) + value, { width: w, bold: !!bold }))
    } else {
      parts.push(textLine(label, { width: w, bold: !!bold }))
      parts.push(textLine(value, { align: 'right', width: w, bold: !!bold }))
    }
  }

  if (report.title) parts.push(textLine(report.title, { align: 'center', width: Math.floor(w / 2), doubleWidth: true, doubleHeight: true }))
  if (report.subtitle) parts.push(textLine(report.subtitle, { align: 'center', width: w }))
  parts.push(divider(w, '='))

  const sections = (report.sections && report.sections.length) ? report.sections : null
  if (sections) {
    sections.forEach((section, si) => {
      if (si > 0) parts.push(divider(w, '-'))
      parts.push(textLine(section.title || '', { width: w, bold: true }))
      ;(section.rows || []).forEach(row => {
        if (!row) return
        const countStr = (row.count !== undefined && row.count !== null && row.count !== '') ? String(row.count) : ''
        const amountStr = (row.amount !== undefined && row.amount !== null && row.amount !== '') ? '$' + moneyStr(row.amount) : ''
        const avgStr = (row.average !== undefined && row.average !== null && row.average !== '') ? String(row.average) : ''
        const tipStr = (row.tip !== undefined && row.tip !== null && row.tip !== '') ? '小賬$' + moneyStr(row.tip) : ''
        const value = [countStr, amountStr, avgStr, tipStr].filter(Boolean).join('　')
        emitRow(row.label, value, row.bold)
        if (row.extra) parts.push(textLine('　' + row.extra, { width: w }))
      })
    })
  } else {
    ;(report.rows || []).forEach(row => {
      if (!row) return
      if (row.section) {
        parts.push(divider(w, '-'))
        parts.push(textLine(row.label || '', { width: w, bold: true }))
      } else {
        emitRow(row.label, row.value, row.bold)
      }
    })
  }

  parts.push(divider(w, '='))
  if (report.printTime) parts.push(textLine('列印時間：' + report.printTime, { width: w }))
  if (report.operator) parts.push(textLine('操作員：' + report.operator, { width: w }))
  parts.push(feedLines(3))
  parts.push(cut())
  return concat(parts)
}

// 錢箱 kick 指令（ESC p m t1 t2）
function cashDrawerKick () {
  return Buffer.from([ESC, 0x70, 0x00, 25, 250])
}

// Mongoose 子文檔（或普通物件）轉為純物件，避免 Object.assign 遺漏其欄位
function toPlain (p) {
  return (p && typeof p.toObject === 'function') ? p.toObject() : p
}

// 依打印機技術類型選擇小票格式：針式(dot)用 formatDot，其餘用 format
function resolveFormat (setting, tech) {
  const thermal = (setting && setting.format) || {}
  const dot = (setting && setting.formatDot) || thermal
  return tech === 'dot' ? dot : thermal
}

// 打印機是否具備可用目標（IP 直連）
function hasTarget (p) {
  return !!(p && p.ip)
}

// 打印機目標識別碼（供串行佇列與跳飛比對用）
function targetKey (p) {
  return 'ip:' + (p && p.ip ? p.ip : 'noip') + ':' + (p && p.port || 9100)
}

// 打印機技術類型相容性：熱敏(thermal)只跳熱敏機、針式(dot)只跳針式機，避免跨技術誤印
function sameTech (a, b) {
  return ((a && a.tech) || 'dot') === ((b && b.tech) || 'dot')
}

// 從 Printer 設置中解析某檔口/位置的打印機配置（含抬頭/紙寬/錢箱/複寫）
// key 匹配順序：name（檔口名，商品 station）→ role（cashier/expeditor/bar）→ location（兼容舊字段）
function resolvePrinter (setting, key) {
  const list = setting && setting.printers ? setting.printers : []
  const found = list.find(p => p.name === key || p.role === key || p.location === key)
  const chosen = hasTarget(found)
    ? found
    : (list.find(p => p.role === key && hasTarget(p)) || list.find(p => p.role === 'kitchen' && hasTarget(p)) || null)
  const tech = (chosen && chosen.tech) || 'dot'
  const base = {
    shopName: (setting && setting.shopName) || '',
    phone: (setting && setting.phone) || '',
    address: (setting && setting.address) || '',
    footer: (setting && setting.footer) || '',
    logo: (setting && setting.logo) || '',
    logoEnabledAll: !(setting && setting.logoEnabledAll === false),
    logoEnabled: !(setting && setting.logoEnabled === false),
    logoEnabledServing: !!(setting && setting.logoEnabledServing),
    logoEnabledPrint: !!(setting && setting.logoEnabledPrint),
    logoEnabledQrcode: !!(setting && setting.logoEnabledQrcode),
    format: resolveFormat(setting, tech),
    charset: (setting && setting.charset) || 'big5',
    imagePrint: !!(setting && setting.imagePrint),
    imageWeight: (setting && setting.imageWeight) || 400,
    thermalFont: (setting && setting.thermalFont) || 'noto',
    dotImagePrint: !!(setting && setting.dotImagePrint),
    dotImageSize: (setting && setting.dotImageSize) || 31,
    dotImageFont: (setting && setting.dotImageFont) || 'noto',
    dotImageWeight: (setting && setting.dotImageWeight) || (setting && setting.imageWeight) || 400,
    dpi: 180
  }
  if (chosen) {
    return Object.assign({}, base, toPlain(chosen), { tech })
  }
  return Object.assign({}, base, {
    tech,
    ip: (setting && setting.ip) || '',
    port: (setting && setting.port) || 9100,
    paperWidth: (setting && setting.paperWidth) || 58,
    copies: (setting && setting.copies) || 1,
    cashDrawer: key === 'cashier' ? !!((setting && setting.cashDrawer)) : false
  })
}

// 從「本機/中央」印表機設定建立完整 printer 物件（合併全域抬頭/格式/編碼）
// cfg: { ip, port, tech, model, dpi, paperWidth, copies, cashDrawer }；無 ip 時回傳 null
function resolveTerminalPrinter (setting, cfg) {
  const chosen = (cfg && hasTarget(cfg)) ? cfg : null
  if (!chosen) return null
  const tech = (chosen && chosen.tech) || 'dot'
  const base = {
    shopName: (setting && setting.shopName) || '',
    phone: (setting && setting.phone) || '',
    address: (setting && setting.address) || '',
    footer: (setting && setting.footer) || '',
    logo: (setting && setting.logo) || '',
    logoEnabledAll: !(setting && setting.logoEnabledAll === false),
    logoEnabled: !(setting && setting.logoEnabled === false),
    logoEnabledServing: !!(setting && setting.logoEnabledServing),
    logoEnabledPrint: !!(setting && setting.logoEnabledPrint),
    logoEnabledQrcode: !!(setting && setting.logoEnabledQrcode),
    format: resolveFormat(setting, tech),
    charset: (setting && setting.charset) || 'big5',
    imagePrint: !!(setting && setting.imagePrint),
    imageWeight: (setting && setting.imageWeight) || 400,
    thermalFont: (setting && setting.thermalFont) || 'noto',
    dotImagePrint: !!(setting && setting.dotImagePrint),
    dotImageSize: (setting && setting.dotImageSize) || 31,
    dotImageFont: (setting && setting.dotImageFont) || 'noto',
    dotImageWeight: (setting && setting.dotImageWeight) || (setting && setting.imageWeight) || 400,
    dpi: 180
  }
  return Object.assign({}, base, toPlain(chosen), { tech })
}

// 根據小票類型解析目標位置打印機（可被 ticketTargets 覆蓋）
// type: 'receipt'=結賬 | 'serving'=上菜紙 | 'kitchen'=後廚（返回 null 表示用自動分檔）
function resolveTicketPrinter (setting, type) {
  const targets = (setting && setting.ticketTargets) || {}
  if (type === 'kitchen' || type === 'chase') {
    const target = targets[type]
    if (target && target !== 'auto') {
      const p = resolvePrinter(setting, target)
      if (hasTarget(p)) return p
    }
    return null // 自動分檔
  }
  if (type === 'pantry') {
    // 班地厘訊息（打柯單）：預設送到廚房/班地厘打印機
    const target = targets[type]
    if (target && target !== 'auto') {
      const p = resolvePrinter(setting, target)
      if (hasTarget(p)) return p
    }
    return resolvePrinter(setting, 'kitchen')
  }
  const defaultKey = (type === 'receipt' || type === 'print' || type === 'reprint') ? 'cashier' : 'expeditor'
  const target = targets[type]
  if (target && target !== 'auto') {
    const p = resolvePrinter(setting, target)
    if (hasTarget(p)) return p
  }
  return resolvePrinter(setting, defaultKey)
}

// 打印佇列：按目標（ip:port）串行（FIFO），避免同一目標併發導致後者 Connection Refused/Timeout
const printQueues = {}

function print (printer, data, retries, meta, deadline) {
  const key = targetKey(printer)
  const prev = printQueues[key] || Promise.resolve()
  const task = prev.then(() => rawPrint(printer, data, retries, meta, deadline))
  // 無論成功或失敗，佇列都要繼續前進（錯誤由呼叫方 await 捕獲）
  printQueues[key] = task.then(() => {}, () => {})
  return task
}

// 單次列印：IP 直連；失敗自動重試
function rawPrint (printer, data, retries, meta, deadline) {
  return rawPrintViaTcp(printer, data, retries, deadline)
}

// 送出 DLE EOT 即時狀態查詢（0x10 0x04 n），等待印表機回傳 1 Byte 狀態
// 熱敏與針式（如 Epson TM-U220）均支援；逾時或無回應回傳 null（印表機不支援時不阻擋列印）
function queryStatus (client, n, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false
    const onData = (buf) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      client.removeListener('data', onData)
      resolve(buf && buf.length ? buf[0] : null)
    }
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      client.removeListener('data', onData)
      resolve(null)
    }, timeoutMs || 600)
    client.on('data', onData)
    client.write(Buffer.from([0x10, 0x04, n]))
  })
}

// DLE EOT 即時狀態檢查（缺紙/開蓋/離線/錯誤）；不支援或逾時（null）則略過不阻擋。
// 印前預檢與印後確認共用；針式打印機可額外回報錯誤狀態（DLE EOT 3）。
async function checkPrinterStatus (client, statusTimeout) {
  // DLE EOT 4：紙卷感測器（bit5+bit6 同時為 1 = 缺紙）
  const paper = await queryStatus(client, 4, statusTimeout)
  if (paper != null && (paper & 0x60) === 0x60) throw new Error('打印機缺紙')
  // DLE EOT 2：離線/開蓋
  const offline = await queryStatus(client, 2, statusTimeout)
  if (offline != null) {
    if (offline & 0x20) throw new Error('打印機開蓋')
    if (offline & 0x08) throw new Error('打印機離線')
  }
  // DLE EOT 3：錯誤狀態（針機可回報可回復/不可回復錯誤）
  const errStat = await queryStatus(client, 3, statusTimeout)
  if (errStat != null) {
    if (errStat & 0x40) throw new Error('打印機不可回復錯誤')
    if (errStat & 0x08) throw new Error('打印機錯誤')
  }
}

// IP 直連列印（TCP :9100 路徑）
// deadline：整條跳飛鏈的截止時間戳（ms），逾時即不再重試；剩餘時間不足時縮短本次連線逾時
function rawPrintViaTcp (printer, data, retries, deadline) {
  return new Promise((resolve, reject) => {
    if (!printer || !printer.ip) {
      reject(new Error('未設置打印機 IP 地址'))
      return
    }
    const copies = Math.max(1, printer.copies || 1)
    const timeout = printer.timeout || 8000
    const maxRetries = (retries == null) ? (printer.retries == null ? 1 : printer.retries) : retries
    const retryDelayMs = printer.retryDelay || 400
    const statusTimeout = printer.statusTimeout || 600
    let attempt = 0
    const tryOnce = () => {
      if (deadline && Date.now() >= deadline) {
        reject(new Error('跳飛總時間已用盡'))
        return
      }
      const remaining = deadline ? (deadline - Date.now()) : timeout
      const connectTimeout = Math.max(1, Math.min(timeout, remaining))
      const client = net.connect({ host: printer.ip, port: printer.port || 9100, timeout: connectTimeout })
      let done = false
      const finish = (err) => {
        if (done) return
        done = true
        client.removeAllListeners()
        client.destroy()
        if (err && err.blocked) {
          // 預檢攔截（缺紙/離線/開蓋，未送出）：不重試，直接上報等待補紙/補單
          reject(err)
        } else if (err && attempt < maxRetries && (!deadline || Date.now() < deadline)) {
          attempt++
          console.log(`[Printer] ${printer.name || printer.ip} 連接失敗（${err.message}），重試 ${attempt}/${maxRetries}`)
          setTimeout(tryOnce, retryDelayMs)
        } else if (err) {
          reject(err)
        } else {
          resolve()
        }
      }
      client.on('connect', async () => {
        try {
          // DLE EOT 即時狀態預檢（缺紙/開蓋/離線）；不支援或逾時則略過不阻擋。
          // 預檢失敗 = 未送出，標記 blocked，交由上層攔截（不跳飛），等補紙/補單。
          if (printer.statusCheck !== false) {
            try {
              await checkPrinterStatus(client, statusTimeout)
            } catch (e) {
              e.blocked = true
              throw e
            }
          }
          const parts = []
          for (let i = 0; i < copies; i++) parts.push(data)
          if (printer.cashDrawer) parts.push(cashDrawerKick())
          const buf = Buffer.concat(parts)
          // 寫入資料（先唔好即時 end），再做「印後即時狀態確認」；
          // 列印中途斷電會觸發 error/close，由 finish 接手 → 跳飛備援機。
          client.write(buf)
          if (printer.statusCheck !== false) {
            await checkPrinterStatus(client, statusTimeout)
          }
          // end(cb)：資料 flush 完成（FIN 送出）後才 resolve，確保完整送出、不依賴對端 close
          client.end(() => finish())
        } catch (err) {
          finish(err)
        }
      })
      client.on('error', finish)
      client.on('timeout', () => {
        client.destroy()
        finish(new Error('連接打印機超時'))
      })
    }
    tryOnce()
  })
}

// 跳飛時通知 POS 前台（Socket.IO），顯示醒目提示（受 PosSetting.failoverNotify 開關控制）
async function emitFailover (from, to, meta) {
  try {
    const PosSetting = require('../models/PosSetting')
    const setting = await PosSetting.findOne().lean().exec()
    if (setting && setting.failoverNotify === false) return
  } catch (e) {
    // 讀取設定失敗時仍繼續通知，避免漏提示
  }
  try {
    const io = require('./SocketIO').getIO()
    if (io) {
      io.emit('printerFailover', {
        from: from || '',
        to: to || '',
        deskNo: (meta && meta.deskNo != null && String(meta.deskNo) !== '' && String(meta.deskNo) !== '0') ? String(meta.deskNo) : '',
        orderNo: (meta && meta.orderNo) ? String(meta.orderNo) : ''
      })
    }
  } catch (e) {
    // SocketIO 尚未初始化時忽略
  }
}

// 預檢攔截通知（缺紙/離線/開蓋，未送廚）：推播給 POS，醒目提示補紙/補單
async function emitPrintBlocked (station, reason, meta) {
  try {
    const io = require('./SocketIO').getIO()
    if (io) {
      io.emit('printBlocked', {
        station: station || '',
        reason: reason || '打印機未送出',
        deskNo: (meta && meta.deskNo != null && String(meta.deskNo) !== '' && String(meta.deskNo) !== '0') ? String(meta.deskNo) : '',
        orderNo: (meta && meta.orderNo) ? String(meta.orderNo) : ''
      })
    }
  } catch (e) {
    // SocketIO 尚未初始化時忽略
  }
}

// 跳飛提示標題票：備用機出單時在票頭印「備用機出單／原檔口」提示（文字/圖像模式通用）
function buildFailoverBanner (printer, fromStation) {
  const w = lineWidthOf(printer.paperWidth)
  const parts = [initPrinter(printer)]
  // 針機 dotImagePrint 走點陣圖放大（beginDotImage），其餘走紅字；圖像字體 1x0.5
  const useDot = currentIsDot && !!(printer && printer.dotImagePrint)
  const text = `由「${fromStation || '未知'}」跳過來`
  const scale = { w: 1, h: 0.5 }
  if (useDot) {
    parts.push(beginDotImage(printer, true))
    parts.push(textLine(text, { align: 'center', width: w, scale }))
    parts.push(endDotImage())
  } else {
    parts.push(redOn())
    parts.push(textLine(text, { align: 'center', width: w, scale }))
    parts.push(redOff())
  }
  parts.push(feedLines(0))
  return concat(parts)
}

// 建構跳飛候選清單：第一備援機(fallbackTo) → 第二備援機(fallbackTo2) → 廚房通用機（role=kitchen）
// 僅同技術類型、非主機本身、不重複目標；供 printWithFailover 與 printQueue worker 共用，確保兩者跳飛策略一致
function buildFallbackPlan (setting, printer) {
  const plan = []
  if (!printer) return plan
  const stationName = (printer && printer.name) || (printer && printer.ip) || '打印機'
  const push = (name) => {
    if (!name) return
    const p = resolvePrinter(setting, name)
    if (!p || !hasTarget(p)) return
    if (targetKey(p) === targetKey(printer)) return
    if (plan.some(c => targetKey(c.printer) === targetKey(p))) return
    if (!sameTech(printer, p)) return
    plan.push({ printer: p, label: name })
  }
  // 第一備援機 → 第二備援機（僅同技術類型：熱敏→熱敏、針式→針式）
  push(printer.fallbackTo)
  push(printer.fallbackTo2)
  // 廚房通用機（最後防線）：第一台 role=kitchen 且有目標，且非主機/備援機本身，且技術類型相同、未重複
  const list = (setting && setting.printers) ? setting.printers : []
  const kitchen = list.find(p => p.role === 'kitchen' && hasTarget(p) &&
    p.name !== stationName && p.name !== printer.fallbackTo && p.name !== printer.fallbackTo2 &&
    targetKey(p) !== targetKey(printer) && sameTech(printer, p) &&
    !plan.some(c => targetKey(c.printer) === targetKey(p)))
  if (kitchen) {
    const kp = resolvePrinter(setting, kitchen.name)
    if (kp && hasTarget(kp)) plan.push({ printer: kp, label: kitchen.name })
  }
  return plan
}

// 跳飛總時間（毫秒）快取：整條跳飛鏈（主機重試 + 備援機 + 廚房通用機）合計的預算上限
let failoverTimeoutCache = { value: 45000, at: 0 }
const FAILOVER_TIMEOUT_TTL = 30000

async function getFailoverTimeoutMs () {
  const now = Date.now()
  if (now - failoverTimeoutCache.at < FAILOVER_TIMEOUT_TTL) return failoverTimeoutCache.value
  try {
    const PosSetting = require('../models/PosSetting')
    const s = await PosSetting.findOne().lean().exec()
    const sec = (s && s.failoverTimeout) || 45
    failoverTimeoutCache = { value: sec * 1000, at: now }
  } catch (e) {
    // 讀取失敗沿用預設 45 秒
  }
  return failoverTimeoutCache.value
}

// 計算本次邏輯列印任務（整條跳飛鏈）的截止時間戳（ms），供主機與備援機共用
async function computeDeadline () {
  return Date.now() + await getFailoverTimeoutMs()
}

// 打印並在主機失敗時自動跳飛：備援機(fallbackTo) → 廚房通用機（role=kitchen）
// 全程不 throw，回傳 { ok, printedTo }；失敗僅記錄，確保單一檔口離線不中斷其他檔口。
// deadline：整條跳飛鏈的截止時間戳（ms），逾時即停止，避免離線檔口拖垮出單。
async function printWithFailover (setting, printer, data, meta, deadline) {
  if (deadline == null) deadline = await computeDeadline()
  const stationName = (printer && printer.name) || (printer && printer.ip) || '打印機'
  // 1) 主機
  if (printer && hasTarget(printer)) {
    if (deadline && Date.now() >= deadline) {
      console.log(`[Printer] ${stationName} 跳飛總時間已用盡，停止嘗試`)
      return { ok: false, printedTo: '' }
    }
    try {
      await print(printer, data, undefined, meta, deadline)
      return { ok: true, printedTo: stationName }
    } catch (e) {
      // 預檢攔截（缺紙/離線/開蓋，未送出）：不跳飛，通知前台補紙/補單
      if (e && e.blocked) {
        console.log(`[Printer] ${stationName} 預檢攔截（${e.message}），不跳飛，等待補紙/補單`)
        await emitPrintBlocked(stationName, e.message, meta)
        return { ok: false, blocked: true, reason: e.message }
      }
      console.log(`[Printer] ${stationName} 列印失敗：${e.message}，嘗試跳飛備援機`)
    }
  }
  // 2) 依 buildFallbackPlan 依序跳飛（備援機 → 廚房通用機）
  for (const cand of buildFallbackPlan(setting, printer)) {
    if (deadline && Date.now() >= deadline) {
      console.log(`[Printer] ${stationName} 跳飛總時間已用盡，停止跳飛`)
      break
    }
    const target = cand.printer
    const label = cand.label
    try {
      await print(target, Buffer.concat([buildFailoverBanner(target, stationName), data]), undefined, meta, deadline)
      console.log(`[Printer] 已跳飛至「${label}」`)
      await emitFailover(stationName, label, meta)
      return { ok: true, printedTo: label }
    } catch (e) {
      console.log(`[Printer] 備援機「${label}」列印失敗：${e.message}`)
    }
  }
  console.log(`[Printer] ${stationName} 全部嘗試失敗，已跳過（不影響落單）`)
  return { ok: false, printedTo: '' }
}

module.exports = {
  DEFAULT_FORMAT,
  cashDrawerKick,
  setPosSettingCache,
  resolvePrinter,
  resolveTerminalPrinter,
  resolveTicketPrinter,
  printWithFailover,
  buildKitchenOrder,
  buildKitchenByStation,
  buildExpeditorOrder,
  buildServingOrder,
  buildPrintOrder,
  buildQrcodeOrder,
  buildTableQrOrder,
  buildChaseOrder,
  buildChaseByStation,
  buildPantryMessage,
  buildCancelItemTicket,
  buildCancelAllTicket,
  resolveZonePrinter,
  buildReceipt,
  buildTestTicket,
  buildReportTicket,
  print,
  rawPrint,
  computeDeadline,
  targetKey,
  hasTarget,
  sameTech,
  buildFailoverBanner,
  emitFailover,
  emitPrintBlocked,
  buildFallbackPlan,
  // 按收銀機 terminalCode 觸發對應的錢箱
  openDrawerByTerminal: async function (terminalCode) {
    const net = require('net')
    const PosTerminal = require('../models/PosTerminal')
    if (!terminalCode) return false
    try {
      const terminal = await PosTerminal.findOne({ code: terminalCode }).lean().exec()
      if (!terminal) return false
      const hasDrawer = (terminal.receipt && terminal.receipt.cashDrawer) || !!terminal.cashDrawer
      if (!hasDrawer) return false
      // 回退舊欄位 printerIp
      const ip = (terminal.receipt && terminal.receipt.ip) || terminal.printerIp || ''
      const port = (terminal.receipt && terminal.receipt.port) || terminal.printerPort || 9100
      if (!ip) return false
      return new Promise((resolve) => {
        const client = net.connect({ host: ip, port: port, timeout: 3000 })
        let done = false
        const finish = (err) => { if (!done) { done = true; resolve(!err) } }
        client.on('connect', () => {
          try {
            client.write(cashDrawerKick())
            client.end()
            finish()
          } catch (e) { finish(e) }
        })
        client.on('error', finish)
        client.on('timeout', () => { client.destroy(); finish(new Error('timeout')) })
      })
    } catch (e) {
      console.log('[Printer] 錢箱觸發失敗：' + e.message)
      return false
    }
  }
}
