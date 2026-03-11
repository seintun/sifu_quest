import assert from 'node:assert/strict'
import test from 'node:test'

import { computeStreak } from './streak.ts'

function dayOffset(daysFromToday: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + daysFromToday)
  return d.toISOString().split('T')[0]
}

test('computeStreak counts contiguous dates including today', () => {
  const dates = [dayOffset(0), dayOffset(-1), dayOffset(-2), dayOffset(-2)]
  assert.equal(computeStreak(dates), 3)
})

test('computeStreak starts from yesterday when today is missing', () => {
  const dates = [dayOffset(-1), dayOffset(-2)]
  assert.equal(computeStreak(dates), 2)
})

test('computeStreak breaks on first missing day after start', () => {
  const dates = [dayOffset(0), dayOffset(-2), dayOffset(-3)]
  assert.equal(computeStreak(dates), 1)
})
