import { auth } from '@/auth'
import { createApiErrorResponse, createRequestId } from '@/lib/api-error-response'
import { ensureUserProfile } from '@/lib/account-state'
import { hasEncryptedProviderApiKey } from '@/lib/provider-api-keys'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
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
    const profile = await ensureUserProfile(userId, session.user.email)
    const hasAnthropicKey = await hasEncryptedProviderApiKey(userId, 'anthropic')
    const sessionName = typeof session.user.name === 'string' ? session.user.name.trim() : ''
    const prefillName = profile.display_name ? null : (sessionName || null)
    const isAnonymousSession = Boolean(session.user.email?.endsWith('@anonymous.local'))

    return NextResponse.json({
      account: {
        userId,
        isGuest: profile.is_guest,
        isAnonymousSession,
        isLinked: !profile.is_guest,
        displayName: profile.display_name,
        hasApiKey: hasAnthropicKey,
        hasAnthropicApiKey: hasAnthropicKey,
        defaultProvider: profile.default_provider,
        defaultModel: profile.default_model,
        prefillName,
        avatarUrl: profile.avatar_url,
      },
      onboarding: {
        version: profile.onboarding_version,
        status: profile.onboarding_status,
        completionPercent: profile.onboarding_completion_percent,
        nextPromptKey: profile.onboarding_next_prompt_key,
        draftAvailable: Boolean(profile.onboarding_draft && Object.keys(profile.onboarding_draft).length > 0),
      },
      plan: {
        status: profile.onboarding_plan_status,
        lastErrorCode: profile.onboarding_plan_error_code,
      },
    })
  } catch (error) {
    return createApiErrorResponse(error, {
      route: '/api/account/status',
      requestId,
      userId,
      action: 'load-account-status',
      fallbackMessage: 'Failed to load account status.',
    })
  }
}
