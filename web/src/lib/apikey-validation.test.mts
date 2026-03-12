import assert from 'node:assert/strict'
import test from 'node:test'

import { validateAnthropicApiKey, validateOpenRouterApiKey } from './apikey-validation.ts'

test('validateAnthropicApiKey returns ok for successful validation response', async () => {
  const fetchStub: typeof fetch = async () => new Response('{}', { status: 200 })
  const result = await validateAnthropicApiKey('sk-ant-valid', fetchStub)
  assert.deepEqual(result, { ok: true })
})

test('validateAnthropicApiKey returns invalid_key for unauthorized responses', async () => {
  const unauthorizedFetch: typeof fetch = async () => new Response('{}', { status: 401 })
  const forbiddenFetch: typeof fetch = async () => new Response('{}', { status: 403 })

  const unauthorized = await validateAnthropicApiKey('sk-ant-invalid', unauthorizedFetch)
  const forbidden = await validateAnthropicApiKey('sk-ant-invalid', forbiddenFetch)

  assert.equal(unauthorized.ok, false)
  if (!unauthorized.ok) {
    assert.equal(unauthorized.code, 'invalid_key')
  }

  assert.equal(forbidden.ok, false)
  if (!forbidden.ok) {
    assert.equal(forbidden.code, 'invalid_key')
  }
})

test('validateAnthropicApiKey returns validation_unavailable for provider failures', async () => {
  const unavailableFetch: typeof fetch = async () => new Response('{}', { status: 500 })
  const throwingFetch: typeof fetch = async () => {
    throw new Error('network down')
  }

  const unavailable = await validateAnthropicApiKey('sk-ant-any', unavailableFetch)
  const throwing = await validateAnthropicApiKey('sk-ant-any', throwingFetch)

  assert.equal(unavailable.ok, false)
  if (!unavailable.ok) {
    assert.equal(unavailable.code, 'validation_unavailable')
  }

  assert.equal(throwing.ok, false)
  if (!throwing.ok) {
    assert.equal(throwing.code, 'validation_unavailable')
  }
})

test('validateOpenRouterApiKey returns ok for successful validation response', async () => {
  const fetchStub: typeof fetch = async () => new Response('{}', { status: 200 })
  const result = await validateOpenRouterApiKey('sk-or-v1-valid', fetchStub)
  assert.deepEqual(result, { ok: true })
})

test('validateOpenRouterApiKey returns invalid_key for unauthorized responses', async () => {
  const unauthorizedFetch: typeof fetch = async () => new Response('{}', { status: 401 })
  const forbiddenFetch: typeof fetch = async () => new Response('{}', { status: 403 })

  const unauthorized = await validateOpenRouterApiKey('sk-or-v1-invalid', unauthorizedFetch)
  const forbidden = await validateOpenRouterApiKey('sk-or-v1-invalid', forbiddenFetch)

  assert.equal(unauthorized.ok, false)
  if (!unauthorized.ok) {
    assert.equal(unauthorized.code, 'invalid_key')
  }

  assert.equal(forbidden.ok, false)
  if (!forbidden.ok) {
    assert.equal(forbidden.code, 'invalid_key')
  }
})

test('validateOpenRouterApiKey returns validation_unavailable for provider failures', async () => {
  const unavailableFetch: typeof fetch = async () => new Response('{}', { status: 500 })
  const throwingFetch: typeof fetch = async () => {
    throw new Error('network down')
  }

  const unavailable = await validateOpenRouterApiKey('sk-or-v1-any', unavailableFetch)
  const throwing = await validateOpenRouterApiKey('sk-or-v1-any', throwingFetch)

  assert.equal(unavailable.ok, false)
  if (!unavailable.ok) {
    assert.equal(unavailable.code, 'validation_unavailable')
  }

  assert.equal(throwing.ok, false)
  if (!throwing.ok) {
    assert.equal(throwing.code, 'validation_unavailable')
  }
})
