import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ANTHROPIC_MODEL_CATALOG,
  getAnthropicDefaultModel,
  getAnthropicModelCostTier,
  isKnownAnthropicModel,
  isOpenRouterFreeModel,
  parseChatProvider,
  sanitizeModelLabel,
} from './chat-provider-config.ts'

test('parseChatProvider falls back to openrouter for invalid input', () => {
  assert.equal(parseChatProvider('invalid-provider'), 'openrouter')
})

test('isOpenRouterFreeModel accepts :free and free router aliases', () => {
  assert.equal(isOpenRouterFreeModel('openai/gpt-oss-20b:free'), true)
  assert.equal(isOpenRouterFreeModel('openrouter/free'), true)
  assert.equal(isOpenRouterFreeModel('openai/gpt-4o'), false)
})

test('isKnownAnthropicModel includes the configured default model', () => {
  const defaultModel = getAnthropicDefaultModel()
  assert.equal(isKnownAnthropicModel(defaultModel), true)
})

test('anthropic defaults to haiku and uses ascending cost labels', () => {
  assert.equal(getAnthropicDefaultModel(), 'claude-3-5-haiku-latest')
  assert.deepEqual(
    ANTHROPIC_MODEL_CATALOG.map((model) => model.label),
    ['Claude Haiku', 'Claude Sonnet', 'Claude Opus'],
  )
  assert.deepEqual(
    ANTHROPIC_MODEL_CATALOG.map((model) => model.costTier),
    [1, 2, 3],
  )
  assert.equal(getAnthropicModelCostTier('claude-3-5-haiku-latest'), 1)
  assert.equal(getAnthropicModelCostTier('claude-opus-4-1'), 3)
})

test('sanitizeModelLabel formats provider/model id for UI display', () => {
  assert.equal(sanitizeModelLabel('openai/gpt-oss-20b:free'), 'openai / gpt oss 20b (free)')
})
