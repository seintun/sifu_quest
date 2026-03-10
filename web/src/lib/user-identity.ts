import 'server-only'

import { findSupabaseUserByEmail } from './auth-identity'
import { createAdminClient } from './supabase-admin'
import { shouldAttemptEmailFallback } from './user-identity-utils'

export async function resolveCanonicalUserId(
  sessionUserId: string,
  sessionEmail?: string | null,
): Promise<string> {
  const supabaseAdmin = createAdminClient()
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(sessionUserId)
  if (!error && data.user) {
    return sessionUserId
  }

  if (!sessionEmail || !shouldAttemptEmailFallback(sessionEmail)) {
    return sessionUserId
  }

  const userIdByEmail = await findSupabaseUserByEmail(sessionEmail)
  if (userIdByEmail && userIdByEmail !== sessionUserId) {
    console.warn('resolveCanonicalUserId fallback matched a different user id; identity-link migration still in use', {
      sessionUserId,
      fallbackUserId: userIdByEmail,
    })
  }
  return userIdByEmail ?? sessionUserId
}
