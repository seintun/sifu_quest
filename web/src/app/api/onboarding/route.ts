import { auth } from '@/auth'
import { getPersistableOnboardingDisplayName } from '@/lib/onboarding-name'
import {
  markCoreOnboardingComplete,
  OnboardingMigrationRequiredError,
  persistCoreOnboardingFiles,
  queueOnboardingPlanJob,
} from '@/lib/onboarding-service'
import {
  fromLegacyOnboardingPayload,
  ONBOARDING_SCHEMA_VERSION,
} from '@/lib/onboarding-v2'
import { createAdminClient } from '@/lib/supabase-admin'
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
    const legacyPayload = await request.json()
    const draft = fromLegacyOnboardingPayload(legacyPayload)

    await persistCoreOnboardingFiles(userId, draft.core, draft.enrichment)
    await markCoreOnboardingComplete(userId, draft)
    await queueOnboardingPlanJob(userId, draft.core, draft.enrichment)

    const displayName = getPersistableOnboardingDisplayName(draft.core.name)
    if (displayName) {
      const supabaseAdmin = createAdminClient()
      const { error: profileUpdateError } = await supabaseAdmin
        .from('user_profiles')
        .update({ display_name: displayName, last_active_at: new Date().toISOString() })
        .eq('id', userId)

      if (profileUpdateError) {
        if ((profileUpdateError as { code?: string }).code === '23503') {
          return NextResponse.json(
            { error: 'User profile does not exist for onboarding user.' },
            { status: 404 },
          )
        }
        return NextResponse.json(
          { error: 'Failed to update user profile during onboarding.' },
          { status: 500 },
        )
      }
    }

    const { logProgressEvent, logAuditEvent } = await import('@/lib/progress')
    await logProgressEvent(userId, 'onboarding_complete', 'onboarding')
    await logProgressEvent(userId, 'plan_queued', 'onboarding')
    await logAuditEvent(userId, 'account', 'profile', {
      action: 'onboarding_completed_via_legacy_route',
      onboardingVersion: ONBOARDING_SCHEMA_VERSION,
    })

    return NextResponse.json({ success: true, planStatus: 'queued' })
  } catch (error) {
    if (error instanceof OnboardingMigrationRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: message || 'We could not process onboarding right now. Please try again.' },
      { status: 500 },
    )
  }
}
