import 'server-only'

import { ONBOARDING_SCHEMA_VERSION } from './onboarding-v2'
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
  onboarding_status: 'not_started' | 'in_progress' | 'core_complete' | 'enriched_complete'
  onboarding_version: number
  onboarding_completion_percent: number
  onboarding_next_prompt_key: string | null
  onboarding_core_completed_at: string | null
  onboarding_enriched_completed_at: string | null
  onboarding_draft: Record<string, unknown> | null
  onboarding_last_step: number
  onboarding_plan_status: 'not_queued' | 'queued' | 'running' | 'ready' | 'failed'
  onboarding_plan_error_code: string | null
  onboarding_plan_retries: number
  onboarding_plan_last_attempt_at: string | null
}

function isMissingProfileColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) {
    return false
  }
  const message = error.message ?? ''
  const missingColumnLikeMessage =
    message.includes('column') &&
    (message.includes('does not exist') || message.includes('Could not find'))
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    (missingColumnLikeMessage && message.includes('onboarding_')) ||
    message.includes('free_user_messages_used') ||
    message.includes('default_provider') ||
    message.includes('default_model') ||
    message.includes('onboarding_status') ||
    message.includes('onboarding_plan_status')
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
  const selectProfileFields = 'id, is_guest, guest_expires_at, api_key_enc, free_quota_exhausted, free_user_messages_used, display_name, avatar_url, default_provider, default_model, onboarding_status, onboarding_version, onboarding_completion_percent, onboarding_next_prompt_key, onboarding_core_completed_at, onboarding_enriched_completed_at, onboarding_draft, onboarding_last_step, onboarding_plan_status, onboarding_plan_error_code, onboarding_plan_retries, onboarding_plan_last_attempt_at'
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
        onboarding_status: 'not_started',
        onboarding_version: ONBOARDING_SCHEMA_VERSION,
        onboarding_completion_percent: 0,
        onboarding_next_prompt_key: null,
        onboarding_core_completed_at: null,
        onboarding_enriched_completed_at: null,
        onboarding_draft: null,
        onboarding_last_step: 0,
        onboarding_plan_status: 'not_queued',
        onboarding_plan_error_code: null,
        onboarding_plan_retries: 0,
        onboarding_plan_last_attempt_at: null,
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
      onboarding_status: profile.onboarding_status ?? 'not_started',
      onboarding_version: profile.onboarding_version ?? ONBOARDING_SCHEMA_VERSION,
      onboarding_completion_percent: profile.onboarding_completion_percent ?? 0,
      onboarding_next_prompt_key: profile.onboarding_next_prompt_key ?? null,
      onboarding_core_completed_at: profile.onboarding_core_completed_at ?? null,
      onboarding_enriched_completed_at: profile.onboarding_enriched_completed_at ?? null,
      onboarding_draft: profile.onboarding_draft ?? null,
      onboarding_last_step: profile.onboarding_last_step ?? 0,
      onboarding_plan_status: profile.onboarding_plan_status ?? 'not_queued',
      onboarding_plan_error_code: profile.onboarding_plan_error_code ?? null,
      onboarding_plan_retries: profile.onboarding_plan_retries ?? 0,
      onboarding_plan_last_attempt_at: profile.onboarding_plan_last_attempt_at ?? null,
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
      onboarding_status: 'not_started',
      onboarding_version: ONBOARDING_SCHEMA_VERSION,
      onboarding_completion_percent: 0,
      onboarding_next_prompt_key: null,
      onboarding_core_completed_at: null,
      onboarding_enriched_completed_at: null,
      onboarding_draft: {},
      onboarding_last_step: 0,
      onboarding_plan_status: 'not_queued',
      onboarding_plan_error_code: null,
      onboarding_plan_retries: 0,
      onboarding_plan_last_attempt_at: null,
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
        onboarding_status: 'not_started',
        onboarding_version: ONBOARDING_SCHEMA_VERSION,
        onboarding_completion_percent: 0,
        onboarding_next_prompt_key: null,
        onboarding_core_completed_at: null,
        onboarding_enriched_completed_at: null,
        onboarding_draft: null,
        onboarding_last_step: 0,
        onboarding_plan_status: 'not_queued',
        onboarding_plan_error_code: null,
        onboarding_plan_retries: 0,
        onboarding_plan_last_attempt_at: null,
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
        if (isMissingProfileColumnError(refetchError)) {
          const { data: existingLegacyProfile, error: legacyRefetchError } = await supabaseAdmin
            .from('user_profiles')
            .select(selectProfileFieldsLegacy)
            .eq('id', userId)
            .maybeSingle()

          if (legacyRefetchError) {
            throw new Error(`Failed to load user profile after duplicate insert: ${legacyRefetchError.message}`)
          }

          if (existingLegacyProfile) {
            return {
              ...existingLegacyProfile,
              free_user_messages_used: 0,
              free_quota_exhausted: Boolean(existingLegacyProfile.free_quota_exhausted),
              default_provider: 'openrouter',
              default_model: null,
              onboarding_status: 'not_started',
              onboarding_version: ONBOARDING_SCHEMA_VERSION,
              onboarding_completion_percent: 0,
              onboarding_next_prompt_key: null,
              onboarding_core_completed_at: null,
              onboarding_enriched_completed_at: null,
              onboarding_draft: null,
              onboarding_last_step: 0,
              onboarding_plan_status: 'not_queued',
              onboarding_plan_error_code: null,
              onboarding_plan_retries: 0,
              onboarding_plan_last_attempt_at: null,
            }
          }
        }
        throw new Error(`Failed to load user profile after duplicate insert: ${refetchError.message}`)
      }

      if (existingProfile) {
        return {
          ...existingProfile,
          free_user_messages_used: existingProfile.free_user_messages_used ?? 0,
          free_quota_exhausted: Boolean(existingProfile.free_quota_exhausted),
          default_provider: existingProfile.default_provider === 'anthropic' ? 'anthropic' : 'openrouter',
          default_model: existingProfile.default_model ?? null,
          onboarding_status: existingProfile.onboarding_status ?? 'not_started',
          onboarding_version: existingProfile.onboarding_version ?? ONBOARDING_SCHEMA_VERSION,
          onboarding_completion_percent: existingProfile.onboarding_completion_percent ?? 0,
          onboarding_next_prompt_key: existingProfile.onboarding_next_prompt_key ?? null,
          onboarding_core_completed_at: existingProfile.onboarding_core_completed_at ?? null,
          onboarding_enriched_completed_at: existingProfile.onboarding_enriched_completed_at ?? null,
          onboarding_draft: existingProfile.onboarding_draft ?? null,
          onboarding_last_step: existingProfile.onboarding_last_step ?? 0,
          onboarding_plan_status: existingProfile.onboarding_plan_status ?? 'not_queued',
          onboarding_plan_error_code: existingProfile.onboarding_plan_error_code ?? null,
          onboarding_plan_retries: existingProfile.onboarding_plan_retries ?? 0,
          onboarding_plan_last_attempt_at: existingProfile.onboarding_plan_last_attempt_at ?? null,
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
    onboarding_status: createdProfile.onboarding_status ?? 'not_started',
    onboarding_version: createdProfile.onboarding_version ?? ONBOARDING_SCHEMA_VERSION,
    onboarding_completion_percent: createdProfile.onboarding_completion_percent ?? 0,
    onboarding_next_prompt_key: createdProfile.onboarding_next_prompt_key ?? null,
    onboarding_core_completed_at: createdProfile.onboarding_core_completed_at ?? null,
    onboarding_enriched_completed_at: createdProfile.onboarding_enriched_completed_at ?? null,
    onboarding_draft: createdProfile.onboarding_draft ?? null,
    onboarding_last_step: createdProfile.onboarding_last_step ?? 0,
    onboarding_plan_status: createdProfile.onboarding_plan_status ?? 'not_queued',
    onboarding_plan_error_code: createdProfile.onboarding_plan_error_code ?? null,
    onboarding_plan_retries: createdProfile.onboarding_plan_retries ?? 0,
    onboarding_plan_last_attempt_at: createdProfile.onboarding_plan_last_attempt_at ?? null,
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
