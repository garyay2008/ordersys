#!/usr/bin/env node
const { getMachineId, generateLicense } = require('../utils/license')

const cmd = process.argv[2]

if (cmd === 'machineid' || cmd === 'id') {
  console.log(getMachineId())
  process.exit(0)
}

if (cmd === 'generate' || cmd === 'gen') {
  const secret = process.env.LICENSE_SECRET
  if (!secret) {
    console.error('請先設定 LICENSE_SECRET 環境變數（必須與客戶部署端的 LICENSE_SECRET 相同）')
    process.exit(1)
  }
  const args = {}
  process.argv.slice(3).forEach(a => {
    const m = a.match(/^--([^=]+)=(.*)$/)
    if (m) args[m[1]] = m[2]
  })
  const payload = {
    mid: args.mid || '',
    customer: args.customer || '',
    edition: args.edition || 'full',
    features: (args.features || '').split(',').map(s => s.trim()).filter(Boolean)
  }
  if (args.exp) payload.exp = args.exp
  if (!payload.mid) {
    console.error('缺少 --mid=機器識別碼（可先執行 `node tools/license-cli.js machineid` 取得）')
    process.exit(1)
  }
  console.log(generateLicense(payload, secret))
  process.exit(0)
}

console.log('用法：')
console.log('  node tools/license-cli.js machineid')
console.log('  node tools/license-cli.js generate --mid=XXXX --exp=2027-12-31 --customer=客戶名 --edition=full')
console.log('')
console.log('參數：')
console.log('  --mid       機器識別碼（必填，來自客戶機器）')
console.log('  --exp       到期日 YYYY-MM-DD（可省略＝永久授權）')
console.log('  --customer  客戶名稱（選填，僅供辨識）')
console.log('  --edition   版本名稱（選填，預設 full）')
console.log('  --features  功能清單，逗號分隔（選填）')
