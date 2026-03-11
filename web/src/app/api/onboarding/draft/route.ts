import { auth } from '@/auth'
import {
  loadOnboardingState,
  updateOnboardingDraft,
} from '@/lib/onboarding-service'
import {
  createEmptyOnboardingDraftPayload,
  normalizeCoreAnswers,
  normalizeEnrichmentAnswers,
  ONBOARDING_SCHEMA_VERSION,
  type OnboardingStatus,
} from '@/lib/onboarding-v2'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

function hasAnyCoreAnswer(core: ReturnType<typeof normalizeCoreAnswers>): boolean {
  return Boolean(
    core.name ||
      core.goals.length > 0 ||
      core.situation ||
      core.experience ||
      core.timeline ||
      core.timelineCustom ||
      core.hoursPerWeek ||
      core.hoursPerWeekCustom ||
      core.targetRoles.length > 0 ||
      core.targetRolesCustom ||
      core.interviewLanguage ||
      core.interviewLanguageCustom ||
      core.weaknesses.length > 0 ||
      core.weaknessesCustom ||
      core.contextNote,
  )
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const body = await request.json()
    const empty = createEmptyOnboardingDraftPayload()

    const core = normalizeCoreAnswers(body?.core)
    const enrichment = normalizeEnrichmentAnswers(body?.enrichment)
    const currentStep =
      typeof body?.currentStep === 'number' && Number.isFinite(body.currentStep)
        ? Math.max(0, Math.floor(body.currentStep))
        : 0

    const draft = {
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      core: { ...empty.core, ...core },
      enrichment: { ...empty.enrichment, ...enrichment },
      currentStep,
    }

    const currentState = await loadOnboardingState(userId)
    const status: OnboardingStatus =
      currentState.onboarding.status === 'core_complete' || currentState.onboarding.status === 'enriched_complete'
        ? currentState.onboarding.status
        : hasAnyCoreAnswer(draft.core)
          ? 'in_progress'
          : 'not_started'

    await updateOnboardingDraft(userId, draft, status)
    const refreshed = await loadOnboardingState(userId)
    return NextResponse.json(refreshed)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
