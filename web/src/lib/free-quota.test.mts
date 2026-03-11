import test from 'node:test'
import assert from 'node:assert/strict'

import {
  computeFreeQuotaForLimit,
  getQuotaErrorForLimit,
  isUsingFreeTier,
  shouldEnforceProviderQuota,
} from './free-quota-policy-core.ts'

test('computeFreeQuota returns unlimited when user has BYOK and is not guest', () => {
  const quota = computeFreeQuotaForLimit({
    is_guest: false,
    api_key_enc: 'encrypted-key',
    free_quota_exhausted: false,
    free_user_messages_used: 0,
  }, 5)

  assert.deepEqual(quota, { isFreeTier: false, remaining: -1, total: -1, isGuest: false })
})

test('computeFreeQuota returns remaining turns for free-tier guest', () => {
  const quota = computeFreeQuotaForLimit({
    is_guest: true,
    api_key_enc: null,
    free_quota_exhausted: false,
    free_user_messages_used: 2,
  }, 5)

  assert.equal(quota.isFreeTier, true)
  assert.equal(quota.remaining, 3)
  assert.equal(quota.total, 5)
  assert.equal(quota.isGuest, true)
})

test('getQuotaError blocks exhausted guest users', () => {
  const error = getQuotaErrorForLimit({
    is_guest: true,
    api_key_enc: null,
    free_quota_exhausted: true,
    free_user_messages_used: 5,
  }, 5)

  assert.deepEqual(error, {
    error: 'guest_limit_reached',
    message: 'You have reached your free message limit as a guest. Please log in to continue.',
  })
})

test('getQuotaError blocks exhausted signed-in free users', () => {
  const error = getQuotaErrorForLimit({
    is_guest: false,
    api_key_enc: null,
    free_quota_exhausted: false,
    free_user_messages_used: 5,
  }, 5)

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

test('shouldEnforceProviderQuota enforces guest no-key on OpenRouter', () => {
  const enforced = shouldEnforceProviderQuota({
    is_guest: true,
    api_key_enc: null,
    free_quota_exhausted: false,
    free_user_messages_used: 0,
  }, 'openrouter', false)

  assert.equal(enforced, true)
})

test('shouldEnforceProviderQuota enforces guest with key on OpenRouter', () => {
  const enforced = shouldEnforceProviderQuota({
    is_guest: true,
    api_key_enc: 'encrypted-key',
    free_quota_exhausted: false,
    free_user_messages_used: 0,
  }, 'openrouter', true)

  assert.equal(enforced, true)
})

test('shouldEnforceProviderQuota bypasses guest with key on Anthropic', () => {
  const enforced = shouldEnforceProviderQuota({
    is_guest: true,
    api_key_enc: 'encrypted-key',
    free_quota_exhausted: true,
    free_user_messages_used: 10,
  }, 'anthropic', true)

  assert.equal(enforced, false)
})

test('shouldEnforceProviderQuota bypasses signed-in with key on Anthropic', () => {
  const enforced = shouldEnforceProviderQuota({
    is_guest: false,
    api_key_enc: 'encrypted-key',
    free_quota_exhausted: false,
    free_user_messages_used: 0,
  }, 'anthropic', true)

  assert.equal(enforced, false)
})
