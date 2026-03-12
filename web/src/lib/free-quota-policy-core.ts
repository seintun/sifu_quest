export type QuotaProfile = {
  is_guest: boolean
  api_key_enc: string | null
  free_quota_exhausted: boolean
  free_user_messages_used: number
  has_provider_key?: boolean
}

export type QuotaProvider = 'openrouter' | 'anthropic'

export type QuotaProviderKeyMap = Record<QuotaProvider, boolean>

export type FreeQuotaView = {
  isFreeTier: boolean
  remaining: number
  total: number
  isGuest: boolean
}

export function isUsingFreeTier(profile: QuotaProfile): boolean {
  if (profile.is_guest) {
    return true
  }
  if (typeof profile.has_provider_key === 'boolean') {
    return !profile.has_provider_key
  }
  return !profile.api_key_enc
}

export function shouldEnforceProviderQuota(
  profile: QuotaProfile,
  provider: QuotaProvider,
  providerKeys: QuotaProviderKeyMap,
): boolean {
  if (!isUsingFreeTier(profile)) {
    return false
  }

  if (providerKeys[provider]) {
    return false
  }

  return true
}

export function computeFreeQuotaForLimit(profile: QuotaProfile, maxUserMessages: number): FreeQuotaView {
  if (!isUsingFreeTier(profile)) {
    return { isFreeTier: false, remaining: -1, total: -1, isGuest: false }
  }

  const used = Math.max(0, profile.free_user_messages_used || 0)
  const remainingUserTurns = Math.max(0, maxUserMessages - used)

  return {
    isFreeTier: true,
    remaining: profile.free_quota_exhausted ? 0 : remainingUserTurns,
    total: maxUserMessages,
    isGuest: profile.is_guest,
  }
}

export function getQuotaErrorForLimit(
  profile: QuotaProfile,
  maxUserMessages: number,
): { error: 'guest_limit_reached' | 'missing_api_key'; message: string } | null {
  if (!isUsingFreeTier(profile)) {
    return null
  }

  if (!profile.free_quota_exhausted && profile.free_user_messages_used < maxUserMessages) {
    return null
  }

  if (profile.is_guest) {
    return {
      error: 'guest_limit_reached',
      message: 'You have reached your free message limit as a guest. Please log in to continue.',
    }
  }

  return {
    error: 'missing_api_key',
    message: 'You have exhausted your free messages. Please add your API key in Settings to continue.',
  }
}

export function shouldMarkQuotaExhaustedForLimit(profile: QuotaProfile, maxUserMessages: number): boolean {
  return profile.free_user_messages_used >= maxUserMessages || profile.free_quota_exhausted
}
