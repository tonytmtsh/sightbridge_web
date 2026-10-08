// SightBridge Service Worker
// Network-first for navigations so deploys are visible immediately.
// Cache static assets for offline resilience, versioned per build.

const CACHE_VERSION = 'v20260806'
const CACHE_NAME = `sightbridge-${CACHE_VERSION}`

// Take control immediately — don't wait for tabs to close
self.addEventListener('install', () => {
  self.skipWaiting()
})

function isLocalhost(url) {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
}

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    })
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // Never cache API calls — always go to network
  if (url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/auth/v1/') || url.pathname.startsWith('/functions/v1/')) {
    return // let the browser handle it normally (no caching)
  }

  // Navigations (HTML pages): network-first so deploys show immediately
  if (event.request.mode === 'navigate') {
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

  // Static assets (JS, CSS, fonts, images): cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        // Only cache successful responses
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
    })
  )
})
