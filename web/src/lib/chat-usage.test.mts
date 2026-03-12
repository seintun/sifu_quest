import assert from 'node:assert/strict'
import test from 'node:test'

import { estimateCostMicrousd, normalizeTokenUsage, parseUsdToMicrousd } from './chat-usage.ts'

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

test('estimateCostMicrousd uses Anthropic Sonnet 4.6 pricing', () => {
  const cost = estimateCostMicrousd('anthropic', 'claude-sonnet-4-6', {
    inputTokens: 1000,
    outputTokens: 1000,
    totalTokens: 2000,
  })
  assert.equal(cost, 18_000)
})

test('estimateCostMicrousd uses Anthropic Opus 4.6 pricing', () => {
  const cost = estimateCostMicrousd('anthropic', 'claude-opus-4-6', {
    inputTokens: 1000,
    outputTokens: 1000,
    totalTokens: 2000,
  })
  assert.equal(cost, 30_000)
})

test('estimateCostMicrousd uses Anthropic Haiku 4.5 pricing', () => {
  const cost = estimateCostMicrousd('anthropic', 'claude-haiku-4-5', {
    inputTokens: 1000,
    outputTokens: 1000,
    totalTokens: 2000,
  })
  assert.equal(cost, 6_000)
})

test('estimateCostMicrousd returns null for unknown anthropic model', () => {
  const cost = estimateCostMicrousd('anthropic', 'claude-unknown-x', {
    inputTokens: 100,
    outputTokens: 100,
    totalTokens: 200,
  })
  assert.equal(cost, null)
})

test('parseUsdToMicrousd converts USD number and string payloads', () => {
  assert.equal(parseUsdToMicrousd(0.123456), 123_456)
  assert.equal(parseUsdToMicrousd('0.5'), 500_000)
  assert.equal(parseUsdToMicrousd(' 0.000001 '), 1)
})

test('parseUsdToMicrousd returns null for invalid or negative values', () => {
  assert.equal(parseUsdToMicrousd(null), null)
  assert.equal(parseUsdToMicrousd(''), null)
  assert.equal(parseUsdToMicrousd('abc'), null)
  assert.equal(parseUsdToMicrousd(-1), null)
})
