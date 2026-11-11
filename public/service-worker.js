const CACHE_NAME = 'oh-wait-shell-v1'
const CORE_FILES = ['/manifest.webmanifest', '/oh-wait-icon-192.svg', '/oh-wait-icon-512.svg']

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    const page = await fetch('/', { cache: 'reload' })
    const html = await page.clone().text()
    await cache.put('/', page)
    const builtAssets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(match => match[1])
    await cache.addAll([...CORE_FILES, ...builtAssets])
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('oh-wait-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request)
        if (response.ok) await cache.put('/', response.clone())
        return response
      } catch {
        return await cache.match(request) || await cache.match('/')
      }
    }

    const cached = await cache.match(request)
    if (cached) return cached
    try {
      const response = await fetch(request)
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone())
      return response
    } catch {
      return Response.error()
    }
  })())
})
