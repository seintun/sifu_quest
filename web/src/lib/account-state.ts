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
  default_provider: 'openrouter' | 'anthropic'
  default_model: string | null
}

function isMissingProfileColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) {
    return false
  }
  const message = error.message ?? ''
  return (
    error.code === '42703' ||
    message.includes('free_user_messages_used') ||
    message.includes('default_provider') ||
    message.includes('default_model')
  )
}

export function isAnonymousSessionEmail(email?: string | null): boolean {
  return Boolean(email?.endsWith('@anonymous.local'))
}

function getGuestExpiryISOString(): string {
  return new Date(Date.now() + 30 * 60 * 1000).toISOString()
}

export async function ensureUserProfile(userId: string, sessionEmail?: string | null): Promise<UserProfileState> {
  const supabaseAdmin = createAdminClient()
  const selectProfileFields = 'id, is_guest, guest_expires_at, api_key_enc, free_quota_exhausted, free_user_messages_used, display_name, avatar_url, default_provider, default_model'
  const selectProfileFieldsLegacy = 'id, is_guest, guest_expires_at, api_key_enc, free_quota_exhausted, display_name, avatar_url'

  const { data: profile, error } = await supabaseAdmin
    .from('user_profiles')
    .select(selectProfileFields)
    .eq('id', userId)
    .maybeSingle()

  if (error && !isMissingProfileColumnError(error)) {
    throw new Error(`Failed to load user profile: ${error.message}`)
  }

  if (error && isMissingProfileColumnError(error)) {
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
        default_provider: 'openrouter',
        default_model: null,
      }
    }
  }

  if (profile) {
    return {
      ...profile,
      free_user_messages_used: profile.free_user_messages_used ?? 0,
      free_quota_exhausted: Boolean(profile.free_quota_exhausted),
      default_provider: profile.default_provider === 'anthropic' ? 'anthropic' : 'openrouter',
      default_model: profile.default_model ?? null,
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
      default_provider: 'openrouter',
      default_model: null,
    })
    .select(selectProfileFields)
    .single()

  if (createError && isMissingProfileColumnError(createError)) {
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
        default_provider: 'openrouter',
        default_model: null,
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
          default_provider: existingProfile.default_provider === 'anthropic' ? 'anthropic' : 'openrouter',
          default_model: existingProfile.default_model ?? null,
        }
      }
    }

    throw new Error(`Failed to initialize user profile: ${createError?.message ?? 'unknown error'}`)
  }

  return {
    ...createdProfile,
    free_user_messages_used: createdProfile.free_user_messages_used ?? 0,
    free_quota_exhausted: Boolean(createdProfile.free_quota_exhausted),
    default_provider: createdProfile.default_provider === 'anthropic' ? 'anthropic' : 'openrouter',
    default_model: createdProfile.default_model ?? null,
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
