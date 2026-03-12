import assert from 'node:assert/strict'
import test from 'node:test'

import { estimateCostMicrousd, normalizeTokenUsage } from './chat-usage.ts'

test('normalizeTokenUsage derives total from input/output when total is missing', () => {
  const usage = normalizeTokenUsage(120, 80, null)
  assert.deepEqual(usage, {
    inputTokens: 120,
    outputTokens: 80,
    totalTokens: 200,
  })
})

test('normalizeTokenUsage keeps explicit total when provided', () => {
  const usage = normalizeTokenUsage(120, 80, 250)
  assert.deepEqual(usage, {
    inputTokens: 120,
    outputTokens: 80,
    totalTokens: 250,
  })
})

test('estimateCostMicrousd returns zero for OpenRouter free usage', () => {
  const cost = estimateCostMicrousd('openrouter', 'openai/gpt-oss-20b:free', {
    inputTokens: 1000,
    outputTokens: 1000,
    totalTokens: 2000,
  })
  assert.equal(cost, 0)
})

test('estimateCostMicrousd returns null for OpenRouter paid usage', () => {
  const cost = estimateCostMicrousd('openrouter', 'openai/gpt-4o', {
    inputTokens: 1000,
    outputTokens: 1000,
    totalTokens: 2000,
  })
  assert.equal(cost, null)
})

test('estimateCostMicrousd returns non-zero for Anthropic Sonnet usage', () => {
  const cost = estimateCostMicrousd('anthropic', 'claude-sonnet-4-6', {
    inputTokens: 1000,
    outputTokens: 1000,
    totalTokens: 2000,
  })
  assert.ok(typeof cost === 'number' && cost > 0)
})

test('estimateCostMicrousd returns null for unknown anthropic model', () => {
  const cost = estimateCostMicrousd('anthropic', 'claude-unknown-x', {
    inputTokens: 100,
    outputTokens: 100,
    totalTokens: 200,
  })
  assert.equal(cost, null)
})
