import assert from 'node:assert/strict'
import test from 'node:test'

import {
  selectInitialFile,
  shouldShowError,
  sortMemoryFiles,
  toMemoryErrorMessage,
} from './memory-view.ts'

test('sortMemoryFiles prioritizes known files and sorts unknowns alphabetically', () => {
  const result = sortMemoryFiles([
    'zeta.md',
    'ideas.md',
    'profile.md',
    'alpha.md',
    'progress.md',
    'profile.md',
  ])

  assert.deepEqual(result, ['profile.md', 'progress.md', 'ideas.md', 'alpha.md', 'zeta.md'])
})

test('selectInitialFile chooses preferred file when present', () => {
  const result = selectInitialFile(['profile.md', 'progress.md'], 'progress.md')
  assert.equal(result, 'progress.md')
})

test('selectInitialFile falls back to first file when preferred file is missing', () => {
  const result = selectInitialFile(['profile.md', 'progress.md'], 'ideas.md')
  assert.equal(result, 'profile.md')
})

test('selectInitialFile returns empty string when no files exist', () => {
  const result = selectInitialFile([], 'profile.md')
  assert.equal(result, '')
})

test('shouldShowError only returns true when loading is finished and an error exists', () => {
  assert.equal(
    shouldShowError({
      error: 'Network failure',
      loading: true,
      files: ['profile.md'],
      selectedFile: 'profile.md',
    }),
    false,
  )

  assert.equal(
    shouldShowError({
      error: 'Network failure',
      loading: false,
      files: ['profile.md'],
      selectedFile: 'profile.md',
    }),
    true,
  )

  assert.equal(
    shouldShowError({
      error: null,
      loading: false,
      files: ['profile.md'],
      selectedFile: 'profile.md',
    }),
    false,
  )
})

test('shouldShowError handles empty file list errors and empty state separately', () => {
  assert.equal(
    shouldShowError({
      error: 'Unable to load memory files',
      loading: false,
      files: [],
      selectedFile: '',
    }),
    true,
  )

  assert.equal(
    shouldShowError({
      error: 'Unable to load this file',
      loading: false,
      files: ['profile.md'],
      selectedFile: '',
    }),
    false,
  )
})

test('toMemoryErrorMessage normalizes unknown errors to fallback message', () => {
  assert.equal(toMemoryErrorMessage('Request timed out', 'Fallback message'), 'Request timed out')
  assert.equal(toMemoryErrorMessage(new Error('Unauthorized'), 'Fallback message'), 'Unauthorized')
  assert.equal(toMemoryErrorMessage(undefined, 'Fallback message'), 'Fallback message')
})
