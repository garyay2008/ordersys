// QR 點餐端本地快取：菜單 / 改碼等資料二次進入秒開，背景刷新
const PREFIX = 'qr_cache_'
const TTL = 30 * 60 * 1000 // 30 分鐘

function get (key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !parsed.data) return null
    if (Date.now() - (parsed.ts || 0) > TTL) return null
    return parsed.data
  } catch (e) {
    return null
  }
}

function set (key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now() }))
  } catch (e) {
    // localStorage 滿或不可用時忽略
  }
}

export default { get, set }
