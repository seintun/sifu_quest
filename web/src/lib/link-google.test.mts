import test from 'node:test'
import assert from 'node:assert/strict'

import { buildLinkedProfileUpdate } from './link-google.ts'

test('buildLinkedProfileUpdate sets non-guest state and trims metadata', () => {
  const payload = buildLinkedProfileUpdate(
    { name: '  Jane Doe  ', avatar_url: ' https://img.test/a.png ' },
    '2026-03-10T00:00:00.000Z',
  )

  assert.deepEqual(payload, {
    is_guest: false,
    guest_expires_at: null,
    last_active_at: '2026-03-10T00:00:00.000Z',
    display_name: 'Jane Doe',
    avatar_url: 'https://img.test/a.png',
  })
})

test('buildLinkedProfileUpdate omits empty metadata values', () => {
  const payload = buildLinkedProfileUpdate({ name: '   ', avatar_url: '' }, '2026-03-10T00:00:00.000Z')

  assert.deepEqual(payload, {
    is_guest: false,
    guest_expires_at: null,
    last_active_at: '2026-03-10T00:00:00.000Z',
  })
})
