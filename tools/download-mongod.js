#!/usr/bin/env node
// 下載 MongoDB 的 mongod 二進位到專案根 mongodb/ 目錄，
// 供 Electron 桌面版打包（electron-builder extraResources）使用。
//
// 用法：
//   node tools/download-mongod.js              # 預設 7.0.14
//   MONGO_VERSION=7.0.14 node tools/download-mongod.js
//
// 注意：請在「目標平台」上執行本腳本（Mac 產 Mac、Windows 產 Windows），
// 因為 @napi-rs/canvas 與 mongod 都是平台各自編譯的二進位，不支援跨平台交叉打包。

const https = require('https')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const VERSION = process.env.MONGO_VERSION || process.argv[2] || '7.0.14'

function platformInfo () {
  const key = `${process.platform}-${process.arch}`
  const table = {
    'darwin-x64': { os: 'osx', name: 'mongodb-macos-x86_64', ext: 'tgz' },
    'darwin-arm64': { os: 'osx', name: 'mongodb-macos-arm64', ext: 'tgz' },
    'linux-x64': { os: 'linux', name: 'mongodb-linux-x86_64-ubuntu2204', ext: 'tgz' },
    'linux-arm64': { os: 'linux', name: 'mongodb-linux-aarch64-ubuntu2204', ext: 'tgz' },
    'win32-x64': { os: 'windows', name: 'mongodb-windows-x86_64', ext: 'zip' }
  }
  const info = table[key]
  if (!info) {
    console.error(`不支援的平台/架構：${key}`)
    process.exit(1)
  }
  return { key, ...info }
}

function download (url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u, redirects) => {
      if (redirects > 5) return reject(new Error('重導向次數過多'))
      https.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          return follow(new URL(res.headers.location, u).toString(), redirects + 1)
        }
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`下載失敗 HTTP ${res.statusCode}: ${u}`))
        }
        const file = fs.createWriteStream(dest)
        res.pipe(file)
        file.on('finish', () => file.close(resolve))
        file.on('error', reject)
      }).on('error', reject)
    }
    follow(url, 0)
  })
}

function findBin (extractDir) {
  const binName = process.platform === 'win32' ? 'mongod.exe' : 'mongod'
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const found = walk(p)
        if (found) return found
      } else if (entry.name === binName) {
        return p
      }
    }
    return null
  }
  return walk(extractDir)
}

async function main () {
  const info = platformInfo()
  const url = `https://fastdl.mongodb.org/${info.os}/${info.name}-${VERSION}.${info.ext}`
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mongod-'))
  const archive = path.join(tmp, `mongodb.${info.ext}`)
  const extractDir = path.join(tmp, 'extracted')
  fs.mkdirSync(extractDir)

  console.log(`下載：${url}`)
  await download(url, archive)

  console.log('解壓縮…')
  const tarArgs = info.ext === 'tgz' ? ['-xzf', archive] : ['-xf', archive]
  execFileSync('tar', [...tarArgs, '-C', extractDir], { stdio: 'inherit' })

  const bin = findBin(extractDir)
  if (!bin) {
    console.error('解壓後找不到 mongod 二進位')
    process.exit(1)
  }

  const outDir = path.join(__dirname, '..', 'mongodb')
  fs.mkdirSync(outDir, { recursive: true })
  const destName = process.platform === 'win32' ? 'mongod.exe' : 'mongod'
  const dest = path.join(outDir, destName)
  fs.copyFileSync(bin, dest)
  if (process.platform !== 'win32') fs.chmodSync(dest, 0o755)

  fs.rmSync(tmp, { recursive: true, force: true })
  console.log(`完成：${dest}`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
