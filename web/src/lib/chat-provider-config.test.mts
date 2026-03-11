import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getAnthropicDefaultModel,
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

test('sanitizeModelLabel formats provider/model id for UI display', () => {
  assert.equal(sanitizeModelLabel('openai/gpt-oss-20b:free'), 'openai / gpt oss 20b (free)')
})
