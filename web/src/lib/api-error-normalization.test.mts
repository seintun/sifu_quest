import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeApiError } from './api-error-normalization.ts'

test('normalizeApiError maps invalid JSON syntax errors to 400', () => {
  const normalized = normalizeApiError(new SyntaxError('Unexpected token } in JSON at position 10'))

  assert.deepEqual(normalized, {
    status: 400,
    code: 'invalid_json',
    message: 'Invalid JSON payload.',
    exposeMessage: true,
  })
})

test('normalizeApiError maps session-expiry style errors to 401', () => {
  const sessionError = new Error('Session expired while validating token')
  sessionError.name = 'JWTSessionError'

  const normalized = normalizeApiError(sessionError)

  assert.deepEqual(normalized, {
    status: 401,
    code: 'auth_expired',
    message: 'Session expired. Please sign in again.',
    exposeMessage: true,
  })
})

test('normalizeApiError preserves onboarding migration errors as 503', () => {
  const migrationError = new Error('run migrations')
  migrationError.name = 'OnboardingMigrationRequiredError'

  const normalized = normalizeApiError(migrationError)

  assert.deepEqual(normalized, {
    status: 503,
    code: 'onboarding_schema_unavailable',
    message: 'run migrations',
    exposeMessage: true,
  })
})

test('normalizeApiError falls back to internal error for unknown failures', () => {
  const normalized = normalizeApiError(new Error('db exploded'))

  assert.deepEqual(normalized, {
    status: 500,
    code: 'internal_error',
    message: 'db exploded',
    exposeMessage: false,
  })
})
