const CACHE_NAME = 'ordersys-v2'
const PRECACHE = ['/pos']

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE)
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME }).map(function (n) { return caches.delete(n) })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return
  // 不攔截 API 請求，避免快取到動態資料（菜單/訂單等）
  if (e.request.url.indexOf('/api/') !== -1) return
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var clone = res.clone()
        caches.open(CACHE_NAME).then(function (cache) { cache.put(e.request, clone) })
      }
      return res
    }).catch(function () {
      return caches.match(e.request)
    })
  )
})
