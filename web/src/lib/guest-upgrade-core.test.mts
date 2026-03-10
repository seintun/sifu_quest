import test from 'node:test'
import assert from 'node:assert/strict'

import { getGuestUpgradeRedirectUrl, runGuestGoogleLink } from './guest-upgrade-core.ts'

test('getGuestUpgradeRedirectUrl uses the canonical callback path', () => {
  assert.equal(getGuestUpgradeRedirectUrl('https://app.example.com'), 'https://app.example.com/api/link-google/callback')
})

test('runGuestGoogleLink returns ok on successful linkIdentity call', async () => {
  let receivedRedirectTo = ''

  const result = await runGuestGoogleLink(async ({ options }) => {
    receivedRedirectTo = options.redirectTo
    return { error: null }
  }, 'https://app.example.com')

  assert.deepEqual(result, { ok: true })
  assert.equal(receivedRedirectTo, 'https://app.example.com/api/link-google/callback')
})

test('runGuestGoogleLink returns error payload when linkIdentity fails', async () => {
  const result = await runGuestGoogleLink(async () => ({ error: { message: 'oauth_failed' } }), 'https://app.example.com')

  assert.deepEqual(result, { ok: false, error: 'oauth_failed' })
})
