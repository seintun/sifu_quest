import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldAttemptEmailFallback } from './user-identity-utils.ts'

test('shouldAttemptEmailFallback is false for anonymous and missing emails', () => {
  assert.equal(shouldAttemptEmailFallback(undefined), false)
  assert.equal(shouldAttemptEmailFallback(null), false)
  assert.equal(shouldAttemptEmailFallback('guest-123@anonymous.local'), false)
})

test('shouldAttemptEmailFallback is true for normal emails', () => {
  assert.equal(shouldAttemptEmailFallback('user@example.com'), true)
})
