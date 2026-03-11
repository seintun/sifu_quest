import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSystemMeta, getSystemMessage, isSystemMeta } from './chat-system-messages.ts'

test('getSystemMessage returns deterministic content for known code', () => {
  const message = getSystemMessage('provider_key_required')
  assert.equal(typeof message, 'string')
  assert.equal(message.includes('Settings'), true)
})

test('buildSystemMeta returns normalized system metadata', () => {
  const meta = buildSystemMeta('guest_limit_reached')
  assert.deepEqual(meta, { kind: 'system', code: 'guest_limit_reached' })
})

test('isSystemMeta validates shape and known code', () => {
  assert.equal(isSystemMeta({ kind: 'system', code: 'free_tier_exhausted' }), true)
  assert.equal(isSystemMeta({ kind: 'system', code: 'unknown' }), false)
  assert.equal(isSystemMeta(null), false)
})
