import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DOJO_TITLE_ROLL_EFFECT_MS,
  DOJO_TITLE_NAMES,
  DOJO_TITLE_TRAITS,
  generateDojoTitle,
  generateDojoTitlePhrase,
} from './dojo-title.ts'

test('dojo title word lists include at least twenty options each', () => {
  assert.ok(DOJO_TITLE_TRAITS.length >= 20)
  assert.ok(DOJO_TITLE_NAMES.length >= 20)
})

test('generateDojoTitle returns a deterministic phrase when random source is deterministic', () => {
  const picks = [0, 0.999]
  let index = 0

  const result = generateDojoTitle(() => {
    const next = picks[index]
    index += 1
    return next
  })

  assert.equal(result.trait, DOJO_TITLE_TRAITS[0])
  assert.equal(result.name, DOJO_TITLE_NAMES[DOJO_TITLE_NAMES.length - 1])
  assert.equal(result.phrase, `${result.trait} ${result.name}`)
})

test('generated phrase parts always come from approved lists', () => {
  const result = generateDojoTitle()

  assert.ok(DOJO_TITLE_TRAITS.includes(result.trait))
  assert.ok(DOJO_TITLE_NAMES.includes(result.name))
  assert.equal(result.phrase, `${result.trait} ${result.name}`)
})

test('generateDojoTitlePhrase returns deterministic value for deterministic random source', () => {
  const picks = [0, 0.999]
  let index = 0

  const phrase = generateDojoTitlePhrase(() => {
    const next = picks[index]
    index += 1
    return next
  })

  assert.equal(phrase, `${DOJO_TITLE_TRAITS[0]} ${DOJO_TITLE_NAMES[DOJO_TITLE_NAMES.length - 1]}`)
})

test('roll effect duration is lightweight and bounded', () => {
  assert.equal(DOJO_TITLE_ROLL_EFFECT_MS, 700)
})
