import assert from 'node:assert/strict'
import test from 'node:test'

import { extractFreeModelIdsFromRankingPayload, extractRankingModelIdsFromPayload } from './openrouter-ranking-utils.ts'

test('extractFreeModelIdsFromRankingPayload supports multiple payload shapes', () => {
  const payload = [
    '... "variant_permaslug":"openai/gpt-oss-20b:free" ...',
    '... href="/stepfun/step-3.5-flash:free" ...',
    '... nvidia/nemotron-3-super-120b-a12b:free ...',
    '... "variant_permaslug":"openai/gpt-oss-20b:free" ...',
  ].join('\n')

  assert.deepEqual(extractFreeModelIdsFromRankingPayload(payload), [
    'openai/gpt-oss-20b:free',
    'stepfun/step-3.5-flash:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
  ])
})

test('extractRankingModelIdsFromPayload captures free and paid model identifiers', () => {
  const payload = [
    '... "variant_permaslug":"anthropic/claude-sonnet-4-5" ...',
    '... href="/openai/gpt-oss-20b:free" ...',
  ].join('\n')

  assert.deepEqual(extractRankingModelIdsFromPayload(payload), [
    'anthropic/claude-sonnet-4-5',
    'openai/gpt-oss-20b:free',
  ])
})

test('extractRankingModelIdsFromPayload ignores non-model ranking links and URL fragments', () => {
  const payload = [
    '... href="/rankings?category=programming#categories" ...',
    '... href="/pricing" ...',
    '... href="/openai/gpt-oss-20b:free?tab=details" ...',
    '... href="/meta-llama/llama-3.3-70b-instruct:free" ...',
    '... "variant_permaslug":"openai/gpt-4o" ...',
  ].join('\n')

  assert.deepEqual(extractRankingModelIdsFromPayload(payload), [
    'openai/gpt-4o',
    'meta-llama/llama-3.3-70b-instruct:free',
  ])
})
