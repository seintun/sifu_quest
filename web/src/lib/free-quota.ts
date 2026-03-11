import 'server-only'

import { FREE_TIER_MAX_USER_MESSAGES } from './quota'
import { createAdminClient } from './supabase-admin'
import {
  computeFreeQuota,
  getQuotaError,
  isUsingFreeTier,
  shouldEnforceProviderQuota,
  shouldMarkQuotaExhausted,
  type FreeQuotaView,
  type QuotaProvider,
  type QuotaProfile,
} from './free-quota-policy'

export {
  computeFreeQuota,
  getQuotaError,
  isUsingFreeTier,
  shouldEnforceProviderQuota,
  shouldMarkQuotaExhausted,
  type FreeQuotaView,
  type QuotaProvider,
  type QuotaProfile,
}

function isMissingFunctionError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) {
    return false
  }
  return error.code === 'PGRST202' || Boolean(error.message?.includes('Could not find the function'))
}

function isMissingFreeUsageColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) {
    return false
  }
  return error.code === '42703' || Boolean(error.message?.includes('free_user_messages_used'))
}

export async function incrementFreeUserMessagesUsed(userId: string, incrementBy: number = 1): Promise<void> {
  const supabaseAdmin = createAdminClient()

  const { error } = await supabaseAdmin.rpc('increment_user_free_usage', {
    user_id_param: userId,
    increment_by: incrementBy,
    free_limit: FREE_TIER_MAX_USER_MESSAGES,
  })

  if (!error) {
    return
  }

  if (!isMissingFunctionError(error)) {
    throw new Error(`Failed to increment user free quota usage: ${error.message}`)
  }

  // Legacy fallback: migration/RPC not deployed yet.
  const { data: profile, error: selectError } = await supabaseAdmin
    .from('user_profiles')
    .select('free_user_messages_used, free_quota_exhausted')
    .eq('id', userId)
    .maybeSingle()

  if (selectError) {
    if (isMissingFreeUsageColumnError(selectError)) {
      // Pre-migration schema; silently skip counter updates.
      return
    }
    throw new Error(`Failed to load free quota usage: ${selectError.message}`)
  }

  const currentUsed = profile?.free_user_messages_used ?? 0
  const nextUsed = currentUsed + incrementBy
  const nextExhausted = Boolean(profile?.free_quota_exhausted) || nextUsed >= FREE_TIER_MAX_USER_MESSAGES

  const { error: updateError } = await supabaseAdmin
    .from('user_profiles')
    .update({
      free_user_messages_used: nextUsed,
      free_quota_exhausted: nextExhausted,
    })
    .eq('id', userId)

  if (updateError && !isMissingFreeUsageColumnError(updateError)) {
    throw new Error(`Failed to update free quota usage: ${updateError.message}`)
  }
}
