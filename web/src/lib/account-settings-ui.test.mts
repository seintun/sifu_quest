import assert from 'node:assert/strict'
import test from 'node:test'

import { canSaveProviderApiKey, shouldShowRemoveApiKey } from './account-settings-ui.ts'

test('canSaveProviderApiKey returns false for empty and whitespace input', () => {
  assert.equal(canSaveProviderApiKey('anthropic', ''), false)
  assert.equal(canSaveProviderApiKey('openrouter', '   '), false)
})

test('canSaveProviderApiKey validates anthropic prefixes', () => {
  assert.equal(canSaveProviderApiKey('anthropic', 'sk-ant-abc123'), true)
  assert.equal(canSaveProviderApiKey('anthropic', '  sk-ant-abc123  '), true)
  assert.equal(canSaveProviderApiKey('anthropic', 'sk-or-v1-abc123'), false)
})

test('canSaveProviderApiKey validates openrouter prefixes', () => {
  assert.equal(canSaveProviderApiKey('openrouter', 'sk-or-v1-abc123'), true)
  assert.equal(canSaveProviderApiKey('openrouter', '  sk-or-v1-abc123  '), true)
  assert.equal(canSaveProviderApiKey('openrouter', 'sk-ant-abc123'), false)
})

test('shouldShowRemoveApiKey mirrors persisted hasApiKey state', () => {
  assert.equal(shouldShowRemoveApiKey(true), true)
  assert.equal(shouldShowRemoveApiKey(false), false)
  assert.equal(shouldShowRemoveApiKey(undefined), false)
})
