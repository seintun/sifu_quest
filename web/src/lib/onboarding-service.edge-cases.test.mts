import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getBackoffDelayMs,
  getPlanRetryState,
  isPlanJobRunningStale,
} from './onboarding-plan-job-state.ts'

test('getBackoffDelayMs applies exponential backoff with 2-minute floor', () => {
  assert.equal(getBackoffDelayMs(0), 2 * 60 * 1000)
  assert.equal(getBackoffDelayMs(1), 2 * 60 * 1000)
  assert.equal(getBackoffDelayMs(2), 4 * 60 * 1000)
  assert.equal(getBackoffDelayMs(3), 8 * 60 * 1000)
})

test('getPlanRetryState returns queued with future available_at before exhaustion', () => {
  const nowMs = Date.UTC(2026, 0, 1, 0, 0, 0)

  const firstAttempt = getPlanRetryState(1, nowMs)
  assert.equal(firstAttempt.exhausted, false)
  assert.equal(firstAttempt.nextStatus, 'queued')
  assert.equal(firstAttempt.availableAtIso, new Date(nowMs + 2 * 60 * 1000).toISOString())

  const secondAttempt = getPlanRetryState(2, nowMs)
  assert.equal(secondAttempt.exhausted, false)
  assert.equal(secondAttempt.nextStatus, 'queued')
  assert.equal(secondAttempt.availableAtIso, new Date(nowMs + 4 * 60 * 1000).toISOString())
})

test('getPlanRetryState marks attempt 3 as failed/exhausted', () => {
  const nowMs = Date.UTC(2026, 0, 1, 0, 0, 0)
  const exhaustedState = getPlanRetryState(3, nowMs)

  assert.deepEqual(exhaustedState, {
    exhausted: true,
    nextStatus: 'failed',
    availableAtIso: new Date(nowMs).toISOString(),
  })
})

test('isPlanJobRunningStale detects invalid and stale timestamps', () => {
  const nowMs = Date.UTC(2026, 0, 1, 0, 20, 0)
  const staleWindowMs = 10 * 60 * 1000

  assert.equal(isPlanJobRunningStale(null, nowMs), true)
  assert.equal(isPlanJobRunningStale('not-a-date', nowMs), true)

  const recentUpdatedAt = new Date(nowMs - (staleWindowMs - 1)).toISOString()
  assert.equal(isPlanJobRunningStale(recentUpdatedAt, nowMs), false)

  const staleUpdatedAt = new Date(nowMs - (staleWindowMs + 1)).toISOString()
  assert.equal(isPlanJobRunningStale(staleUpdatedAt, nowMs), true)
})
