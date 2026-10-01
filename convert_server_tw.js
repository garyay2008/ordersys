// 後端 .js 文案簡轉繁（server.js / config / plugins / routes / models）
const fs = require('fs')
const path = require('path')
const OpenCC = require('opencc-js')
const converter = OpenCC.Converter({ from: 'cn', to: 'tw' })

const dirs = ['plugins', 'routes', 'models', 'config']
const files = ['server.js']
dirs.forEach(d => {
  const full = path.join(__dirname, d)
  if (fs.existsSync(full)) {
    fs.readdirSync(full).forEach(f => {
      if (f.endsWith('.js')) files.push(path.join(d, f))
    })
  }
})

let count = 0
files.forEach(f => {
  const full = path.join(__dirname, f)
  if (!fs.existsSync(full)) return
  const content = fs.readFileSync(full, 'utf8')
  const converted = converter(content)
  if (content !== converted) {
    fs.writeFileSync(full, converted)
    count++
    console.log('轉換:', f)
  }
})
console.log(`共轉換 ${count} 個檔案`)
