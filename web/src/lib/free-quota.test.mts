import test from 'node:test'
import assert from 'node:assert/strict'

import { computeFreeQuota, getQuotaError, isUsingFreeTier } from './free-quota-policy.ts'

test('computeFreeQuota returns unlimited when user has BYOK and is not guest', () => {
  const quota = computeFreeQuota({
    is_guest: false,
    api_key_enc: 'encrypted-key',
    free_quota_exhausted: false,
    free_user_messages_used: 0,
  })

  assert.deepEqual(quota, { isFreeTier: false, remaining: -1, total: -1, isGuest: false })
})

test('computeFreeQuota returns remaining turns for free-tier guest', () => {
  const quota = computeFreeQuota({
    is_guest: true,
    api_key_enc: null,
    free_quota_exhausted: false,
    free_user_messages_used: 2,
  })

  assert.equal(quota.isFreeTier, true)
  assert.equal(quota.remaining, 3)
  assert.equal(quota.total, 5)
  assert.equal(quota.isGuest, true)
})

test('getQuotaError blocks exhausted guest users', () => {
  const error = getQuotaError({
    is_guest: true,
    api_key_enc: null,
    free_quota_exhausted: true,
    free_user_messages_used: 5,
  })

  assert.deepEqual(error, {
    error: 'guest_limit_reached',
    message: 'You have reached your free message limit as a guest. Please log in to continue.',
  })
})

test('getQuotaError blocks exhausted signed-in free users', () => {
  const error = getQuotaError({
    is_guest: false,
    api_key_enc: null,
    free_quota_exhausted: false,
    free_user_messages_used: 5,
  })

  assert.deepEqual(error, {
    error: 'missing_api_key',
    message: 'You have exhausted your free messages. Please add your Anthropic API key in Settings to continue.',
  })
})

test('isUsingFreeTier is true for guest and no-key users', () => {
  assert.equal(isUsingFreeTier({ is_guest: true, api_key_enc: 'x', free_quota_exhausted: false, free_user_messages_used: 0 }), true)
  assert.equal(isUsingFreeTier({ is_guest: false, api_key_enc: null, free_quota_exhausted: false, free_user_messages_used: 0 }), true)
  assert.equal(isUsingFreeTier({ is_guest: false, api_key_enc: 'x', free_quota_exhausted: false, free_user_messages_used: 0 }), false)
})
