import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateTrialEntitlement } from './entitlements.ts'

test('trial allows when no start and under message limit', () => {
  const result = evaluateTrialEntitlement({
    trialStartedAt: null,
    trialMessagesUsed: 0,
  })

  assert.equal(result.allowed, true)
  assert.equal(result.remainingMessages, 5)
})

test('trial blocks when message limit reached', () => {
  const result = evaluateTrialEntitlement({
    trialStartedAt: '2026-03-10T00:00:00.000Z',
    trialMessagesUsed: 5,
  })

  assert.equal(result.allowed, false)
  assert.equal(result.code, 'trial_limit_reached')
})

test('trial blocks when 30-minute window is exceeded', () => {
  const result = evaluateTrialEntitlement({
    trialStartedAt: '2026-03-10T00:00:00.000Z',
    trialMessagesUsed: 2,
    now: new Date('2026-03-10T00:31:00.000Z'),
  })

  assert.equal(result.allowed, false)
  assert.equal(result.code, 'trial_expired')
})

