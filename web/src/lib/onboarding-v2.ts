export const ONBOARDING_SCHEMA_VERSION = 2

export const ONBOARDING_DRAFT_STORAGE_KEY = 'sifu:onboarding:v2:draft'

export const ONBOARDING_MAX_TEXT_LENGTH = 300
export const ONBOARDING_MAX_NAME_LENGTH = 80

export type OnboardingStatus =
  | 'not_started'
  | 'in_progress'
  | 'core_complete'
  | 'enriched_complete'

export type PlanStatus =
  | 'not_queued'
  | 'queued'
  | 'running'
  | 'ready'
  | 'failed'

export type SelectOption = { value: string; label: string }

export const SITUATION_OPTIONS: SelectOption[] = [
  { value: 'actively_job_searching', label: 'Actively job searching' },
  { value: 'quietly_looking', label: 'Employed and quietly looking' },
  { value: 'student_bootcamp', label: 'Student or bootcamp grad' },
  { value: 'between_jobs', label: 'Between jobs or laid off' },
  { value: 'career_pivot', label: 'Career pivot' },
  { value: 'employed_not_looking', label: 'Employed, not looking yet' },
]

export const EXPERIENCE_OPTIONS: SelectOption[] = [
  { value: 'lt_1', label: '< 1 year' },
  { value: '1_2', label: '1-2 years' },
  { value: '3_5', label: '3-5 years' },
  { value: '5_8', label: '5-8 years' },
  { value: '8_plus', label: '8+ years' },
]

export const GOAL_OPTIONS: SelectOption[] = [
  { value: 'dsa_leetcode', label: 'DSA and LeetCode prep' },
  { value: 'system_design', label: 'System design' },
  { value: 'job_search_strategy', label: 'Job search strategy' },
  { value: 'behavioral_interviews', label: 'Behavioral interview prep' },
  { value: 'business_startup_ideas', label: 'Business or startup ideas' },
  { value: 'general_leveling_up', label: 'General learning and leveling up' },
]

export const TIMELINE_OPTIONS: SelectOption[] = [
  { value: '1_month', label: '1 month' },
  { value: '2_months', label: '2 months' },
  { value: '3_months', label: '3 months' },
  { value: '6_months', label: '6 months' },
  { value: '1_year', label: '1 year' },
  { value: 'active_interviewing', label: 'Actively interviewing now' },
  { value: 'no_deadline', label: 'No hard deadline' },
]

export const HOURS_PER_WEEK_OPTIONS: SelectOption[] = [
  { value: 'lt_5', label: '< 5 hrs/week' },
  { value: '5_10', label: '5-10 hrs/week' },
  { value: '10_15', label: '10-15 hrs/week' },
  { value: '15_plus', label: '15+ hrs/week' },
]

export const TARGET_ROLE_OPTIONS: SelectOption[] = [
  { value: 'software_engineer', label: 'Software Engineer' },
  { value: 'senior_software_engineer', label: 'Senior Software Engineer' },
  { value: 'staff_engineer', label: 'Staff Engineer' },
  { value: 'frontend_engineer', label: 'Frontend Engineer' },
  { value: 'backend_engineer', label: 'Backend Engineer' },
  { value: 'fullstack_engineer', label: 'Full-Stack Engineer' },
  { value: 'engineering_manager', label: 'Engineering Manager' },
  { value: 'tech_lead', label: 'Tech Lead' },
  { value: 'principal_engineer', label: 'Principal Engineer' },
  { value: 'data_engineer', label: 'Data Engineer' },
]

export const INTERVIEW_LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'csharp', label: 'C#' },
]

export const WEAKNESS_OPTIONS: SelectOption[] = [
  { value: 'dsa', label: 'DSA or LeetCode' },
  { value: 'system_design', label: 'System Design' },
  { value: 'behavioral', label: 'Behavioral Interviews' },
  { value: 'distributed_systems', label: 'Distributed Systems' },
  { value: 'low_level', label: 'Low-level Programming' },
  { value: 'ml_ai', label: 'Machine Learning or AI' },
  { value: 'frontend', label: 'Frontend or UI' },
  { value: 'backend', label: 'Backend or APIs' },
  { value: 'devops', label: 'DevOps or Infrastructure' },
  { value: 'sql', label: 'SQL or Databases' },
  { value: 'cloud', label: 'Cloud Architecture' },
  { value: 'testing', label: 'Testing' },
  { value: 'communication', label: 'Communication or Tech Writing' },
  { value: 'leadership', label: 'Leadership and Mentoring' },
  { value: 'security', label: 'Security' },
]

export const TECH_STACK_OPTIONS: SelectOption[] = [
  { value: 'react', label: 'React' },
  { value: 'nextjs', label: 'Next.js' },
  { value: 'vue', label: 'Vue' },
  { value: 'angular', label: 'Angular' },
  { value: 'nodejs', label: 'Node.js' },
  { value: 'express', label: 'Express' },
  { value: 'fastapi', label: 'FastAPI' },
  { value: 'django', label: 'Django' },
  { value: 'spring_boot', label: 'Spring Boot' },
  { value: 'rails', label: 'Rails' },
  { value: 'python', label: 'Python' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mongodb', label: 'MongoDB' },
  { value: 'redis', label: 'Redis' },
  { value: 'aws', label: 'AWS' },
  { value: 'gcp', label: 'GCP' },
  { value: 'azure', label: 'Azure' },
  { value: 'docker', label: 'Docker' },
  { value: 'kubernetes', label: 'Kubernetes' },
  { value: 'graphql', label: 'GraphQL' },
]

export const TARGET_COMPANY_OPTIONS: SelectOption[] = [
  { value: 'faang', label: 'FAANG or MAANG' },
  { value: 'big_tech', label: 'Big Tech' },
  { value: 'mid_stage_startups', label: 'Mid-stage startups (Series B+)' },
  { value: 'pre_ipo', label: 'Pre-IPO unicorns' },
  { value: 'remote_first', label: 'Remote-first' },
  { value: 'google', label: 'Google' },
  { value: 'meta', label: 'Meta' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'apple', label: 'Apple' },
  { value: 'microsoft', label: 'Microsoft' },
  { value: 'netflix', label: 'Netflix' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'uber', label: 'Uber' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'coinbase', label: 'Coinbase' },
  { value: 'doordash', label: 'DoorDash' },
]

export const LEARNING_STYLE_OPTIONS: SelectOption[] = [
  { value: 'think_out_loud', label: 'Think out loud together' },
  { value: 'hints_first', label: 'Hints before answers' },
  { value: 'direct_explanations', label: 'Direct explanations' },
  { value: 'scaffolding', label: 'Hand-holding and scaffolding' },
  { value: 'socratic', label: 'Socratic method' },
  { value: 'examples_first', label: 'Show me examples first' },
]

export const STRENGTH_OPTIONS: SelectOption[] = [
  { value: 'react_frontend', label: 'React or Frontend' },
  { value: 'node_backend', label: 'Node.js or Backend' },
  { value: 'python', label: 'Python' },
  { value: 'java_jvm', label: 'Java or JVM' },
  { value: 'algorithms', label: 'Algorithms and Data Structures' },
  { value: 'system_design', label: 'System Design' },
  { value: 'api_design', label: 'API Design' },
  { value: 'sql_databases', label: 'SQL or Databases' },
  { value: 'cloud_infra', label: 'Cloud Infrastructure' },
  { value: 'devops_ci_cd', label: 'DevOps or CI/CD' },
  { value: 'ml_ai', label: 'Machine Learning or AI' },
  { value: 'mobile', label: 'Mobile Development' },
  { value: 'testing_qa', label: 'Testing and QA' },
  { value: 'security', label: 'Security' },
  { value: 'performance', label: 'Performance Optimization' },
  { value: 'microservices', label: 'Microservices' },
]

const ALLOWED_SITUATION_VALUES = new Set(SITUATION_OPTIONS.map((option) => option.value))
const ALLOWED_EXPERIENCE_VALUES = new Set(EXPERIENCE_OPTIONS.map((option) => option.value))
const ALLOWED_GOAL_VALUES = new Set(GOAL_OPTIONS.map((option) => option.value))
const ALLOWED_TIMELINE_VALUES = new Set(TIMELINE_OPTIONS.map((option) => option.value))
const ALLOWED_HOURS_VALUES = new Set(HOURS_PER_WEEK_OPTIONS.map((option) => option.value))
const ALLOWED_ROLE_VALUES = new Set(TARGET_ROLE_OPTIONS.map((option) => option.value))
const ALLOWED_LANGUAGE_VALUES = new Set(INTERVIEW_LANGUAGE_OPTIONS.map((option) => option.value))
const ALLOWED_WEAKNESS_VALUES = new Set(WEAKNESS_OPTIONS.map((option) => option.value))
const ALLOWED_TECH_STACK_VALUES = new Set(TECH_STACK_OPTIONS.map((option) => option.value))
const ALLOWED_TARGET_COMPANY_VALUES = new Set(TARGET_COMPANY_OPTIONS.map((option) => option.value))
const ALLOWED_LEARNING_STYLE_VALUES = new Set(LEARNING_STYLE_OPTIONS.map((option) => option.value))
const ALLOWED_STRENGTH_VALUES = new Set(STRENGTH_OPTIONS.map((option) => option.value))

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

const ENRICHMENT_PROMPT_ORDER: Array<keyof OnboardingEnrichmentAnswers> = [
  'techStack',
  'targetCompanies',
  'learningStyle',
  'strengths',
]

export interface OnboardingCoreAnswers {
  name: string
  goals: string[]
  situation: string
  experience: string
  timeline: string
  timelineCustom: string
  hoursPerWeek: string
  hoursPerWeekCustom: string
  targetRoles: string[]
  targetRolesCustom: string
  interviewLanguage: string
  interviewLanguageCustom: string
  weaknesses: string[]
  weaknessesCustom: string
  contextNote: string
}

export interface OnboardingEnrichmentAnswers {
  techStack: string[]
  techStackCustom: string
  targetCompanies: string[]
  targetCompaniesCustom: string
  learningStyle: string[]
  learningStyleCustom: string
  strengths: string[]
  strengthsCustom: string
  notes: string
}

export interface OnboardingDraftPayload {
  schemaVersion: number
  core: OnboardingCoreAnswers
  enrichment: OnboardingEnrichmentAnswers
  currentStep: number
}

export interface OnboardingStatusPayload {
  version: number
  status: OnboardingStatus
  completionPercent: number
  nextPromptKey: string | null
  draftAvailable: boolean
}

export interface OnboardingPlanPayload {
  status: PlanStatus
  lastErrorCode: string | null
  errorDetails?: Record<string, any> | null
}

export class OnboardingValidationError extends Error {
  readonly field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'OnboardingValidationError'
    this.field = field
  }
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeText(value: unknown, maxLength: number = ONBOARDING_MAX_TEXT_LENGTH): string {
  if (typeof value !== 'string') {
    return ''
  }
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length > maxLength) {
    return normalized.slice(0, maxLength)
  }
  return normalized
}

function normalizeMultiSelect(value: unknown, maxCount: number, allowedValues: Set<string>): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  const uniqueValues = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') {
      continue
    }
    const normalized = item.trim()
    if (!normalized || !allowedValues.has(normalized)) {
      continue
    }
    uniqueValues.add(normalized)
    if (uniqueValues.size >= maxCount) {
      break
    }
  }
  return [...uniqueValues]
}

function normalizeSingleSelect(value: unknown, allowedValues: Set<string>): string {
  if (typeof value !== 'string') {
    return ''
  }
  const normalized = value.trim()
  if (!allowedValues.has(normalized)) {
    return ''
  }
  return normalized
}

function toTitleCaseName(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ')
}

export function createEmptyCoreAnswers(): OnboardingCoreAnswers {
  return {
    name: '',
    goals: [],
    situation: '',
    experience: '',
    timeline: '',
    timelineCustom: '',
    hoursPerWeek: '',
    hoursPerWeekCustom: '',
    targetRoles: [],
    targetRolesCustom: '',
    interviewLanguage: '',
    interviewLanguageCustom: '',
    weaknesses: [],
    weaknessesCustom: '',
    contextNote: '',
  }
}

export function createEmptyEnrichmentAnswers(): OnboardingEnrichmentAnswers {
  return {
    techStack: [],
    techStackCustom: '',
    targetCompanies: [],
    targetCompaniesCustom: '',
    learningStyle: [],
    learningStyleCustom: '',
    strengths: [],
    strengthsCustom: '',
    notes: '',
  }
}

export function createEmptyOnboardingDraftPayload(): OnboardingDraftPayload {
  return {
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    core: createEmptyCoreAnswers(),
    enrichment: createEmptyEnrichmentAnswers(),
    currentStep: 0,
  }
}

export function requiresTargetRoles(situation: string): boolean {
  return TARGET_ROLE_REQUIRED_SITUATIONS.has(situation)
}

export function requiresInterviewLanguage(goals: readonly string[]): boolean {
  return goals.some((goal) => INTERVIEW_LANGUAGE_REQUIRED_GOALS.has(goal))
}

function validateCoreRequiredFields(core: OnboardingCoreAnswers): void {
  if (!core.name) {
    throw new OnboardingValidationError('core.name', 'Name is required.')
  }
  if (core.name.length > ONBOARDING_MAX_NAME_LENGTH) {
    throw new OnboardingValidationError('core.name', 'Name exceeds maximum length.')
  }
  if (core.goals.length < 1 || core.goals.length > 2) {
    throw new OnboardingValidationError('core.goals', 'Select 1 to 2 primary goals.')
  }
  if (!core.situation) {
    throw new OnboardingValidationError('core.situation', 'Situation is required.')
  }
  if (!core.experience) {
    throw new OnboardingValidationError('core.experience', 'Experience is required.')
  }
  if (!core.timeline && !core.timelineCustom) {
    throw new OnboardingValidationError('core.timeline', 'Timeline is required.')
  }
  if (!core.hoursPerWeek && !core.hoursPerWeekCustom) {
    throw new OnboardingValidationError('core.hoursPerWeek', 'Hours per week is required.')
  }
  if (requiresTargetRoles(core.situation) && core.targetRoles.length === 0 && !core.targetRolesCustom) {
    throw new OnboardingValidationError('core.targetRoles', 'Target role is required for your current situation.')
  }
  if (requiresInterviewLanguage(core.goals) && !core.interviewLanguage && !core.interviewLanguageCustom) {
    throw new OnboardingValidationError('core.interviewLanguage', 'Interview language is required for DSA-focused goals.')
  }
  if (core.weaknesses.length < 1 || core.weaknesses.length > 2) {
    throw new OnboardingValidationError('core.weaknesses', 'Select 1 to 2 growth areas.')
  }
}

export function normalizeCoreAnswers(value: unknown): OnboardingCoreAnswers {
  const payload = isRecord(value) ? value : {}
  return {
    name: toTitleCaseName(normalizeText(payload.name, ONBOARDING_MAX_NAME_LENGTH)),
    goals: normalizeMultiSelect(payload.goals, 2, ALLOWED_GOAL_VALUES),
    situation: normalizeSingleSelect(payload.situation, ALLOWED_SITUATION_VALUES),
    experience: normalizeSingleSelect(payload.experience, ALLOWED_EXPERIENCE_VALUES),
    timeline: normalizeSingleSelect(payload.timeline, ALLOWED_TIMELINE_VALUES),
    timelineCustom: normalizeText(payload.timelineCustom),
    hoursPerWeek: normalizeSingleSelect(payload.hoursPerWeek, ALLOWED_HOURS_VALUES),
    hoursPerWeekCustom: normalizeText(payload.hoursPerWeekCustom),
    targetRoles: normalizeMultiSelect(payload.targetRoles, 3, ALLOWED_ROLE_VALUES),
    targetRolesCustom: normalizeText(payload.targetRolesCustom),
    interviewLanguage: normalizeSingleSelect(payload.interviewLanguage, ALLOWED_LANGUAGE_VALUES),
    interviewLanguageCustom: normalizeText(payload.interviewLanguageCustom),
    weaknesses: normalizeMultiSelect(payload.weaknesses, 2, ALLOWED_WEAKNESS_VALUES),
    weaknessesCustom: normalizeText(payload.weaknessesCustom),
    contextNote: normalizeText(payload.contextNote),
  }
}

export function normalizeEnrichmentAnswers(value: unknown): OnboardingEnrichmentAnswers {
  const payload = isRecord(value) ? value : {}
  return {
    techStack: normalizeMultiSelect(payload.techStack, 8, ALLOWED_TECH_STACK_VALUES),
    techStackCustom: normalizeText(payload.techStackCustom),
    targetCompanies: normalizeMultiSelect(payload.targetCompanies, 8, ALLOWED_TARGET_COMPANY_VALUES),
    targetCompaniesCustom: normalizeText(payload.targetCompaniesCustom),
    learningStyle: normalizeMultiSelect(payload.learningStyle, 3, ALLOWED_LEARNING_STYLE_VALUES),
    learningStyleCustom: normalizeText(payload.learningStyleCustom),
    strengths: normalizeMultiSelect(payload.strengths, 3, ALLOWED_STRENGTH_VALUES),
    strengthsCustom: normalizeText(payload.strengthsCustom),
    notes: normalizeText(payload.notes),
  }
}

export function validateCoreAnswers(value: unknown): OnboardingCoreAnswers {
  const core = normalizeCoreAnswers(value)
  validateCoreRequiredFields(core)
  return core
}

export function validateEnrichmentAnswers(value: unknown): OnboardingEnrichmentAnswers {
  return normalizeEnrichmentAnswers(value)
}

function hasCoreName(core: OnboardingCoreAnswers): boolean {
  return core.name.length > 0
}

function hasCoreGoal(core: OnboardingCoreAnswers): boolean {
  return core.goals.length > 0
}

function hasCoreContext(core: OnboardingCoreAnswers): boolean {
  return core.situation.length > 0 && core.experience.length > 0
}

function hasCoreConstraints(core: OnboardingCoreAnswers): boolean {
  return Boolean((core.timeline || core.timelineCustom) && (core.hoursPerWeek || core.hoursPerWeekCustom))
}

function hasCoreRoleLanguage(core: OnboardingCoreAnswers): boolean {
  if (!core.situation || core.goals.length === 0) {
    return false
  }
  const roleSatisfied = !requiresTargetRoles(core.situation) || core.targetRoles.length > 0 || core.targetRolesCustom.length > 0
  const languageSatisfied = !requiresInterviewLanguage(core.goals) || core.interviewLanguage.length > 0 || core.interviewLanguageCustom.length > 0
  return roleSatisfied && languageSatisfied
}

function hasCoreGaps(core: OnboardingCoreAnswers): boolean {
  return core.weaknesses.length > 0
}

export function getCoreCompletionPercent(core: OnboardingCoreAnswers): number {
  const checks = [
    hasCoreName(core),
    hasCoreGoal(core),
    hasCoreContext(core),
    hasCoreConstraints(core),
    hasCoreRoleLanguage(core),
    hasCoreGaps(core),
  ]
  const completed = checks.filter(Boolean).length
  return Math.round((completed / checks.length) * 100)
}

export function getCompletionPercent(
  status: OnboardingStatus,
  core: OnboardingCoreAnswers,
  enrichment: OnboardingEnrichmentAnswers,
): number {
  if (status === 'not_started') {
    return 0
  }
  if (status === 'in_progress') {
    return getCoreCompletionPercent(core)
  }

  const completedEnrichmentCount = ENRICHMENT_PROMPT_ORDER.filter((key) => enrichment[key].length > 0).length
  const enrichmentPercent = Math.round((completedEnrichmentCount / ENRICHMENT_PROMPT_ORDER.length) * 30)
  const base = 70 + enrichmentPercent
  if (status === 'enriched_complete') {
    return 100
  }
  return Math.min(base, 99)
}

export function getNextEnrichmentPromptKey(enrichment: OnboardingEnrichmentAnswers): keyof OnboardingEnrichmentAnswers | null {
  for (const key of ENRICHMENT_PROMPT_ORDER) {
    if (enrichment[key].length === 0) {
      return key
    }
  }
  return null
}

function mapListToLabels(values: readonly string[], options: readonly SelectOption[]): string {
  if (values.length === 0) {
    return ''
  }
  const byValue = new Map(options.map((option) => [option.value, option.label]))
  return values.map((value) => byValue.get(value) || value).join(', ')
}

function joinLabelAndCustom(base: string, custom: string): string {
  if (base && custom) {
    return `${base}. ${custom}`
  }
  return base || custom
}

export interface LegacyOnboardingPayload {
  name: string
  situation: string
  experience: string
  techStack: string
  goals: string
  targetRoles: string
  targetCompanies: string
  timeline: string
  hoursPerWeek: string
  language: string
  learningStyle: string
  strengths: string
  weaknesses: string
}

export function toLegacyOnboardingPayload(
  core: OnboardingCoreAnswers,
  enrichment: OnboardingEnrichmentAnswers,
): LegacyOnboardingPayload {
  const goals = mapListToLabels(core.goals, GOAL_OPTIONS)
  const situation = mapListToLabels([core.situation], SITUATION_OPTIONS)
  const experience = mapListToLabels([core.experience], EXPERIENCE_OPTIONS)
  const timeline = joinLabelAndCustom(mapListToLabels([core.timeline], TIMELINE_OPTIONS), core.timelineCustom)
  const hoursPerWeek = joinLabelAndCustom(mapListToLabels([core.hoursPerWeek], HOURS_PER_WEEK_OPTIONS), core.hoursPerWeekCustom)
  const targetRoles = joinLabelAndCustom(mapListToLabels(core.targetRoles, TARGET_ROLE_OPTIONS), core.targetRolesCustom)
  const language = joinLabelAndCustom(mapListToLabels([core.interviewLanguage], INTERVIEW_LANGUAGE_OPTIONS), core.interviewLanguageCustom)
  const weaknesses = joinLabelAndCustom(mapListToLabels(core.weaknesses, WEAKNESS_OPTIONS), core.weaknessesCustom)
  const techStack = joinLabelAndCustom(mapListToLabels(enrichment.techStack, TECH_STACK_OPTIONS), enrichment.techStackCustom)
  const targetCompanies = joinLabelAndCustom(
    mapListToLabels(enrichment.targetCompanies, TARGET_COMPANY_OPTIONS),
    enrichment.targetCompaniesCustom,
  )
  const learningStyle = joinLabelAndCustom(
    mapListToLabels(enrichment.learningStyle, LEARNING_STYLE_OPTIONS),
    enrichment.learningStyleCustom,
  )
  const strengths = joinLabelAndCustom(mapListToLabels(enrichment.strengths, STRENGTH_OPTIONS), enrichment.strengthsCustom)

  return {
    name: core.name,
    situation: joinLabelAndCustom(situation, core.contextNote),
    experience,
    techStack: techStack || 'Not specified yet',
    goals,
    targetRoles: targetRoles || 'Open',
    targetCompanies: targetCompanies || 'Open',
    timeline: timeline || 'No hard deadline',
    hoursPerWeek: hoursPerWeek || 'Not specified',
    language: language || 'Adaptive',
    learningStyle: learningStyle || 'Adaptive',
    strengths: strengths || 'To be identified during coaching',
    weaknesses,
  }
}

function splitAndNormalizeList(rawValue: unknown): string[] {
  if (typeof rawValue !== 'string') {
    return []
  }
  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function pickByLabel(list: string[], options: readonly SelectOption[]): string[] {
  // Sort by descending label length so longer labels are tried before shorter prefixes.
  const sortedOptions = [...options].sort((a, b) => b.label.length - a.label.length)
  const byLabel = new Map(sortedOptions.map((option) => [option.label.toLowerCase(), option.value]))
  const selected: string[] = []
  for (const item of list) {
    const normalized = item.toLowerCase()
    // Exact match first
    let mapped = byLabel.get(normalized)
    // Prefix match to handle legacy values like "Actively job searching. <extra context>"
    if (!mapped) {
      for (const [label, value] of byLabel) {
        if (normalized.startsWith(label)) {
          mapped = value
          break
        }
      }
    }
    if (mapped && !selected.includes(mapped)) {
      selected.push(mapped)
    }
  }
  return selected
}

export function fromLegacyOnboardingPayload(value: unknown): OnboardingDraftPayload {
  const payload = isRecord(value) ? value : {}
  const core = normalizeCoreAnswers({
    name: payload.name,
    goals: pickByLabel(splitAndNormalizeList(payload.goals), GOAL_OPTIONS),
    situation: pickByLabel(splitAndNormalizeList(payload.situation), SITUATION_OPTIONS)[0] || '',
    experience: pickByLabel(splitAndNormalizeList(payload.experience), EXPERIENCE_OPTIONS)[0] || '',
    timeline: pickByLabel(splitAndNormalizeList(payload.timeline), TIMELINE_OPTIONS)[0] || '',
    hoursPerWeek: pickByLabel(splitAndNormalizeList(payload.hoursPerWeek), HOURS_PER_WEEK_OPTIONS)[0] || '',
    targetRoles: pickByLabel(splitAndNormalizeList(payload.targetRoles), TARGET_ROLE_OPTIONS),
    interviewLanguage: pickByLabel(splitAndNormalizeList(payload.language), INTERVIEW_LANGUAGE_OPTIONS)[0] || '',
    weaknesses: pickByLabel(splitAndNormalizeList(payload.weaknesses), WEAKNESS_OPTIONS),
  })
  const enrichment = normalizeEnrichmentAnswers({
    techStack: pickByLabel(splitAndNormalizeList(payload.techStack), TECH_STACK_OPTIONS),
    targetCompanies: pickByLabel(splitAndNormalizeList(payload.targetCompanies), TARGET_COMPANY_OPTIONS),
    learningStyle: pickByLabel(splitAndNormalizeList(payload.learningStyle), LEARNING_STYLE_OPTIONS),
    strengths: pickByLabel(splitAndNormalizeList(payload.strengths), STRENGTH_OPTIONS),
  })
  return {
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    core,
    enrichment,
    currentStep: 0,
  }
}
