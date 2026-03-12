import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildRecommendedOpenRouterModels,
  normalizeOpenRouterModelRecords,
  sortAndAnnotateOpenRouterModelsByRanking,
  type OpenRouterModelRecord,
} from './openrouter-model-catalog-utils.ts'

test('normalizeOpenRouterModelRecords sorts by newest created timestamp and deduplicates by id', () => {
  const records: OpenRouterModelRecord[] = [
    { id: 'vendor/model-a:free', created: 100 },
    { id: 'vendor/model-b:free', created: 300 },
    { id: 'vendor/model-c:free', created: 200 },
    { id: 'VENDOR/model-c:free', created: 250 },
    { id: 'vendor/model-a:free', created: 90 },
  ]

  const models = normalizeOpenRouterModelRecords(records)
  assert.deepEqual(models.map((model) => model.id), [
    'vendor/model-b:free',
    'VENDOR/model-c:free',
    'vendor/model-a:free',
  ])
})

test('normalizeOpenRouterModelRecords marks openrouter/free alias as free', () => {
  const models = normalizeOpenRouterModelRecords([
    { id: 'openrouter/free', created: 100 },
    { id: 'openai/gpt-4o', created: 90 },
  ])

  const freeAlias = models.find((model) => model.id === 'openrouter/free')
  const paidModel = models.find((model) => model.id === 'openai/gpt-4o')
  assert.equal(freeAlias?.isFree, true)
  assert.equal(paidModel?.isFree, false)
})

test('sortAndAnnotateOpenRouterModelsByRanking preserves input order when ranking is unavailable', () => {
  const models = normalizeOpenRouterModelRecords([
    { id: 'vendor/newest:free', created: 300 },
    { id: 'vendor/middle:free', created: 200 },
    { id: 'vendor/oldest:free', created: 100 },
  ])

  const ranked = sortAndAnnotateOpenRouterModelsByRanking(models, [])
  assert.deepEqual(ranked.map((model) => model.id), models.map((model) => model.id))
})

test('sortAndAnnotateOpenRouterModelsByRanking prioritizes ranking for recommended order', () => {
  const models = normalizeOpenRouterModelRecords([
    { id: 'vendor/newest:free', created: 300 },
    { id: 'vendor/middle:free', created: 200 },
    { id: 'vendor/oldest:free', created: 100 },
  ])

  const ranked = sortAndAnnotateOpenRouterModelsByRanking(models, [
    'vendor/oldest:free',
    'vendor/middle:free',
  ])

  assert.deepEqual(ranked.map((model) => model.id), [
    'vendor/oldest:free',
    'vendor/middle:free',
    'vendor/newest:free',
  ])
  assert.equal(ranked[0].recommendationRank, 1)
  assert.equal(ranked[1].recommendationRank, 2)
})

test('buildRecommendedOpenRouterModels returns ranked models first and enforces limit', () => {
  const models = normalizeOpenRouterModelRecords([
    { id: 'vendor/newest:free', created: 300 },
    { id: 'vendor/middle:free', created: 200 },
    { id: 'vendor/oldest:free', created: 100 },
  ])

  const recommended = buildRecommendedOpenRouterModels(models, [
    'vendor/oldest:free',
    'vendor/middle:free',
  ], 1)

  assert.deepEqual(recommended.map((model) => model.id), ['vendor/oldest:free'])
  assert.equal(recommended[0].recommendationRank, 1)
})

test('buildRecommendedOpenRouterModels falls back to newest models when ranking is missing', () => {
  const models = normalizeOpenRouterModelRecords([
    { id: 'vendor/newest:free', created: 300 },
    { id: 'vendor/middle:free', created: 200 },
    { id: 'vendor/oldest:free', created: 100 },
  ])

  const recommended = buildRecommendedOpenRouterModels(models, [], 20)
  assert.deepEqual(recommended.map((model) => model.id), [
    'vendor/newest:free',
    'vendor/middle:free',
    'vendor/oldest:free',
  ])
})

test('buildRecommendedOpenRouterModels fallback honors requested limit', () => {
  const models = normalizeOpenRouterModelRecords([
    { id: 'vendor/newest:free', created: 300 },
    { id: 'vendor/middle:free', created: 200 },
    { id: 'vendor/oldest:free', created: 100 },
  ])

  const recommended = buildRecommendedOpenRouterModels(models, [], 2)
  assert.deepEqual(recommended.map((model) => model.id), [
    'vendor/newest:free',
    'vendor/middle:free',
  ])
})
