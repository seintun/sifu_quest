const STATIC_CACHE = 'sifu-static-v1'
const PAGE_CACHE = 'sifu-pages-v1'
const OFFLINE_FALLBACK = '/offline.html'

const PRECACHE_URLS = [
  OFFLINE_FALLBACK,
  '/manifest.webmanifest',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/favicon.ico',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  const keep = new Set([STATIC_CACHE, PAGE_CACHE])

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (keep.has(key)) {
            return Promise.resolve()
          }
          return caches.delete(key)
        })
      )
    ).then(() => self.clients.claim())
  )
})

function isCacheableStaticDestination(destination) {
  return destination === 'style' || destination === 'script' || destination === 'font' || destination === 'image' || destination === 'manifest'
}

function isSkippablePath(pathname) {
  return pathname.startsWith('/api/') || pathname.startsWith('/_next/image')
}

async function networkFirstPage(request) {
  const pageCache = await caches.open(PAGE_CACHE)

  try {
    const response = await fetch(request)
    if (response.ok) {
      await pageCache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await pageCache.match(request)
    if (cached) {
      return cached
    }

    const staticCache = await caches.open(STATIC_CACHE)
    const fallback = await staticCache.match(OFFLINE_FALLBACK)
    if (fallback) {
      return fallback
    }

    return new Response('Offline', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

async function cacheFirstStatic(request) {
  const staticCache = await caches.open(STATIC_CACHE)
  const cached = await staticCache.match(request)
  if (cached) {
    return cached
  }

  const response = await fetch(request)
  if (response.ok) {
    await staticCache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request))
    return
  }

  if (isSkippablePath(url.pathname)) {
    return
  }

  if (isCacheableStaticDestination(request.destination)) {
    event.respondWith(cacheFirstStatic(request))
  }
})
