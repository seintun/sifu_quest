import { auth } from '@/auth'
import { createApiErrorResponse, createRequestId } from '@/lib/api-error-response'
import {
  loadOnboardingState,
  runOnboardingPlanJobForUser,
} from '@/lib/onboarding-service'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
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
    const kickRequested = request.nextUrl.searchParams.get('kick') === 'true'

    const state = await loadOnboardingState(userId)
    if (kickRequested && (state.plan.status === 'queued' || state.plan.status === 'running')) {
      await runOnboardingPlanJobForUser(userId)
    }

    const refreshed = await loadOnboardingState(userId)
    return NextResponse.json(refreshed)
  } catch (error) {
    return createApiErrorResponse(error, {
      route: '/api/onboarding/status',
      requestId,
      userId,
      action: 'load-onboarding-status',
      fallbackMessage: 'Failed to load onboarding status.',
    })
  }
}
