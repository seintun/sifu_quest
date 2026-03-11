import { auth } from '@/auth'
import { createApiErrorResponse, createRequestId } from '@/lib/api-error-response'
import {
  loadOnboardingState,
  markOnboardingPlanQueued,
  queueOnboardingPlanJob,
} from '@/lib/onboarding-service'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST() {
  const requestId = createRequestId()
  let userId: string | null = null

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'unauthorized', requestId },
        { status: 401 },
      )
    }

    userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const state = await loadOnboardingState(userId)

    if (state.onboarding.status === 'not_started' || state.onboarding.status === 'in_progress') {
      return NextResponse.json(
        {
          error: 'Complete core onboarding before refreshing your game plan.',
          code: 'onboarding_core_incomplete',
          requestId,
        },
        { status: 409 },
      )
    }
    if (state.plan.status === 'queued' || state.plan.status === 'running') {
      return NextResponse.json(
        {
          error: 'A game plan refresh is already in progress.',
          code: 'plan_refresh_in_progress',
          requestId,
        },
        { status: 409 },
      )
    }

    await queueOnboardingPlanJob(userId, state.draft.core, state.draft.enrichment)
    await markOnboardingPlanQueued(userId)

    const { logProgressEvent } = await import('@/lib/progress')
    await logProgressEvent(userId, 'plan_queued', 'onboarding', { source: 'manual_refresh' })

    return NextResponse.json({
      success: true,
      plan: { status: 'queued' as const },
    })
  } catch (error) {
    return createApiErrorResponse(error, {
      route: '/api/onboarding/plan/refresh',
      requestId,
      userId,
      action: 'queue-manual-plan-refresh',
      fallbackMessage: 'Failed to queue plan refresh.',
    })
  }
}
