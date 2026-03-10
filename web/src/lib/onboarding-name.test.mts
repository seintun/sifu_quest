import assert from 'node:assert/strict'
import test from 'node:test'

import { getOnboardingPrefillName, getPersistableOnboardingDisplayName } from './onboarding-name.ts'

test('getOnboardingPrefillName prioritizes saved displayName over prefillName', () => {
  assert.equal(getOnboardingPrefillName('Saved Name', 'Google Name'), 'Saved Name')
})

test('getOnboardingPrefillName falls back to prefillName when displayName is missing', () => {
  assert.equal(getOnboardingPrefillName(null, 'Google Name'), 'Google Name')
})

test('getOnboardingPrefillName returns empty string when both sources are missing', () => {
  assert.equal(getOnboardingPrefillName(null, null), '')
})

test('getPersistableOnboardingDisplayName returns normalized valid name', () => {
  assert.equal(getPersistableOnboardingDisplayName('  Ada   Lovelace  '), 'Ada Lovelace')
})

test('getPersistableOnboardingDisplayName returns null for empty/invalid input', () => {
  assert.equal(getPersistableOnboardingDisplayName('   '), null)
  assert.equal(getPersistableOnboardingDisplayName('a'.repeat(81)), null)
  assert.equal(getPersistableOnboardingDisplayName(42), null)
})
