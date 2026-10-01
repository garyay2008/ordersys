// 一次性示例数据导入脚本：生成商品占位图 + 写入分类和商品
const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const Category = require('./models/Category')
const Commodity = require('./models/Commodity')

// ---------- 纯色 PNG 生成（Node 内置 zlib + 手写 CRC） ----------
function crc32 (buf) {
  const table = crc32._table || (crc32._table = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c >>> 0
    }
    return t
  })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk (type, data) {
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.slice(4, 8 + data.length)), 8 + data.length)
  return out
}

function makePng (rgb, size = 200) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type RGB
  const raw = Buffer.alloc((1 + size * 3) * size)
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3)
    raw[rowStart] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const p = rowStart + 1 + x * 3
      raw[p] = rgb[0]
      raw[p + 1] = rgb[1]
      raw[p + 2] = rgb[2]
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---------- 数据定义 ----------
const categories = [
  { cName: '热菜', no: 1 },
  { cName: '凉菜', no: 2 },
  { cName: '主食', no: 3 },
  { cName: '汤类', no: 4 },
  { cName: '饮品', no: 5 }
]

// isDiscount 为 true 时 onSale 表示原价（划线价）
const commodities = [
  { name: '宫保鸡丁', category: '热菜', price: 28, describe: '经典川菜，香辣下饭', color: [220, 60, 60], isDiscount: false, onSale: 0 },
  { name: '鱼香肉丝', category: '热菜', price: 26, describe: '咸甜酸辣，鱼香四溢', color: [200, 80, 70], isDiscount: true, onSale: 32 },
  { name: '麻婆豆腐', category: '热菜', price: 22, describe: '麻辣鲜香，嫩滑爽口', color: [210, 40, 40], isDiscount: false, onSale: 0 },

  { name: '拍黄瓜', category: '凉菜', price: 12, describe: '清爽开胃，蒜香浓郁', color: [80, 160, 80], isDiscount: false, onSale: 0 },
  { name: '凉拌木耳', category: '凉菜', price: 15, describe: '爽脆可口，酸辣开胃', color: [60, 140, 90], isDiscount: false, onSale: 0 },

  { name: '米饭', category: '主食', price: 3, describe: '东北大米，粒粒饱满', color: [240, 200, 90], isDiscount: false, onSale: 0 },
  { name: '蛋炒饭', category: '主食', price: 15, describe: '金黄蛋香，粒粒分明', color: [230, 180, 60], isDiscount: false, onSale: 0 },
  { name: '牛肉面', category: '主食', price: 18, describe: '汤浓面劲，牛肉软烂', color: [220, 160, 80], isDiscount: true, onSale: 22 },

  { name: '西红柿蛋汤', category: '汤类', price: 10, describe: '酸甜鲜美，营养健康', color: [230, 120, 60], isDiscount: false, onSale: 0 },
  { name: '紫菜蛋花汤', category: '汤类', price: 8, describe: '清淡鲜香，简单美味', color: [200, 140, 70], isDiscount: false, onSale: 0 },

  { name: '可乐', category: '饮品', price: 6, describe: '冰爽畅快，经典口味', color: [80, 110, 180], isDiscount: false, onSale: 0 },
  { name: '鲜榨橙汁', category: '饮品', price: 15, describe: '新鲜现榨，维C满满', color: [230, 150, 60], isDiscount: true, onSale: 18 },
  { name: '柠檬水', category: '饮品', price: 8, describe: '清新解腻，酸甜可口', color: [200, 210, 90], isDiscount: false, onSale: 0 },
  { name: '奶茶', category: '饮品', price: 12, describe: '香浓丝滑，甜而不腻', color: [180, 140, 90], isDiscount: false, onSale: 0 }
]

const GOODS_DIR = path.join(__dirname, 'public', 'goods')
const BASE_URL = ''

async function main () {
  await mongoose.connect('mongodb://localhost:27017/orderSYS')

  // 幂等：先清空
  await Category.deleteMany({})
  await Commodity.deleteMany({})

  // 生成图片
  if (!fs.existsSync(GOODS_DIR)) fs.mkdirSync(GOODS_DIR, { recursive: true })
  const imgFiles = []
  commodities.forEach((c, i) => {
    const file = `goods_${i + 1}.png`
    fs.writeFileSync(path.join(GOODS_DIR, file), makePng(c.color))
    imgFiles.push(file)
  })

  // 写入分类
  await Category.insertMany(categories)
  console.log('[seed] 分类已写入：' + categories.map(c => c.cName).join('、'))

  // 写入商品
  const docs = commodities.map((c, i) => ({
    img: `${BASE_URL}/goods/${imgFiles[i]}`,
    name: c.name,
    describe: c.describe,
    category: c.category,
    price: c.price,
    isDiscount: c.isDiscount,
    onSale: c.onSale,
    soldOut: false
  }))
  await Commodity.insertMany(docs)
  console.log(`[seed] 商品已写入：${docs.length} 个`)

  await mongoose.disconnect()
  console.log('[seed] 完成')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
