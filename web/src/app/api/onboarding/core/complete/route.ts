import { auth } from '@/auth'
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
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
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
      await supabaseAdmin
        .from('user_profiles')
        .update({ display_name: displayName, last_active_at: new Date().toISOString() })
        .eq('id', userId)
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
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (error instanceof Error && error.name === 'OnboardingValidationError') {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
