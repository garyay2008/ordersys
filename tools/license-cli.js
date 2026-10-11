#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { getMachineId, generateLicense } = require('../utils/license')

const cmd = process.argv[2]

if (cmd === 'machineid' || cmd === 'id') {
  console.log(getMachineId())
  process.exit(0)
}

if (cmd === 'generate' || cmd === 'gen') {
  // 私鑰來源：LICENSE_PRIVATE_KEY 環境變數優先，其次 tools/.license.private.key
  let privateKey = process.env.LICENSE_PRIVATE_KEY
  if (!privateKey) {
    const file = path.join(__dirname, '.license.private.key')
    try {
      privateKey = fs.readFileSync(file, 'utf8').trim()
    } catch (e) {
      privateKey = ''
    }
  }
  if (!privateKey) {
    console.error('找不到私鑰。請設定 LICENSE_PRIVATE_KEY 環境變數，或將私鑰放入 tools/.license.private.key')
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
  console.log(generateLicense(payload, privateKey))
  process.exit(0)
}

console.log('用法：')
console.log('  node tools/license-cli.js machineid')
console.log('  node tools/license-cli.js generate --mid=XXXX --exp=2027-12-31 --customer=客戶名 --edition=full')
console.log('  node tools/license-cli.js generate --mid=POS-01 --edition=terminal   （分機授權，mid=收銀機編號）')
console.log('')
console.log('參數：')
console.log('  --mid       機器識別碼（主機）或收銀機編號（分機，如 POS-01 / KIOSK-01）')
console.log('  --exp       到期日 YYYY-MM-DD（可省略＝永久授權）')
console.log('  --customer  客戶名稱（選填，僅供辨識）')
console.log('  --edition   版本名稱（選填，預設 full；分機授權用 terminal）')
console.log('  --features  功能清單，逗號分隔（選填）')
