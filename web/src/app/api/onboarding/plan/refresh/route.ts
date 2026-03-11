import { auth } from '@/auth'
import {
  loadOnboardingState,
  markOnboardingPlanQueued,
  OnboardingMigrationRequiredError,
  queueOnboardingPlanJob,
} from '@/lib/onboarding-service'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const state = await loadOnboardingState(userId)

    if (state.onboarding.status === 'not_started' || state.onboarding.status === 'in_progress') {
      return NextResponse.json(
        { error: 'Complete core onboarding before refreshing your game plan.' },
        { status: 409 },
      )
    }
    if (state.plan.status === 'queued' || state.plan.status === 'running') {
      return NextResponse.json(
        { error: 'A game plan refresh is already in progress.' },
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
    if (error instanceof OnboardingMigrationRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
