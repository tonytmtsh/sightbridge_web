// SightBridge Service Worker
//
// Caching strategy:
//   navigations (HTML)  — network-first, so a new deploy is picked up at once
//   static assets       — cache-first, for offline resilience
//
// The cache name carries a per-build version stamped in at build time by
// scripts/stamp-sw-version.mjs. That version is what makes cache-first safe:
// `activate` deletes every cache whose name differs, so a new build starts from
// an empty cache and can never serve a previous build's assets.
//
// Do not hardcode this value. A constant cache name means the cleanup below has
// nothing to delete, and stale chunks get served to a freshly-deployed page.

const CACHE_VERSION = 'v8f3444b067cc'
const CACHE_NAME = `sightbridge-${CACHE_VERSION}`

// Take control immediately — don't wait for tabs to close
self.addEventListener('install', () => {
  self.skipWaiting()
})

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

  // Static assets (JS, CSS, fonts, images): cache-first with network fallback.
  //
  // Cache-first is safe only while the cache belongs to the running build. If
  // an entry is found but its response no longer matches what the network
  // serves for that URL, the cached copy is stale — this happens when a page
  // loaded under an older worker requests an asset the new build has replaced.
  // Revalidating with a conditional request keeps the offline benefit (a 304
  // is cheap) while guaranteeing a changed asset is never served from cache.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (!cached) return fetchAndCache(event.request)

      return fetch(event.request, { cache: 'no-cache' })
        .then((response) => {
          // 304 means the cached copy is still current — reuse it.
          if (response.status === 304) return cached
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => cached) // offline: fall back to whatever we have
    })
  )
})

/** Fetch an asset and store it for offline use. */
function fetchAndCache(request) {
  return fetch(request).then((response) => {
    if (response.ok) {
      const clone = response.clone()
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
    }
    return response
  })
}
