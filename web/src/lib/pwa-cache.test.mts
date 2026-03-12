import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PWA_CACHE,
  isCacheableStaticDestination,
  shouldHandleWithStaticCache,
  shouldSkipServiceWorkerCaching,
  shouldTreatAsNavigation,
} from './pwa-cache.ts'

test('pwa cache names are versioned and stable', () => {
  assert.equal(PWA_CACHE.static, 'sifu-static-v1')
  assert.equal(PWA_CACHE.pages, 'sifu-pages-v1')
})

test('navigation detection requires GET navigate requests', () => {
  assert.equal(shouldTreatAsNavigation('GET', 'navigate'), true)
  assert.equal(shouldTreatAsNavigation('POST', 'navigate'), false)
  assert.equal(shouldTreatAsNavigation('GET', 'cors'), false)
})

test('service worker caching skips API and image optimizer routes', () => {
  assert.equal(shouldSkipServiceWorkerCaching('/api/account/status'), true)
  assert.equal(shouldSkipServiceWorkerCaching('/_next/image'), true)
  assert.equal(shouldSkipServiceWorkerCaching('/coach'), false)
})

test('static destination classification only includes offline-safe assets', () => {
  assert.equal(isCacheableStaticDestination('style'), true)
  assert.equal(isCacheableStaticDestination('script'), true)
  assert.equal(isCacheableStaticDestination('font'), true)
  assert.equal(isCacheableStaticDestination('image'), true)
  assert.equal(isCacheableStaticDestination('manifest'), true)
  assert.equal(isCacheableStaticDestination('document'), false)
  assert.equal(isCacheableStaticDestination(''), false)
})

test('static cache handler requires GET, cacheable destination, and non-skipped path', () => {
  assert.equal(shouldHandleWithStaticCache('GET', 'script', '/_next/static/chunk.js'), true)
  assert.equal(shouldHandleWithStaticCache('GET', 'image', '/android-chrome-192x192.png'), true)
  assert.equal(shouldHandleWithStaticCache('POST', 'script', '/_next/static/chunk.js'), false)
  assert.equal(shouldHandleWithStaticCache('GET', 'script', '/api/account/status'), false)
  assert.equal(shouldHandleWithStaticCache('GET', 'document', '/coach'), false)
})
