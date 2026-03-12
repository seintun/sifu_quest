import assert from 'node:assert/strict'
import test from 'node:test'

import {
  APP_KEYWORDS,
  BRAND_EMOJIS,
  BRAND_NAME,
  MODE_LABELS,
  buildSifuMasterToneGuidelines,
} from './brand.ts'

test('brand constants expose canonical Sifu values', () => {
  assert.equal(BRAND_NAME, 'Sifu Quest')
  assert.equal(BRAND_EMOJIS.primary, '🥋')
  assert.ok(APP_KEYWORDS.includes('coding interview coach'))
})

test('mode labels are Sifu aligned', () => {
  assert.equal(MODE_LABELS.dsa, 'DSA Sifu')
  assert.equal(MODE_LABELS['system-design'], 'System Design Sifu')
  assert.equal(MODE_LABELS['interview-prep'], 'Interview Prep Sifu')
})

test('sifu master tone guidelines include emoji usage guardrails', () => {
  const guidance = buildSifuMasterToneGuidelines()
  assert.ok(guidance.includes('Sifu Master Tone'))
  assert.ok(guidance.includes('Use emojis sparingly'))
  assert.ok(guidance.includes('🥋'))
})
