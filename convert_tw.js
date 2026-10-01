// 前端 .vue 文案简转繁（opencc cn→tw）
const fs = require('fs')
const path = require('path')
const OpenCC = require('opencc-js')
const converter = OpenCC.Converter({ from: 'cn', to: 'tw' })

function walk (dir) {
  const files = []
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f)
    if (fs.statSync(p).isDirectory()) files.push(...walk(p))
    else if (f.endsWith('.vue')) files.push(p)
  })
  return files
}

const root = path.join(__dirname, 'client', 'src')
const files = walk(root)
let count = 0
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8')
  const converted = converter(content)
  if (content !== converted) {
    fs.writeFileSync(f, converted)
    count++
    console.log('轉換:', path.relative(root, f))
  }
})
console.log(`共轉換 ${count} 個檔案`)
