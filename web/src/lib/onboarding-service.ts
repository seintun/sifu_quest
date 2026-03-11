import Anthropic from '@anthropic-ai/sdk'

import { assertRequiredEnv } from './env'
import { MemoryWriteError, writeMemoryFilesBatch } from './memory'
import {
  type LegacyOnboardingPayload,
  type OnboardingCoreAnswers,
  type OnboardingDraftPayload,
  type OnboardingEnrichmentAnswers,
  type OnboardingPlanPayload,
  type OnboardingStatus,
  type OnboardingStatusPayload,
  ONBOARDING_SCHEMA_VERSION,
  createEmptyOnboardingDraftPayload,
  getCompletionPercent,
  getNextEnrichmentPromptKey,
  normalizeEnrichmentAnswers,
  toLegacyOnboardingPayload,
  validateCoreAnswers,
} from './onboarding-v2'
import { getPlanTimelineMeta } from './profile-timeline'
import { createAdminClient } from './supabase-admin'

type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

type PersistedOnboardingDraft = {
  schemaVersion: number
  core: OnboardingCoreAnswers
  enrichment: OnboardingEnrichmentAnswers
  currentStep: number
}

type PlanJobPayload = {
  schemaVersion: number
  core: OnboardingCoreAnswers
  enrichment: OnboardingEnrichmentAnswers
  queuedAt: string
}

const PLAN_PLACEHOLDER = `# Personalized Plan

Your personalized plan is being generated in the background.

This usually takes under a minute. You can continue using the app while this finishes.
`

function todayIsoDate(): string {
  return new Date().toISOString().split('T')[0]
}

function getBackoffDelayMs(attemptCount: number): number {
  // 2m, 4m, 8m
  const minutes = 2 ** Math.max(1, attemptCount)
  return minutes * 60 * 1000
}

const PLAN_JOB_STALE_MS = 10 * 60 * 1000

type DbErrorLike = {
  code?: string | null
  message?: string | null
}

export class OnboardingMigrationRequiredError extends Error {
  constructor(action: string) {
    super(`Onboarding v2 schema is not available for ${action}. Run the latest database migrations and retry.`)
    this.name = 'OnboardingMigrationRequiredError'
  }
}

function isMissingOnboardingSchemaError(error: DbErrorLike | null | undefined): boolean {
  if (!error) {
    return false
  }
  const message = (error.message ?? '').toLowerCase()
  const mentionsMissingColumn =
    (message.includes('column') && (message.includes('does not exist') || message.includes('could not find'))) ||
    message.includes('schema cache')

  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    (mentionsMissingColumn && message.includes('onboarding_'))
  )
}

function toOnboardingStateWriteError(action: string, error: DbErrorLike | null | undefined): Error {
  if (isMissingOnboardingSchemaError(error)) {
    return new OnboardingMigrationRequiredError(action)
  }
  const detail = error?.message ?? 'Unknown database error'
  return new Error(`Failed to ${action}: ${detail}`)
}

function toDatabaseOperationError(action: string, error: DbErrorLike | null | undefined): Error {
  const code = error?.code ? ` [${error.code}]` : ''
  const detail = error?.message ?? 'Unknown database error'
  return new Error(`Failed to ${action}${code}: ${detail}`)
}

function toErrorCode(error: unknown): string {
  if (error instanceof MemoryWriteError && error.dbCode === '23503') {
    return 'identity_mismatch'
  }
  if (error instanceof Error) {
    if (error.message.includes('ANTHROPIC_API_KEY')) {
      return 'planner_env_missing'
    }
    return 'plan_generation_failed'
  }
  return 'unknown_error'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parsePersistedOnboardingDraft(raw: unknown): PersistedOnboardingDraft {
  if (!isRecord(raw)) {
    return createEmptyOnboardingDraftPayload()
  }

  return {
    schemaVersion:
      typeof raw.schemaVersion === 'number' && Number.isFinite(raw.schemaVersion)
        ? raw.schemaVersion
        : ONBOARDING_SCHEMA_VERSION,
    core: validateCoreAnswers({
      ...createEmptyOnboardingDraftPayload().core,
      ...(isRecord(raw.core) ? raw.core : {}),
      // NOTE: validateCoreAnswers enforces required fields; this parser is strict.
      // For parsing possibly partial drafts, use parsePersistedOnboardingDraftRelaxed instead.
    }),
    enrichment: normalizeEnrichmentAnswers(isRecord(raw.enrichment) ? raw.enrichment : {}),
    currentStep:
      typeof raw.currentStep === 'number' && Number.isFinite(raw.currentStep)
        ? Math.max(0, Math.floor(raw.currentStep))
        : 0,
  }
}

export function parsePersistedOnboardingDraftRelaxed(raw: unknown): PersistedOnboardingDraft {
  if (!isRecord(raw)) {
    return createEmptyOnboardingDraftPayload()
  }

  const empty = createEmptyOnboardingDraftPayload()
  return {
    schemaVersion:
      typeof raw.schemaVersion === 'number' && Number.isFinite(raw.schemaVersion)
        ? raw.schemaVersion
        : ONBOARDING_SCHEMA_VERSION,
    core: {
      ...empty.core,
      ...(isRecord(raw.core) ? raw.core : {}),
    } as OnboardingCoreAnswers,
    enrichment: {
      ...empty.enrichment,
      ...(isRecord(raw.enrichment) ? raw.enrichment : {}),
    } as OnboardingEnrichmentAnswers,
    currentStep:
      typeof raw.currentStep === 'number' && Number.isFinite(raw.currentStep)
        ? Math.max(0, Math.floor(raw.currentStep))
        : 0,
  }
}

export function createPlanJobPayload(
  core: OnboardingCoreAnswers,
  enrichment: OnboardingEnrichmentAnswers,
): PlanJobPayload {
  return {
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    core,
    enrichment,
    queuedAt: new Date().toISOString(),
  }
}

function buildProfileContent(data: LegacyOnboardingPayload): string {
  return `# User Profile

> Auto-maintained by Claude. Updated after substantive sessions.

---

## Career Context & Goals

- **Name:** ${data.name}
- **Situation:** ${data.situation}
- **Experience:** ${data.experience}
- **Tech stack:** ${data.techStack}
- **Goals:** ${data.goals}
- **Target roles:** ${data.targetRoles}
- **Target companies:** ${data.targetCompanies}
- **Timeline:** ${data.timeline}
- **Hours/week:** ${data.hoursPerWeek}
- **Interview language:** ${data.language}

---

## Strengths

${data.strengths
  .split(',')
  .map((value) => `- ${value.trim()}`)
  .join('\n')}

---

## Knowledge Gaps

${data.weaknesses
  .split(',')
  .map((value) => `- ${value.trim()}`)
  .join('\n')}

---

## Learning Style

- ${data.learningStyle}

---

## Notes

- Workspace initialized: ${todayIsoDate()}
`
}

function buildProgressContent(data: LegacyOnboardingPayload): string {
  return `# Progress Tracker

> Auto-maintained by Claude. Updated after substantive sessions.

---

## DSA / LeetCode

### Mastered
- (none yet)

### In Progress
- Getting started

### Suggested Next Focus
- Begin with Arrays & Hashing pattern

---

## System Design

### Concepts Covered
- (none yet)

### Suggested Next Focus
- Start with fundamentals: scalability, load balancing, databases

---

## Job Search

### Status
- ${data.situation}

---

## Overall Notes
- Workspace initialized: ${todayIsoDate()}
- Sessions completed: 0
`
}

function buildPlanPrompt(data: LegacyOnboardingPayload): string {
  const timelineMeta = getPlanTimelineMeta(data.timeline)
  const timelineInstruction = timelineMeta.durationMonths
    ? `Build exactly ${timelineMeta.durationMonths} monthly phases labeled "## Month 1 - ...", "## Month 2 - ...", up to Month ${timelineMeta.durationMonths}.`
    : `Build phased milestones that explicitly align to the stated timeline: "${data.timeline}".`

  return `Generate a personalized interview prep game plan in markdown for:
- Name: ${data.name}
- Timeline: ${data.timeline}
- Goals: ${data.goals}
- Experience: ${data.experience}
- Hours/week: ${data.hoursPerWeek}
- Tech stack: ${data.techStack}
- Strengths: ${data.strengths}
- Weaknesses: ${data.weaknesses}

Write a detailed plan with a # title reflecting the timeline, phase breakdowns (months/weeks),
concrete weekly actions for DSA, system design, and job search. Include markdown links to resources.
${timelineInstruction}
Format as clean markdown suitable for rendering.`
}

async function createPlanContent(data: LegacyOnboardingPayload): Promise<string> {
  assertRequiredEnv(['ANTHROPIC_API_KEY'])
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: buildPlanPrompt(data) }],
  })
  return (response.content[0] as { type: 'text'; text: string }).text
}

export async function persistCoreOnboardingFiles(
  userId: string,
  core: OnboardingCoreAnswers,
  enrichment: OnboardingEnrichmentAnswers,
): Promise<void> {
  const legacy = toLegacyOnboardingPayload(core, enrichment)
  await writeMemoryFilesBatch(
    userId,
    [
      { filename: 'profile.md', content: buildProfileContent(legacy) },
      { filename: 'progress.md', content: buildProgressContent(legacy) },
      { filename: 'plan.md', content: PLAN_PLACEHOLDER },
    ],
    'onboarding',
  )
}

export async function persistProfileOnboardingFile(
  userId: string,
  core: OnboardingCoreAnswers,
  enrichment: OnboardingEnrichmentAnswers,
): Promise<void> {
  const legacy = toLegacyOnboardingPayload(core, enrichment)
  await writeMemoryFilesBatch(
    userId,
    [{ filename: 'profile.md', content: buildProfileContent(legacy) }],
    'onboarding',
  )
}

export async function queueOnboardingPlanJob(
  userId: string,
  core: OnboardingCoreAnswers,
  enrichment: OnboardingEnrichmentAnswers,
): Promise<void> {
  const supabaseAdmin = createAdminClient()
  const now = new Date().toISOString()
  const payload = createPlanJobPayload(core, enrichment)

  const { error: queueError } = await supabaseAdmin
    .from('onboarding_plan_jobs')
    .upsert(
      {
        user_id: userId,
        status: 'queued',
        payload,
        attempt_count: 0,
        available_at: now,
        last_error_code: null,
        updated_at: now,
        completed_at: null,
      },
      { onConflict: 'user_id' },
    )

  if (queueError) {
    throw toDatabaseOperationError('queue onboarding plan job', queueError)
  }
}

export async function markOnboardingPlanQueued(userId: string): Promise<void> {
  const supabaseAdmin = createAdminClient()
  const now = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({
      onboarding_plan_status: 'queued',
      onboarding_plan_error_code: null,
      onboarding_plan_retries: 0,
      onboarding_plan_last_attempt_at: null,
      last_active_at: now,
    })
    .eq('id', userId)

  if (error) {
    throw toOnboardingStateWriteError('mark onboarding plan queued', error)
  }
}

export async function updateOnboardingDraft(
  userId: string,
  draft: OnboardingDraftPayload,
  status: OnboardingStatus,
): Promise<void> {
  const supabaseAdmin = createAdminClient()
  const nextPromptKey = getNextEnrichmentPromptKey(draft.enrichment)
  const completionPercent = getCompletionPercent(status, draft.core, draft.enrichment)
  const now = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({
      onboarding_version: ONBOARDING_SCHEMA_VERSION,
      onboarding_status: status,
      onboarding_draft: draft,
      onboarding_last_step: draft.currentStep,
      onboarding_completion_percent: completionPercent,
      onboarding_next_prompt_key: nextPromptKey,
      last_active_at: now,
    })
    .eq('id', userId)

  if (error) {
    throw toOnboardingStateWriteError('update onboarding draft', error)
  }
}

export async function markCoreOnboardingComplete(
  userId: string,
  draft: OnboardingDraftPayload,
): Promise<void> {
  const supabaseAdmin = createAdminClient()
  const now = new Date().toISOString()
  const completionPercent = getCompletionPercent('core_complete', draft.core, draft.enrichment)
  const nextPromptKey = getNextEnrichmentPromptKey(draft.enrichment)

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({
      onboarding_version: ONBOARDING_SCHEMA_VERSION,
      onboarding_status: 'core_complete',
      onboarding_draft: draft,
      onboarding_last_step: draft.currentStep,
      onboarding_completion_percent: completionPercent,
      onboarding_next_prompt_key: nextPromptKey,
      onboarding_core_completed_at: now,
      onboarding_plan_status: 'queued',
      onboarding_plan_error_code: null,
      onboarding_plan_retries: 0,
      onboarding_plan_last_attempt_at: null,
      last_active_at: now,
    })
    .eq('id', userId)

  if (error) {
    throw toOnboardingStateWriteError('mark onboarding core complete', error)
  }
}

export async function markEnrichmentUpdated(
  userId: string,
  draft: OnboardingDraftPayload,
): Promise<OnboardingStatusPayload> {
  const supabaseAdmin = createAdminClient()
  const now = new Date().toISOString()
  const nextPromptKey = getNextEnrichmentPromptKey(draft.enrichment)
  const status: OnboardingStatus = nextPromptKey ? 'core_complete' : 'enriched_complete'
  const completionPercent = getCompletionPercent(status, draft.core, draft.enrichment)

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({
      onboarding_status: status,
      onboarding_draft: draft,
      onboarding_last_step: draft.currentStep,
      onboarding_completion_percent: completionPercent,
      onboarding_next_prompt_key: nextPromptKey,
      onboarding_enriched_completed_at: status === 'enriched_complete' ? now : null,
      onboarding_plan_status: 'not_queued',
      onboarding_plan_error_code: null,
      onboarding_plan_retries: 0,
      onboarding_plan_last_attempt_at: null,
      last_active_at: now,
    })
    .eq('id', userId)

  if (error) {
    throw toOnboardingStateWriteError('update onboarding enrichment', error)
  }

  return {
    version: ONBOARDING_SCHEMA_VERSION,
    status,
    completionPercent,
    nextPromptKey,
    draftAvailable: true,
  }
}

export async function loadOnboardingState(userId: string): Promise<{
  onboarding: OnboardingStatusPayload
  plan: OnboardingPlanPayload
  draft: OnboardingDraftPayload
}> {
  const supabaseAdmin = createAdminClient()
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('onboarding_version, onboarding_status, onboarding_completion_percent, onboarding_next_prompt_key, onboarding_draft, onboarding_plan_status, onboarding_plan_error_code')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw toOnboardingStateWriteError('load onboarding state', error)
  }

  const fallbackDraft = createEmptyOnboardingDraftPayload()
  const rawDraft = data?.onboarding_draft
  const hasDraft = isRecord(rawDraft) && Object.keys(rawDraft).length > 0
  const draft = hasDraft ? parsePersistedOnboardingDraftRelaxed(rawDraft) : fallbackDraft

  return {
    onboarding: {
      version: data?.onboarding_version ?? ONBOARDING_SCHEMA_VERSION,
      status: (data?.onboarding_status as OnboardingStatus) ?? 'not_started',
      completionPercent: data?.onboarding_completion_percent ?? 0,
      nextPromptKey: data?.onboarding_next_prompt_key ?? getNextEnrichmentPromptKey(draft.enrichment),
      draftAvailable: hasDraft,
    },
    plan: {
      status: (data?.onboarding_plan_status as OnboardingPlanPayload['status']) ?? 'not_queued',
      lastErrorCode: data?.onboarding_plan_error_code ?? null,
    },
    draft,
  }
}

async function markPlanJobSuccess(userId: string, attemptCount: number): Promise<void> {
  const supabaseAdmin = createAdminClient()
  const now = new Date().toISOString()

  const { data: updatedJob, error: jobError } = await supabaseAdmin
    .from('onboarding_plan_jobs')
    .update({
      status: 'completed',
      attempt_count: attemptCount,
      last_error_code: null,
      updated_at: now,
      completed_at: now,
    })
    .eq('user_id', userId)
    .eq('status', 'running')
    .eq('attempt_count', attemptCount)
    .select('user_id')
    .maybeSingle()

  if (jobError) {
    throw toDatabaseOperationError('mark plan job successful', jobError)
  }

  // If no rows were updated, this run is stale (job was re-queued); don't finalize.
  if (!updatedJob) {
    return
  }

  const { error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .update({
      onboarding_plan_status: 'ready',
      onboarding_plan_error_code: null,
      onboarding_plan_retries: 0,
      onboarding_plan_last_attempt_at: now,
      last_active_at: now,
    })
    .eq('id', userId)

  if (profileError) {
    throw toOnboardingStateWriteError('update user profile after plan success', profileError)
  }

  const { logProgressEvent } = await import('./progress')
  await logProgressEvent(userId, 'plan_ready', 'onboarding')
}

async function markPlanJobRunning(userId: string): Promise<void> {
  const supabaseAdmin = createAdminClient()
  const now = new Date().toISOString()

  const { error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .update({
      onboarding_plan_status: 'running',
      onboarding_plan_error_code: null,
      onboarding_plan_last_attempt_at: now,
      last_active_at: now,
    })
    .eq('id', userId)

  if (profileError) {
    throw toOnboardingStateWriteError('update user profile while plan is running', profileError)
  }
}

async function markPlanJobFailure(
  userId: string,
  attemptCount: number,
  errorCode: string,
): Promise<void> {
  const supabaseAdmin = createAdminClient()
  const now = new Date().toISOString()
  const exhausted = attemptCount >= 3

  const { data: updatedJob, error: jobError } = await supabaseAdmin
    .from('onboarding_plan_jobs')
    .update({
      status: exhausted ? 'failed' : 'queued',
      attempt_count: attemptCount,
      last_error_code: errorCode,
      available_at: exhausted
        ? now
        : new Date(Date.now() + getBackoffDelayMs(attemptCount)).toISOString(),
      updated_at: now,
    })
    .eq('user_id', userId)
    .eq('status', 'running')
    .eq('attempt_count', attemptCount)
    .select('user_id')
    .maybeSingle()

  if (jobError) {
    throw toDatabaseOperationError('mark plan job failure', jobError)
  }

  // If no rows were updated, this run is stale (job was re-queued); don't finalize.
  if (!updatedJob) {
    return
  }

  const { error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .update({
      onboarding_plan_status: exhausted ? 'failed' : 'queued',
      onboarding_plan_error_code: errorCode,
      onboarding_plan_retries: attemptCount,
      onboarding_plan_last_attempt_at: now,
      last_active_at: now,
    })
    .eq('id', userId)

  if (profileError) {
    throw toOnboardingStateWriteError('update user profile after plan failure', profileError)
  }

  const { logProgressEvent } = await import('./progress')
  await logProgressEvent(userId, exhausted ? 'plan_failed' : 'plan_retry_queued', 'onboarding', {
    attemptCount,
    errorCode,
  })
}

async function runPlanJobForUser(userId: string): Promise<boolean> {
  const supabaseAdmin = createAdminClient()
  const now = new Date().toISOString()
  const { data: initialJob, error: jobError } = await supabaseAdmin
    .from('onboarding_plan_jobs')
    .select('user_id, status, payload, attempt_count, available_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (jobError) {
    throw toDatabaseOperationError('fetch onboarding plan job', jobError)
  }
  if (!initialJob) {
    return false
  }

  let job = initialJob

  // If a worker died mid-run, recover stale running jobs so a kick can resume processing.
  if (job.status === 'running') {
    const updatedAtMs = job.updated_at ? new Date(job.updated_at).getTime() : NaN
    const isStale = Number.isNaN(updatedAtMs) || Date.now() - updatedAtMs > PLAN_JOB_STALE_MS
    if (!isStale) {
      return false
    }

    const { data: requeuedJob, error: requeueError } = await supabaseAdmin
      .from('onboarding_plan_jobs')
      .update({
        status: 'queued',
        available_at: now,
        updated_at: now,
        last_error_code: 'stale_running_requeued',
      })
      .eq('user_id', userId)
      .eq('status', 'running')
      .select('user_id, status, payload, attempt_count, available_at, updated_at')
      .maybeSingle()

    if (requeueError) {
      throw toDatabaseOperationError('requeue stale onboarding plan job', requeueError)
    }

    if (!requeuedJob) {
      return false
    }

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({
        onboarding_plan_status: 'queued',
        onboarding_plan_error_code: 'stale_running_requeued',
        onboarding_plan_last_attempt_at: now,
        last_active_at: now,
      })
      .eq('id', userId)

    if (profileError) {
      throw toOnboardingStateWriteError('sync profile after stale plan job requeue', profileError)
    }

    job = requeuedJob
  }

  if (job.status !== 'queued') {
    return false
  }

  if (job.available_at && new Date(job.available_at).getTime() > Date.now()) {
    return false
  }

  const nextAttempt = (job.attempt_count ?? 0) + 1

  const { data: claimedJob, error: claimError } = await supabaseAdmin
    .from('onboarding_plan_jobs')
    .update({
      status: 'running' as JobStatus,
      attempt_count: nextAttempt,
      updated_at: now,
    })
    .eq('user_id', userId)
    .eq('status', 'queued')
    .select('payload')
    .maybeSingle()

  if (claimError) {
    throw toDatabaseOperationError('claim onboarding plan job', claimError)
  }
  if (!claimedJob) {
    return false
  }

  try {
    await markPlanJobRunning(userId)

    const payload = isRecord(claimedJob.payload) ? claimedJob.payload : {}
    const draft = parsePersistedOnboardingDraftRelaxed(payload)
    const legacy = toLegacyOnboardingPayload(draft.core, draft.enrichment)
    const planContent = await createPlanContent(legacy)

    await writeMemoryFilesBatch(
      userId,
      [{ filename: 'plan.md', content: planContent }],
      'onboarding',
    )

    await markPlanJobSuccess(userId, nextAttempt)
    return true
  } catch (error) {
    await markPlanJobFailure(userId, nextAttempt, toErrorCode(error))
    return true
  }
}

export async function runOnboardingPlanJobs(limit: number = 5): Promise<{ processed: number }> {
  const supabaseAdmin = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('onboarding_plan_jobs')
    .select('user_id')
    .eq('status', 'queued')
    .lte('available_at', now)
    .order('available_at', { ascending: true })
    .limit(limit)

  if (error) {
    throw toDatabaseOperationError('load queued onboarding jobs', error)
  }

  let processed = 0
  for (const row of data ?? []) {
    const handled = await runPlanJobForUser(row.user_id)
    if (handled) {
      processed += 1
    }
  }

  return { processed }
}

export async function runOnboardingPlanJobForUser(userId: string): Promise<{ processed: boolean }> {
  const processed = await runPlanJobForUser(userId)
  return { processed }
}
