import assert from 'node:assert/strict'
import test from 'node:test'

import manifest from './manifest.ts'
import robots from './robots.ts'
import sitemap from './sitemap.ts'

test('manifest route returns Sifu branding metadata', () => {
  const data = manifest()
  assert.equal(data.name, 'Sifu Quest')
  assert.equal(data.short_name, 'Sifu')
  assert.equal(data.theme_color, '#09090B')
})

test('robots route includes sitemap path', () => {
  const data = robots()
  assert.ok(typeof data.sitemap === 'string')
  assert.ok(data.sitemap.endsWith('/sitemap.xml'))
})

test('sitemap route contains key dashboard routes', () => {
  const data = sitemap()
  const urls = data.map((item) => item.url)
  assert.ok(urls.some((url) => url.endsWith('/coach')))
  assert.ok(urls.some((url) => url.endsWith('/settings')))
})
