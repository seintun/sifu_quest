import { auth } from '@/auth'
import {
  loadOnboardingState,
  OnboardingMigrationRequiredError,
  runOnboardingPlanJobForUser,
} from '@/lib/onboarding-service'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const kickRequested = request.nextUrl.searchParams.get('kick') === 'true'

    const state = await loadOnboardingState(userId)
    if (kickRequested && (state.plan.status === 'queued' || state.plan.status === 'running')) {
      await runOnboardingPlanJobForUser(userId)
    }

    const refreshed = await loadOnboardingState(userId)
    return NextResponse.json(refreshed)
  } catch (error) {
    if (error instanceof OnboardingMigrationRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
