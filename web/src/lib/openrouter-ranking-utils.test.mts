import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractFreeModelIdsFromRankingPayload,
  extractRankingModelIdsFromPayload,
  mergeRankingModelOrders,
} from './openrouter-ranking-utils.ts'

test('extractFreeModelIdsFromRankingPayload supports multiple payload shapes', () => {
  const payload = [
    '... "variant_permaslug":"openai/gpt-oss-20b:free" ...',
    '... "variant_permaslug":"stepfun/step-3.5-flash:free" ...',
    '... "variant_permaslug":"nvidia/nemotron-3-super-120b-a12b:free" ...',
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
    '... "variant_permaslug":"openai/gpt-oss-20b:free" ...',
    '... href="/openai/gpt-oss-20b:free" ...',
  ].join('\n')

  assert.deepEqual(extractRankingModelIdsFromPayload(payload), [
    'anthropic/claude-sonnet-4-5',
    'openai/gpt-oss-20b:free',
  ])
})

test('extractRankingModelIdsFromPayload ignores non-model ranking links and URL fragments', () => {
  const payload = [
    '... "variant_permaslug":"openai/gpt-4o" ...',
    '... "variant_permaslug":"meta-llama/llama-3.3-70b-instruct:free" ...',
    '... href="/rankings?category=programming#categories" ...',
    '... href="/pricing" ...',
    '... href="/openai/gpt-oss-20b:free?tab=details" ...',
    '... href="/meta-llama/llama-3.3-70b-instruct:free" ...',
  ].join('\n')

  assert.deepEqual(extractRankingModelIdsFromPayload(payload), [
    'openai/gpt-4o',
    'meta-llama/llama-3.3-70b-instruct:free',
  ])
})

test('extractRankingModelIdsFromPayload prefers variant_permaslug over noisy href paths', () => {
  const payload = [
    '... href="/docs/quickstart" ...',
    '... href="/static/css" ...',
    '... "variant_permaslug":"minimax/minimax-m2.5-20260211" ...',
    '... "variant_permaslug":"stepfun/step-3.5-flash:free" ...',
  ].join('\n')

  assert.deepEqual(extractRankingModelIdsFromPayload(payload), [
    'minimax/minimax-m2.5-20260211',
    'stepfun/step-3.5-flash:free',
  ])
})

test('mergeRankingModelOrders prioritizes models appearing across multiple rankings', () => {
  const merged = mergeRankingModelOrders([
    ['vendor/a', 'vendor/b', 'vendor/c'],
    ['vendor/b', 'vendor/a', 'vendor/d'],
    ['vendor/b', 'vendor/e', 'vendor/a'],
  ])

  assert.deepEqual(merged.slice(0, 5), [
    'vendor/b',
    'vendor/a',
    'vendor/e',
    'vendor/c',
    'vendor/d',
  ])
})
