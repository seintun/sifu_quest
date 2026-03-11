import { auth } from '@/auth'
import { createApiErrorResponse, createRequestId } from '@/lib/api-error-response'
import { getPersistableOnboardingDisplayName } from '@/lib/onboarding-name'
import {
  markCoreOnboardingComplete,
  persistCoreOnboardingFiles,
  queueOnboardingPlanJob,
} from '@/lib/onboarding-service'
import {
  normalizeEnrichmentAnswers,
  ONBOARDING_SCHEMA_VERSION,
  validateCoreAnswers,
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
    const body = await request.json()
    const core = validateCoreAnswers(body?.core)
    const enrichment = normalizeEnrichmentAnswers(body?.enrichment)
    const currentStep =
      typeof body?.currentStep === 'number' && Number.isFinite(body.currentStep)
        ? Math.max(0, Math.floor(body.currentStep))
        : 0

    await persistCoreOnboardingFiles(userId, core, enrichment)

    const draft = {
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      core,
      enrichment,
      currentStep,
    }
    await markCoreOnboardingComplete(userId, draft)
    await queueOnboardingPlanJob(userId, core, enrichment)

    const displayName = getPersistableOnboardingDisplayName(core.name)
    if (displayName) {
      const supabaseAdmin = createAdminClient()
      const { error: profileUpdateError } = await supabaseAdmin
        .from('user_profiles')
        .update({ display_name: displayName, last_active_at: new Date().toISOString() })
        .eq('id', userId)

      if (profileUpdateError) {
        throw new Error(`Failed to persist display name after onboarding: ${profileUpdateError.message}`)
      }
    }

    const { logProgressEvent, logAuditEvent } = await import('@/lib/progress')
    await logProgressEvent(userId, 'core_completed', 'onboarding')
    await logProgressEvent(userId, 'plan_queued', 'onboarding')
    await logAuditEvent(userId, 'account', 'profile', { action: 'onboarding_core_completed' })

    return NextResponse.json({
      success: true,
      onboarding: {
        version: ONBOARDING_SCHEMA_VERSION,
        status: 'core_complete',
      },
      plan: {
        status: 'queued',
      },
    })
  } catch (error) {
    return createApiErrorResponse(error, {
      route: '/api/onboarding/core/complete',
      requestId,
      userId,
      action: 'complete-onboarding-core',
      fallbackMessage: 'Failed to complete onboarding core.',
    })
  }
}
