import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

test('public webmanifest uses Sifu branding values', () => {
  const manifestPath = join(process.cwd(), 'public', 'site.webmanifest')
  const raw = readFileSync(manifestPath, 'utf8')
  const manifest = JSON.parse(raw) as {
    name?: string
    short_name?: string
    theme_color?: string
  }

  assert.equal(manifest.name, 'Sifu Quest')
  assert.equal(manifest.short_name, 'Sifu')
  assert.equal(manifest.theme_color, '#09090B')
})
