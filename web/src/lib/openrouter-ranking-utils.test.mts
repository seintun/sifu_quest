import assert from 'node:assert/strict'
import test from 'node:test'

import { extractFreeModelIdsFromRankingPayload } from './openrouter-ranking-utils.ts'

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
