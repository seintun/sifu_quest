import assert from 'node:assert/strict'
import test from 'node:test'

import { createProgressGetHandler } from './progress-api.ts'

test('progress handler returns 401 without authenticated user', async () => {
  const GET = createProgressGetHandler({
    authFn: async () => null,
    resolveUserIdFn: async () => 'unused',
    computeMetricsFn: async () => ({ ok: true }),
  })

  const response = await GET()

  assert.equal(response.status, 401)
  assert.equal(response.body.error, 'Unauthorized')
})

test('progress handler returns 500 when compute throws', async () => {
  const GET = createProgressGetHandler({
    authFn: async () => ({ user: { id: 'auth-user', email: 'user@example.com' } }),
    resolveUserIdFn: async () => 'canonical-user',
    computeMetricsFn: async () => {
      throw new Error('boom')
    },
  })

  const response = await GET()

  assert.equal(response.status, 500)
  assert.equal(response.body.error, 'boom')
})

test('progress handler returns computed payload', async () => {
  const expected = { value: 'ok' }
  const GET = createProgressGetHandler({
    authFn: async () => ({ user: { id: 'auth-user', email: 'user@example.com' } }),
    resolveUserIdFn: async () => 'canonical-user',
    computeMetricsFn: async () => expected,
  })

  const response = await GET()

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, expected)
})
