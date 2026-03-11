import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createEmptyCoreAnswers,
  createEmptyEnrichmentAnswers,
  fromLegacyOnboardingPayload,
  getCompletionPercent,
  getCoreCompletionPercent,
  getNextEnrichmentPromptKey,
  OnboardingValidationError,
  requiresInterviewLanguage,
  requiresTargetRoles,
  toLegacyOnboardingPayload,
  validateCoreAnswers,
  validateEnrichmentAnswers,
} from './onboarding-v2.ts'

test('requiresTargetRoles is true for job-seeking situations', () => {
  assert.equal(requiresTargetRoles('actively_job_searching'), true)
  assert.equal(requiresTargetRoles('quietly_looking'), true)
  assert.equal(requiresTargetRoles('employed_not_looking'), false)
})

test('requiresInterviewLanguage is true when DSA goal is selected', () => {
  assert.equal(requiresInterviewLanguage(['dsa_leetcode']), true)
  assert.equal(requiresInterviewLanguage(['system_design', 'job_search_strategy']), false)
})

test('validateCoreAnswers accepts complete minimum payload for required branch fields', () => {
  const payload = validateCoreAnswers({
    name: '  ada   lovelace ',
    goals: ['dsa_leetcode'],
    situation: 'actively_job_searching',
    experience: '3_5',
    timeline: '3_months',
    hoursPerWeek: '5_10',
    targetRoles: ['senior_software_engineer'],
    interviewLanguage: 'python',
    weaknesses: ['dsa'],
  })

  assert.equal(payload.name, 'Ada Lovelace')
  assert.deepEqual(payload.goals, ['dsa_leetcode'])
})

test('validateCoreAnswers enforces 1-2 goal requirement', () => {
  assert.throws(
    () =>
      validateCoreAnswers({
        name: 'Grace Hopper',
        goals: [],
        situation: 'employed_not_looking',
        experience: '5_8',
        timeline: '6_months',
        hoursPerWeek: '5_10',
        weaknesses: ['testing'],
      }),
    (error: unknown) => error instanceof OnboardingValidationError && error.field === 'core.goals',
  )
})

test('validateCoreAnswers requires role and language when branch conditions apply', () => {
  assert.throws(
    () =>
      validateCoreAnswers({
        name: 'Grace Hopper',
        goals: ['dsa_leetcode'],
        situation: 'actively_job_searching',
        experience: '5_8',
        timeline: '6_months',
        hoursPerWeek: '5_10',
        weaknesses: ['testing'],
      }),
    (error: unknown) => error instanceof OnboardingValidationError && error.field === 'core.targetRoles',
  )
})

test('validateCoreAnswers does not require role/language for non-branch paths', () => {
  const value = validateCoreAnswers({
    name: 'Grace Hopper',
    goals: ['system_design'],
    situation: 'employed_not_looking',
    experience: '5_8',
    timeline: '6_months',
    hoursPerWeek: '5_10',
    weaknesses: ['testing'],
  })
  assert.equal(value.targetRoles.length, 0)
  assert.equal(value.interviewLanguage, '')
})

test('validateEnrichmentAnswers clamps selections and normalizes text fields', () => {
  const answers = validateEnrichmentAnswers({
    techStack: ['python', 'typescript', 'python', 'invalid_value'],
    notes: '   extra   context    here ',
  })
  assert.deepEqual(answers.techStack, ['python', 'typescript'])
  assert.equal(answers.notes, 'extra context here')
})

test('getCoreCompletionPercent reflects 6 core groups', () => {
  const core = createEmptyCoreAnswers()
  assert.equal(getCoreCompletionPercent(core), 0)

  core.name = 'Ada'
  core.goals = ['system_design']
  core.situation = 'employed_not_looking'
  core.experience = '3_5'
  core.timeline = '3_months'
  core.hoursPerWeek = '5_10'
  core.weaknesses = ['system_design']

  assert.equal(getCoreCompletionPercent(core), 100)
})

test('getCompletionPercent transitions from in-progress to enriched complete', () => {
  const core = createEmptyCoreAnswers()
  const enrichment = createEmptyEnrichmentAnswers()

  core.name = 'Ada'
  core.goals = ['system_design']
  core.situation = 'employed_not_looking'
  core.experience = '3_5'
  core.timeline = '3_months'
  core.hoursPerWeek = '5_10'
  core.weaknesses = ['system_design']

  assert.equal(getCompletionPercent('in_progress', core, enrichment), 100)
  assert.equal(getCompletionPercent('core_complete', core, enrichment), 70)

  enrichment.techStack = ['python']
  enrichment.targetCompanies = ['big_tech']
  enrichment.learningStyle = ['socratic']
  enrichment.strengths = ['system_design']
  assert.equal(getCompletionPercent('enriched_complete', core, enrichment), 100)
})

test('getNextEnrichmentPromptKey returns first missing field in queue order', () => {
  const enrichment = createEmptyEnrichmentAnswers()
  assert.equal(getNextEnrichmentPromptKey(enrichment), 'techStack')

  enrichment.techStack = ['python']
  enrichment.targetCompanies = ['big_tech']
  assert.equal(getNextEnrichmentPromptKey(enrichment), 'learningStyle')
})

test('legacy payload conversion round-trips critical fields', () => {
  const draft = fromLegacyOnboardingPayload({
    name: 'Ada Lovelace',
    situation: 'Actively job searching',
    experience: '3-5 years',
    techStack: 'Python, TypeScript',
    goals: 'DSA and LeetCode prep, System design',
    targetRoles: 'Senior Software Engineer',
    targetCompanies: 'Big Tech',
    timeline: '3 months',
    hoursPerWeek: '5-10 hrs/week',
    language: 'Python',
    learningStyle: 'Socratic method',
    strengths: 'System Design',
    weaknesses: 'DSA or LeetCode',
  })

  const legacy = toLegacyOnboardingPayload(draft.core, draft.enrichment)
  assert.equal(legacy.name, 'Ada Lovelace')
  assert.match(legacy.goals, /DSA and LeetCode prep/)
  assert.match(legacy.language, /Python/)
})
