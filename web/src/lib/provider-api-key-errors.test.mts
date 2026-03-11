import assert from 'node:assert/strict'
import test from 'node:test'

import { ProviderApiKeyStoreError, toProviderApiKeyStoreError } from './provider-api-key-errors.ts'

test('toProviderApiKeyStoreError preserves db code and context', () => {
  const err = toProviderApiKeyStoreError('Failed to save provider API key', {
    code: '23503',
    message: 'insert or update on table violates foreign key constraint',
  })

  assert.ok(err instanceof ProviderApiKeyStoreError)
  assert.equal(err.code, '23503')
  assert.match(err.message, /Failed to save provider API key/)
})
