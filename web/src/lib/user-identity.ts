import 'server-only'

import { createAdminClient } from './supabase-admin'

async function findSupabaseUserByEmail(email: string): Promise<string | null> {
  const supabaseAdmin = createAdminClient()
  const normalizedEmail = email.trim().toLowerCase()
  const perPage = 200
  let page = 1

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw new Error(`Failed to list Supabase users: ${error.message}`)
    }

    const users = data?.users ?? []
    const match = users.find((u) => u.email?.toLowerCase() === normalizedEmail)
    if (match) {
      return match.id
    }

    if (users.length < perPage) {
      return null
    }
    page += 1
  }
}

export async function resolveCanonicalUserId(
  sessionUserId: string,
  sessionEmail?: string | null,
): Promise<string> {
  const supabaseAdmin = createAdminClient()
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(sessionUserId)
  if (!error && data.user) {
    return sessionUserId
  }

  if (!sessionEmail || sessionEmail.endsWith('@anonymous.local')) {
    return sessionUserId
  }

  const userIdByEmail = await findSupabaseUserByEmail(sessionEmail)
  return userIdByEmail ?? sessionUserId
}
