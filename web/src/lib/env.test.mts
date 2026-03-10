import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertRequiredEnv,
  getAuthSecret,
  getMissingRequiredEnv,
  MissingEnvironmentVariableError,
} from './env.ts'

const originalEnv = { ...process.env }

function resetEnv() {
  process.env = { ...originalEnv }
}

test('getMissingRequiredEnv returns missing keys', () => {
  resetEnv()
  delete process.env.TEST_A
  process.env.TEST_B = 'value'

  const missing = getMissingRequiredEnv(['TEST_A', 'TEST_B'])
  assert.deepEqual(missing, ['TEST_A'])
})

test('assertRequiredEnv throws with missing env keys', () => {
  resetEnv()
  delete process.env.TEST_REQUIRED

  assert.throws(() => assertRequiredEnv(['TEST_REQUIRED']), MissingEnvironmentVariableError)

  try {
    assertRequiredEnv(['TEST_REQUIRED'])
  } catch (error) {
    assert.ok(error instanceof MissingEnvironmentVariableError)
    assert.equal(error.message, 'Server configuration is incomplete.')
    assert.deepEqual(error.missingKeys, ['TEST_REQUIRED'])
  }
})

test('getAuthSecret prefers NEXTAUTH_SECRET', () => {
  resetEnv()
  process.env.NEXTAUTH_SECRET = 'new-secret'
  process.env.AUTH_SECRET = 'legacy-secret'

  assert.equal(getAuthSecret(), 'new-secret')
})

test('getAuthSecret falls back to AUTH_SECRET', () => {
  resetEnv()
  delete process.env.NEXTAUTH_SECRET
  process.env.AUTH_SECRET = 'legacy-secret'

  assert.equal(getAuthSecret(), 'legacy-secret')
})

test('getAuthSecret throws when neither secret is present', () => {
  resetEnv()
  delete process.env.NEXTAUTH_SECRET
  delete process.env.AUTH_SECRET

  assert.throws(
    () => getAuthSecret(),
    /Missing NEXTAUTH_SECRET/
  )
})
