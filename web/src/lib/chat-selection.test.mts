import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveProviderSelection } from './chat-selection.ts'

const catalogOverride = {
  modelsByProvider: {
    openrouter: [{ id: 'openai/gpt-oss-20b:free' }, { id: 'openai/gpt-4o' }],
    anthropic: [{ id: 'claude-haiku-4-5' }, { id: 'claude-sonnet-4-6' }],
  },
}

test('resolveProviderSelection blocks anthropic without anthropic key', async () => {
  const result = await resolveProviderSelection(
    {
      preferredProvider: 'anthropic',
      preferredModel: 'claude-sonnet-4-6',
      providerKeys: { openrouter: false, anthropic: false },
      openRouterModelScope: 'free_only',
      catalogOverride,
    },
  )

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.failure.error, 'provider_key_required')
  }
})

test('resolveProviderSelection blocks paid OpenRouter model when scope is free_only', async () => {
  const result = await resolveProviderSelection(
    {
      preferredProvider: 'openrouter',
      preferredModel: 'openai/gpt-4o',
      providerKeys: { openrouter: false, anthropic: false },
      openRouterModelScope: 'free_only',
      catalogOverride,
    },
  )

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.failure.error, 'model_unavailable')
  }
})

test('resolveProviderSelection allows paid OpenRouter model when scope is full_catalog', async () => {
  const result = await resolveProviderSelection(
    {
      preferredProvider: 'openrouter',
      preferredModel: 'openai/gpt-4o',
      providerKeys: { openrouter: true, anthropic: false },
      openRouterModelScope: 'full_catalog',
      catalogOverride,
    },
  )

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.deepEqual(result.selection, {
      provider: 'openrouter',
      model: 'openai/gpt-4o',
    })
  }
})

test('resolveProviderSelection falls back to first available model when preferred model is stale', async () => {
  const result = await resolveProviderSelection(
    {
      preferredProvider: 'openrouter',
      preferredModel: 'missing/model:free',
      providerKeys: { openrouter: false, anthropic: false },
      openRouterModelScope: 'free_only',
      catalogOverride,
    },
  )

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.selection.provider, 'openrouter')
    assert.equal(result.selection.model, 'openai/gpt-oss-20b:free')
  }
})
