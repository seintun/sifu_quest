const FREE_TIER_MAX_USER_MESSAGES = 5

export type QuotaProfile = {
  is_guest: boolean
  api_key_enc: string | null
  free_quota_exhausted: boolean
  free_user_messages_used: number
}

export type FreeQuotaView = {
  isFreeTier: boolean
  remaining: number
  total: number
  isGuest: boolean
}

export function isUsingFreeTier(profile: QuotaProfile): boolean {
  return profile.is_guest || !profile.api_key_enc
}

export function computeFreeQuota(profile: QuotaProfile): FreeQuotaView {
  if (!isUsingFreeTier(profile)) {
    return { isFreeTier: false, remaining: -1, total: -1, isGuest: false }
  }

  const used = Math.max(0, profile.free_user_messages_used || 0)
  const remainingUserTurns = Math.max(0, FREE_TIER_MAX_USER_MESSAGES - used)

  return {
    isFreeTier: true,
    remaining: profile.free_quota_exhausted ? 0 : remainingUserTurns,
    total: FREE_TIER_MAX_USER_MESSAGES,
    isGuest: profile.is_guest,
  }
}

export function getQuotaError(profile: QuotaProfile): { error: 'guest_limit_reached' | 'missing_api_key'; message: string } | null {
  if (!isUsingFreeTier(profile)) {
    return null
  }

  if (!profile.free_quota_exhausted && profile.free_user_messages_used < FREE_TIER_MAX_USER_MESSAGES) {
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
    message: 'You have exhausted your free messages. Please add your Anthropic API key in Settings to continue.',
  }
}

export function shouldMarkQuotaExhausted(profile: QuotaProfile): boolean {
  return profile.free_user_messages_used >= FREE_TIER_MAX_USER_MESSAGES || profile.free_quota_exhausted
}
