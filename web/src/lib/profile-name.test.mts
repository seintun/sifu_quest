import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_FULL_NAME_LENGTH,
  normalizeFullName,
  updateProfileNameInMarkdown,
  validateFullName,
} from './profile-name.ts'

test('normalizeFullName trims and collapses whitespace', () => {
  assert.equal(normalizeFullName('  Ada   Lovelace  '), 'Ada Lovelace')
})

test('validateFullName rejects empty names', () => {
  const result = validateFullName('   ')
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.error, 'Full name is required.')
  }
})

test('validateFullName rejects too long names', () => {
  const result = validateFullName('a'.repeat(MAX_FULL_NAME_LENGTH + 1))
  assert.equal(result.ok, false)
})

test('validateFullName returns normalized value', () => {
  const result = validateFullName('  Grace   Hopper  ')
  assert.deepEqual(result, { ok: true, value: 'Grace Hopper' })
})

test('updateProfileNameInMarkdown updates existing name line', () => {
  const input = `# User Profile\n\n## Career Context & Goals\n\n- **Name:** Old Name\n- **Situation:** Actively searching\n`
  const output = updateProfileNameInMarkdown(input, 'New Name')
  assert.match(output, /- \*\*Name:\*\* New Name/)
  assert.doesNotMatch(output, /Old Name/)
})

test('updateProfileNameInMarkdown inserts name under Career Context when missing', () => {
  const input = `# User Profile\n\n## Career Context & Goals\n\n- **Situation:** Actively searching\n`
  const output = updateProfileNameInMarkdown(input, 'Jane Doe')
  assert.match(output, /## Career Context & Goals\n\n- \*\*Name:\*\* Jane Doe/)
  assert.match(output, /- \*\*Situation:\*\* Actively searching/)
})

test('updateProfileNameInMarkdown appends section when absent', () => {
  const input = `# User Profile\n\n## Notes\n\n- hello\n`
  const output = updateProfileNameInMarkdown(input, 'Jane Doe')
  assert.match(output, /## Career Context & Goals\n\n- \*\*Name:\*\* Jane Doe/)
})
