import 'server-only'

import { createAdminClient } from './supabase-admin'

export type UserProfileState = {
  id: string
  is_guest: boolean
  guest_expires_at: string | null
  api_key_enc: string | null
  free_quota_exhausted: boolean
  free_user_messages_used: number
  display_name: string | null
  avatar_url: string | null
}

function isMissingFreeUsageColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) {
    return false
  }
  return error.code === '42703' || Boolean(error.message?.includes('free_user_messages_used'))
}

export function isAnonymousSessionEmail(email?: string | null): boolean {
  return Boolean(email?.endsWith('@anonymous.local'))
}

function getGuestExpiryISOString(): string {
  return new Date(Date.now() + 30 * 60 * 1000).toISOString()
}

export async function ensureUserProfile(userId: string, sessionEmail?: string | null): Promise<UserProfileState> {
  const supabaseAdmin = createAdminClient()
  const selectProfileFields = 'id, is_guest, guest_expires_at, api_key_enc, free_quota_exhausted, free_user_messages_used, display_name, avatar_url'
  const selectProfileFieldsLegacy = 'id, is_guest, guest_expires_at, api_key_enc, free_quota_exhausted, display_name, avatar_url'

  const { data: profile, error } = await supabaseAdmin
    .from('user_profiles')
    .select(selectProfileFields)
    .eq('id', userId)
    .maybeSingle()

  if (error && !isMissingFreeUsageColumnError(error)) {
    throw new Error(`Failed to load user profile: ${error.message}`)
  }

  if (error && isMissingFreeUsageColumnError(error)) {
    const { data: legacyProfile, error: legacyError } = await supabaseAdmin
      .from('user_profiles')
      .select(selectProfileFieldsLegacy)
      .eq('id', userId)
      .maybeSingle()

    if (legacyError) {
      throw new Error(`Failed to load user profile: ${legacyError.message}`)
    }

    if (legacyProfile) {
      return {
        ...legacyProfile,
        free_user_messages_used: 0,
        free_quota_exhausted: Boolean(legacyProfile.free_quota_exhausted),
      }
    }
  }

  if (profile) {
    return {
      ...profile,
      free_user_messages_used: profile.free_user_messages_used ?? 0,
      free_quota_exhausted: Boolean(profile.free_quota_exhausted),
    }
  }

  const isGuest = isAnonymousSessionEmail(sessionEmail)
  let { data: createdProfile, error: createError } = await supabaseAdmin
    .from('user_profiles')
    .insert({
      id: userId,
      is_guest: isGuest,
      guest_expires_at: isGuest ? getGuestExpiryISOString() : null,
      last_active_at: new Date().toISOString(),
      free_quota_exhausted: false,
      free_user_messages_used: 0,
    })
    .select(selectProfileFields)
    .single()

  if (createError && isMissingFreeUsageColumnError(createError)) {
    const legacyInsert = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: userId,
        is_guest: isGuest,
        guest_expires_at: isGuest ? getGuestExpiryISOString() : null,
        last_active_at: new Date().toISOString(),
        free_quota_exhausted: false,
      })
      .select(selectProfileFieldsLegacy)
      .single()

    if (!legacyInsert.error && legacyInsert.data) {
      return {
        ...legacyInsert.data,
        free_user_messages_used: 0,
        free_quota_exhausted: Boolean(legacyInsert.data.free_quota_exhausted),
      }
    }

    createError = legacyInsert.error
    createdProfile = null
  }

  if (createError || !createdProfile) {
    if (createError?.code === '23505') {
      const { data: existingProfile, error: refetchError } = await supabaseAdmin
        .from('user_profiles')
        .select(selectProfileFields)
        .eq('id', userId)
        .maybeSingle()

      if (refetchError) {
        throw new Error(`Failed to load user profile after duplicate insert: ${refetchError.message}`)
      }

      if (existingProfile) {
        return {
          ...existingProfile,
          free_user_messages_used: existingProfile.free_user_messages_used ?? 0,
          free_quota_exhausted: Boolean(existingProfile.free_quota_exhausted),
        }
      }
    }

    throw new Error(`Failed to initialize user profile: ${createError?.message ?? 'unknown error'}`)
  }

  return {
    ...createdProfile,
    free_user_messages_used: createdProfile.free_user_messages_used ?? 0,
    free_quota_exhausted: Boolean(createdProfile.free_quota_exhausted),
  }
}

export async function touchUserLastActiveAt(userId: string): Promise<void> {
  const supabaseAdmin = createAdminClient()
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) {
    console.error('Failed to update user last_active_at heartbeat', { userId, message: error.message })
  }
}
