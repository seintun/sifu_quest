import assert from 'node:assert/strict'
import test from 'node:test'

import { canSaveAnthropicApiKey, shouldShowRemoveApiKey } from './account-settings-ui.ts'

test('canSaveAnthropicApiKey returns false for empty and whitespace input', () => {
  assert.equal(canSaveAnthropicApiKey(''), false)
  assert.equal(canSaveAnthropicApiKey('   '), false)
})

test('canSaveAnthropicApiKey returns true for sk-ant- prefixed input', () => {
  assert.equal(canSaveAnthropicApiKey('sk-ant-abc123'), true)
  assert.equal(canSaveAnthropicApiKey('  sk-ant-abc123  '), true)
})

test('canSaveAnthropicApiKey returns false for non-Anthropic prefix', () => {
  assert.equal(canSaveAnthropicApiKey('sk-live-123'), false)
})

test('shouldShowRemoveApiKey mirrors persisted hasApiKey state', () => {
  assert.equal(shouldShowRemoveApiKey(true), true)
  assert.equal(shouldShowRemoveApiKey(false), false)
  assert.equal(shouldShowRemoveApiKey(undefined), false)
})
