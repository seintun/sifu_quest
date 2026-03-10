import 'server-only'

import { FREE_TIER_MAX_USER_MESSAGES } from './quota'
import { createAdminClient } from './supabase-admin'
import {
  computeFreeQuota,
  getQuotaError,
  isUsingFreeTier,
  shouldMarkQuotaExhausted,
  type FreeQuotaView,
  type QuotaProfile,
} from './free-quota-policy'

export { computeFreeQuota, getQuotaError, isUsingFreeTier, shouldMarkQuotaExhausted, type FreeQuotaView, type QuotaProfile }

export async function incrementFreeUserMessagesUsed(userId: string, incrementBy: number = 1): Promise<void> {
  const supabaseAdmin = createAdminClient()

  const { error } = await supabaseAdmin.rpc('increment_user_free_usage', {
    user_id_param: userId,
    increment_by: incrementBy,
    free_limit: FREE_TIER_MAX_USER_MESSAGES,
  })

  if (error) {
    throw new Error(`Failed to increment user free quota usage: ${error.message}`)
  }
}
