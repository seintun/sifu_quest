import { auth } from '@/auth'
import {
  loadOnboardingState,
  markEnrichmentUpdated,
  persistProfileOnboardingFile,
} from '@/lib/onboarding-service'
import {
  ONBOARDING_SCHEMA_VERSION,
  validateEnrichmentAnswers,
} from '@/lib/onboarding-v2'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const body = await request.json()
    const state = await loadOnboardingState(userId)

    if (state.onboarding.status === 'not_started' || state.onboarding.status === 'in_progress') {
      return NextResponse.json(
        { error: 'Complete core onboarding before enrichment updates.' },
        { status: 409 },
      )
    }

    const enrichment = validateEnrichmentAnswers(body?.enrichment)
    const currentStep =
      typeof body?.currentStep === 'number' && Number.isFinite(body.currentStep)
        ? Math.max(0, Math.floor(body.currentStep))
        : state.draft.currentStep

    const draft = {
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      core: state.draft.core,
      enrichment,
      currentStep,
    }

    const persistProfilePromise = persistProfileOnboardingFile(userId, draft.core, draft.enrichment)
    const onboardingPromise = markEnrichmentUpdated(userId, draft)
    const [onboarding] = await Promise.all([
      onboardingPromise,
      persistProfilePromise,
    ])

    const { logProgressEvent } = await import('@/lib/progress')
    await logProgressEvent(userId, 'enrichment_updated', 'onboarding', {
      nextPromptKey: onboarding.nextPromptKey,
    })

    return NextResponse.json({
      success: true,
      onboarding,
      plan: { status: 'not_queued' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
