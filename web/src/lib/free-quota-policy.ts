import { FREE_TIER_MAX_USER_MESSAGES } from './quota'
import {
  computeFreeQuotaForLimit,
  getQuotaErrorForLimit,
  shouldMarkQuotaExhaustedForLimit,
  isUsingFreeTier,
  type FreeQuotaView,
  type QuotaProfile,
} from './free-quota-policy-core'

export { isUsingFreeTier, type FreeQuotaView, type QuotaProfile }

export function computeFreeQuota(profile: QuotaProfile): FreeQuotaView {
  return computeFreeQuotaForLimit(profile, FREE_TIER_MAX_USER_MESSAGES)
}

export function getQuotaError(profile: QuotaProfile): { error: 'guest_limit_reached' | 'missing_api_key'; message: string } | null {
  return getQuotaErrorForLimit(profile, FREE_TIER_MAX_USER_MESSAGES)
}

export function shouldMarkQuotaExhausted(profile: QuotaProfile): boolean {
  return shouldMarkQuotaExhaustedForLimit(profile, FREE_TIER_MAX_USER_MESSAGES)
}
