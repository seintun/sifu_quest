import 'server-only'

import { createAdminClient } from './supabase-admin'

export type OAuthUserSeed = {
  email: string
  name?: string | null
  image?: string | null
}

export async function findSupabaseUserByEmail(email: string): Promise<string | null> {
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

export async function ensureSupabaseUserForGoogle(user: OAuthUserSeed): Promise<string> {
  const supabaseAdmin = createAdminClient()
  const existingId = await findSupabaseUserByEmail(user.email)
  if (existingId) {
    return existingId
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: user.email.trim().toLowerCase(),
    email_confirm: true,
    user_metadata: {
      name: user.name ?? null,
      avatar_url: user.image ?? null,
      provider: 'google',
    },
  })

  if (error || !data.user) {
    throw new Error(`Failed to create Supabase user for Google login: ${error?.message ?? 'unknown error'}`)
  }

  return data.user.id
}
