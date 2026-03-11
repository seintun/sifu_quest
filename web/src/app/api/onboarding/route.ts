import { auth } from '@/auth'
import { createApiErrorResponse, createRequestId } from '@/lib/api-error-response'
import { getPersistableOnboardingDisplayName } from '@/lib/onboarding-name'
import {
  markCoreOnboardingComplete,
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
            {
              error: 'User profile does not exist for onboarding user.',
              code: 'user_profile_missing',
              requestId,
            },
            { status: 404 },
          )
        }
        return NextResponse.json(
          {
            error: 'Failed to update user profile during onboarding.',
            code: 'profile_update_failed',
            requestId,
          },
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
    return createApiErrorResponse(error, {
      route: '/api/onboarding',
      requestId,
      userId,
      action: 'submit-legacy-onboarding',
      fallbackMessage: 'We could not process onboarding right now. Please try again.',
    })
  }
}
