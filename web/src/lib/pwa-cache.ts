export const PWA_CACHE = {
  static: 'sifu-static-v1',
  pages: 'sifu-pages-v1',
} as const

const STATIC_DESTINATIONS = new Set(['style', 'script', 'font', 'image', 'manifest'])

export function isCacheableStaticDestination(destination: string): boolean {
  return STATIC_DESTINATIONS.has(destination)
}

export function shouldSkipServiceWorkerCaching(pathname: string): boolean {
  return pathname.startsWith('/api/') || pathname.startsWith('/_next/image')
}

export function shouldTreatAsNavigation(method: string, mode: string): boolean {
  return method === 'GET' && mode === 'navigate'
}

export function shouldHandleWithStaticCache(method: string, destination: string, pathname: string): boolean {
  if (method !== 'GET') {
    return false
  }

  if (shouldSkipServiceWorkerCaching(pathname)) {
    return false
  }

  return isCacheableStaticDestination(destination)
}
