const path = require('path')

const secretKey = process.env.JWT_SECRET
if (!secretKey) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Config] 缺少 JWT_SECRET 環境變數，拒絕在 production 啟動')
  }
  console.warn('[Config] 使用開發用預設 JWT_SECRET，正式環境請務必設定 JWT_SECRET')
}

module.exports = {
  mongoURI: process.env.MONGO_URI || 'mongodb://localhost:27017/orderSYS',
  secretKey: secretKey || '0x3E5-dev-only',
  // BullMQ 列印佇列使用的 Redis 連線（未設定時沿用 in-memory FIFO 佇列）
  redisURL: process.env.REDIS_URL || '',
  // 可寫資料目錄（上傳圖片/字型等）。桌面版指向 userData，伺服器版沿用專案根 public/
  publicDir: process.env.PUBLIC_DIR || path.join(__dirname, '..', 'public')
}
