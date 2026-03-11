import type { OnboardingCoreAnswers } from './onboarding-v2'

const TARGET_ROLE_REQUIRED_SITUATIONS = new Set<string>([
  'actively_job_searching',
  'quietly_looking',
  'between_jobs',
  'student_bootcamp',
  'career_pivot',
])

const INTERVIEW_LANGUAGE_REQUIRED_GOALS = new Set<string>([
  'dsa_leetcode',
])

function requiresTargetRoles(situation: string): boolean {
  return TARGET_ROLE_REQUIRED_SITUATIONS.has(situation)
}

function requiresInterviewLanguage(goals: readonly string[]): boolean {
  return goals.some((goal) => INTERVIEW_LANGUAGE_REQUIRED_GOALS.has(goal))
}

export type OnboardingCoreStepKey =
  | 'name'
  | 'goals'
  | 'context'
  | 'constraints'
  | 'targetRoles'
  | 'interviewLanguage'
  | 'gaps'

export function getOnboardingCoreSteps(core: OnboardingCoreAnswers): OnboardingCoreStepKey[] {
  const steps: OnboardingCoreStepKey[] = ['name', 'goals', 'context', 'constraints']
  if (requiresTargetRoles(core.situation)) {
    steps.push('targetRoles')
  }
  if (requiresInterviewLanguage(core.goals)) {
    steps.push('interviewLanguage')
  }
  steps.push('gaps')
  return steps
}

export function isCoreStepComplete(step: OnboardingCoreStepKey, core: OnboardingCoreAnswers): boolean {
  switch (step) {
    case 'name':
      return core.name.trim().length > 0
    case 'goals':
      return core.goals.length >= 1 && core.goals.length <= 2
    case 'context':
      return Boolean(core.situation && core.experience)
    case 'constraints':
      return Boolean((core.timeline || core.timelineCustom) && (core.hoursPerWeek || core.hoursPerWeekCustom))
    case 'targetRoles':
      return core.targetRoles.length > 0 || core.targetRolesCustom.trim().length > 0
    case 'interviewLanguage':
      return Boolean(core.interviewLanguage || core.interviewLanguageCustom)
    case 'gaps':
      return core.weaknesses.length >= 1 && core.weaknesses.length <= 2
    default:
      return false
  }
}
