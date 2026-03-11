import { FREE_TIER_MAX_USER_MESSAGES } from './quota'
import {
  computeFreeQuotaForLimit,
  getQuotaErrorForLimit,
  shouldMarkQuotaExhaustedForLimit,
  isUsingFreeTier,
  shouldEnforceProviderQuota,
  type FreeQuotaView,
  type QuotaProfile,
  type QuotaProvider,
} from './free-quota-policy-core'

export { isUsingFreeTier, shouldEnforceProviderQuota, type FreeQuotaView, type QuotaProfile, type QuotaProvider }

export function computeFreeQuota(profile: QuotaProfile): FreeQuotaView {
  return computeFreeQuotaForLimit(profile, FREE_TIER_MAX_USER_MESSAGES)
}

export function getQuotaError(profile: QuotaProfile): { error: 'guest_limit_reached' | 'missing_api_key'; message: string } | null {
  return getQuotaErrorForLimit(profile, FREE_TIER_MAX_USER_MESSAGES)
}

export function shouldMarkQuotaExhausted(profile: QuotaProfile): boolean {
  return shouldMarkQuotaExhaustedForLimit(profile, FREE_TIER_MAX_USER_MESSAGES)
}
