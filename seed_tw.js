// 中菜菜單 seed（繁體）+ 現有中文資料轉繁體
const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const OpenCC = require('opencc-js')
const converter = OpenCC.Converter({ from: 'cn', to: 'tw' })

const Category = require('./models/Category')
const Commodity = require('./models/Commodity')
const ModCode = require('./models/ModCode')
const Printer = require('./models/Printer')
const Shop = require('./models/Shop')

// ---- 純色 PNG ----
function crc32 (buf) {
  const t = crc32._t || (crc32._t = (() => {
    const a = new Uint32Array(256)
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; a[n] = c >>> 0 }
    return a
  })())
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk (type, data) {
  const o = Buffer.alloc(8 + data.length + 4)
  o.writeUInt32BE(data.length, 0); o.write(type, 4, 'ascii'); data.copy(o, 8)
  o.writeUInt32BE(crc32(o.slice(4, 8 + data.length)), 8 + data.length)
  return o
}
function makePng (rgb, size = 200) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2
  const raw = Buffer.alloc((1 + size * 3) * size)
  for (let y = 0; y < size; y++) { const r = y * (1 + size * 3); raw[r] = 0; for (let x = 0; x < size; x++) { const p = r + 1 + x * 3; raw[p] = rgb[0]; raw[p + 1] = rgb[1]; raw[p + 2] = rgb[2] } }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

const GOODS_DIR = path.join(__dirname, 'public', 'goods')
const BASE_URL = ''

const categories = [
  { cName: '冷盤', no: 1 },
  { cName: '熱炒', no: 2 },
  { cName: '點心', no: 3 },
  { cName: '燉湯', no: 4 },
  { cName: '燒臘', no: 5 },
  { cName: '粉麵', no: 6 },
  { cName: '海鮮', no: 7 },
  { cName: '水吧', no: 8 }
]

// [name, category, price, describe, station, color]
const commodities = [
  ['五福大拼盤', '冷盤', 128, '燒味滷水五拼，宴席頭盤', '冷盤', [220, 60, 60]],
  ['涼拌海蜇', '冷盤', 58, '爽脆開胃，麻油香', '冷盤', [200, 80, 70]],
  ['白切雞', '冷盤', 88, '皮爽肉滑，配薑蓉', '冷盤', [210, 40, 40]],

  ['乾炒牛河', '熱炒', 68, '鑊氣十足，走蔥少油皆可', '熱炒', [180, 100, 40]],
  ['XO醬西蘭花', '熱炒', 58, 'XO醬香濃，爽脆', '熱炒', [80, 160, 80]],
  ['富貴蝦球', '熱炒', 138, '金黃酥脆，沙律醬', '熱炒', [230, 150, 60]],

  ['蟹粉小籠包', '點心', 48, '皮薄湯濃', '快蒸', [230, 200, 140]],
  ['豉汁排骨', '點心', 38, '豉香濃郁，蒸製', '快蒸', [180, 140, 90]],
  ['水晶蝦餃', '點心', 42, '蝦仁爽彈', '慢蒸', [240, 210, 150]],

  ['花膠燉雞湯', '燉湯', 98, '滋補養顏', '燉湯', [230, 160, 90]],
  ['老火例湯', '燉湯', 28, '每日例湯', '燉湯', [200, 150, 100]],

  ['明爐燒鴨', '燒臘', 108, '皮脆肉嫩', '冷盤', [200, 60, 50]],
  ['蜜汁叉燒', '燒臘', 98, '蜜汁香甜', '冷盤', [180, 70, 60]],

  ['雲吞麵', '粉麵', 45, '鮮蝦雲吞，竹昇麵', '粉麵', [240, 210, 130]],
  ['豉油皇炒麵', '粉麵', 42, '醬香炒麵', '粉麵', [220, 190, 120]],

  ['清蒸石斑魚', '海鮮', 168, '清蒸鮮甜', '海鮮', [100, 150, 200]],
  ['豉汁蒸帶子', '海鮮', 128, '蒜蓉豉汁蒸', '海鮮', [120, 170, 210]],

  ['凍檸茶', '水吧', 18, '冰爽解膩', '水吧', [230, 180, 80]],
  ['絲襪奶茶', '水吧', 20, '港式香濃', '水吧', [180, 140, 90]],
  ['鮮榨橙汁', '水吧', 25, '新鮮現榨', '水吧', [230, 150, 60]]
]

async function main () {
  await mongoose.connect('mongodb://localhost:27017/orderSYS')

  // 1. 現有中文資料轉繁體
  const p = await Printer.findOne().exec()
  if (p) {
    if (p.printers) p.printers.forEach(x => { x.name = converter(x.name || '') })
    if (p.shopName) p.shopName = converter(p.shopName)
    if (p.address) p.address = converter(p.address)
    if (p.footer) p.footer = converter(p.footer)
    await p.save()
  }
  const mods = await ModCode.find().exec()
  for (const m of mods) { m.name = converter(m.name); await m.save() }
  const shop = await Shop.findOne().exec()
  if (shop) {
    if (shop.shopName) shop.shopName = converter(shop.shopName)
    if (shop.shopIntro) shop.shopIntro = converter(shop.shopIntro)
    if (shop.shopNotice) shop.shopNotice = converter(shop.shopNotice)
    await shop.save()
  }

  // 2. 重新 seed 中菜菜單
  await Category.deleteMany({})
  await Commodity.deleteMany({})
  await Category.insertMany(categories)
  console.log('[seed] 分類（繁體）：' + categories.map(c => c.cName).join('、'))

  if (!fs.existsSync(GOODS_DIR)) fs.mkdirSync(GOODS_DIR, { recursive: true })
  const docs = commodities.map((c, i) => {
    const file = `goods_${i + 1}.png`
    fs.writeFileSync(path.join(GOODS_DIR, file), makePng(c[5]))
    return {
      img: `${BASE_URL}/goods/${file}`,
      name: c[0],
      describe: c[3],
      category: c[1],
      price: c[2],
      isDiscount: false,
      onSale: 0,
      soldOut: false,
      specs: [],
      station: c[4],
      stations: [c[4]]
    }
  })
  await Commodity.insertMany(docs)
  console.log('[seed] 菜品（繁體）：' + docs.length + ' 個')

  await mongoose.disconnect()
  console.log('[seed] 完成')
}

main().catch(err => { console.error(err); process.exit(1) })
