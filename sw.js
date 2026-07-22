const CACHE_NAME = 'sightbridge-v2'
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons.svg',
]

const isLocalhost = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // In development, always fetch fresh so code/API changes are immediately visible.
  if (isLocalhost) {
    event.respondWith(
      fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html')
        }
      })
    )
    return
  }

  // Production: network-first for API calls, cache-first for static assets.
  const isApi = url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/auth/v1/')

  if (isApi) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached

      return fetch(event.request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone)
          })
          return response
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html')
          }
        })
    })
  )
})
