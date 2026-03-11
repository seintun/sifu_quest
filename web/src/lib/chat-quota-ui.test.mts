import assert from 'node:assert/strict'
import test from 'node:test'

import { applyQuotaOnChatError } from './chat-quota-ui.ts'

test('applyQuotaOnChatError clamps free quota to zero for quota-blocking errors', () => {
  const next = applyQuotaOnChatError(
    { isFreeTier: true, remaining: 3, total: 10, isGuest: true },
    'guest_limit_reached',
  )

  assert.deepEqual(next, { isFreeTier: true, remaining: 0, total: 10, isGuest: true })
})

test('applyQuotaOnChatError keeps prior free quota for provider-key errors', () => {
  const next = applyQuotaOnChatError(
    { isFreeTier: true, remaining: 2, total: 10, isGuest: false },
    'provider_key_required',
  )

  assert.deepEqual(next, { isFreeTier: true, remaining: 2, total: 10, isGuest: false })
})

test('applyQuotaOnChatError leaves non-free or missing quota unchanged', () => {
  assert.equal(applyQuotaOnChatError(null, 'missing_api_key'), null)
  assert.deepEqual(
    applyQuotaOnChatError({ isFreeTier: false, remaining: -1, total: -1 }, 'missing_api_key'),
    { isFreeTier: false, remaining: -1, total: -1 },
  )
})
