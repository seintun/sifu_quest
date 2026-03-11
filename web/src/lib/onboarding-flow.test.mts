import assert from 'node:assert/strict'
import test from 'node:test'

import { getOnboardingCoreSteps, isCoreStepComplete } from './onboarding-flow.ts'
import { createEmptyCoreAnswers } from './onboarding-v2.ts'

test('getOnboardingCoreSteps returns 4-step baseline plus gaps when no branch conditions match', () => {
  const core = createEmptyCoreAnswers()
  core.goals = ['system_design']
  core.situation = 'employed_not_looking'

  assert.deepEqual(getOnboardingCoreSteps(core), [
    'name',
    'goals',
    'context',
    'constraints',
    'gaps',
  ])
})

test('getOnboardingCoreSteps includes role and language branches when required', () => {
  const core = createEmptyCoreAnswers()
  core.goals = ['dsa_leetcode']
  core.situation = 'actively_job_searching'

  assert.deepEqual(getOnboardingCoreSteps(core), [
    'name',
    'goals',
    'context',
    'constraints',
    'targetRoles',
    'interviewLanguage',
    'gaps',
  ])
})

test('isCoreStepComplete validates constraints and capped weakness selections', () => {
  const core = createEmptyCoreAnswers()
  core.timeline = '3_months'
  core.hoursPerWeek = '5_10'
  core.weaknesses = ['dsa']

  assert.equal(isCoreStepComplete('constraints', core), true)
  assert.equal(isCoreStepComplete('gaps', core), true)

  core.weaknesses = []
  assert.equal(isCoreStepComplete('gaps', core), false)
})
