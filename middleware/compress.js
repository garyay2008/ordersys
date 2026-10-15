// 統一壓縮中介層：優先 Brotli，其次 gzip（皆使用 Node 內建 zlib，無原生相依）。
// 採用緩衝方式壓縮（本專案回應體多為靜態 JS/CSS/HTML 與小型 JSON，體積可控），
// 取代 compression() 以避免兩套中介層各自包裝 res.write/res.end 造成雙重壓縮或互相干擾。
const zlib = require('zlib')

// 只壓縮文字類內容；圖片/字型/音訊等已是壓縮格式，壓縮無益且浪費 CPU。
const COMPRESSIBLE_RE = /^text\/|application\/(json|javascript|x-javascript|xml|xhtml\+xml|rss\+xml)|image\/svg\+xml/i

function isCompressibleType (contentType) {
  if (!contentType) return false
  return COMPRESSIBLE_RE.test(contentType)
}

module.exports = function compress (options) {
  const opts = options || {}
  const threshold = typeof opts.threshold === 'number' ? opts.threshold : 1024
  const brQuality = typeof opts.brQuality === 'number' ? opts.brQuality : 6
  const gzipLevel = typeof opts.gzipLevel === 'number' ? opts.gzipLevel : 6

  return function compressMiddleware (req, res, next) {
    if (req.method === 'HEAD') return next()

    const accept = req.headers['accept-encoding'] || ''
    let encoding = null
    if (accept.indexOf('br') !== -1) encoding = 'br'
    else if (accept.indexOf('gzip') !== -1) encoding = 'gzip'

    if (!encoding || res.getHeader('Content-Encoding')) return next()

    const end = res.end.bind(res)
    const chunks = []
    let finished = false

    res.setHeader('Vary', 'Accept-Encoding')

    res.write = function (chunk) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      return true
    }

    res.end = function (chunk) {
      if (finished) return
      finished = true
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      const body = Buffer.concat(chunks)

      const status = res.statusCode
      const noBody = status === 204 || status === 304 || (status >= 100 && status < 200)
      const contentType = res.getHeader('Content-Type')
      const doCompress = !noBody && body.length >= threshold && isCompressibleType(contentType)

      if (!doCompress) {
        res.setHeader('Content-Length', body.length)
        return end(body.length ? body : undefined)
      }

      const done = (err, result) => {
        // 壓縮失敗或壓縮後反而變大 → 直接送出原始 body
        if (err || !result || result.length >= body.length) {
          res.setHeader('Content-Length', body.length)
          return end(body.length ? body : undefined)
        }
        res.setHeader('Content-Encoding', encoding)
        res.setHeader('Content-Length', result.length)
        end(result)
      }

      if (encoding === 'br') {
        zlib.brotliCompress(body, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: brQuality,
            [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
          }
        }, done)
      } else {
        zlib.gzip(body, { level: gzipLevel }, done)
      }
    }

    next()
  }
}
