import 'server-only'

import { createAdminClient } from './supabase-admin'

type MergeableProfile = {
  display_name: string | null
  avatar_url: string | null
  api_key_enc: string | null
  free_quota_exhausted: boolean
  free_user_messages_used?: number
  // Onboarding fields — must be carried over so guest's completed onboarding is preserved
  onboarding_status?: string | null
  onboarding_version?: number | null
  onboarding_draft?: unknown
  onboarding_completion_percent?: number | null
  onboarding_next_prompt_key?: string | null
  onboarding_last_step?: number | null
  onboarding_core_completed_at?: string | null
  onboarding_enriched_completed_at?: string | null
  onboarding_plan_status?: string | null
  onboarding_plan_error_code?: string | null
}

function isMissingFreeUsageColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) {
    return false
  }
  return error.code === '42703' || Boolean(error.message?.includes('free_user_messages_used'))
}

async function getProfile(userId: string): Promise<MergeableProfile | null> {
  const supabaseAdmin = createAdminClient()
  const modernSelect = [
    'display_name', 'avatar_url', 'api_key_enc', 'free_quota_exhausted', 'free_user_messages_used',
    'onboarding_status', 'onboarding_version', 'onboarding_draft',
    'onboarding_completion_percent', 'onboarding_next_prompt_key', 'onboarding_last_step',
    'onboarding_core_completed_at', 'onboarding_enriched_completed_at',
    'onboarding_plan_status', 'onboarding_plan_error_code',
  ].join(', ')
  const legacySelect = 'display_name, avatar_url, api_key_enc, free_quota_exhausted'

  const modern = await supabaseAdmin
    .from('user_profiles')
    .select(modernSelect)
    .eq('id', userId)
    .maybeSingle()

  if (!modern.error) {
    return modern.data as MergeableProfile | null
  }

  if (!isMissingFreeUsageColumnError(modern.error)) {
    throw new Error(`Failed to load user profile for merge: ${modern.error.message}`)
  }

  const legacy = await supabaseAdmin
    .from('user_profiles')
    .select(legacySelect)
    .eq('id', userId)
    .maybeSingle()

  if (legacy.error) {
    throw new Error(`Failed to load legacy user profile for merge: ${legacy.error.message}`)
  }

  return legacy.data as MergeableProfile | null
}

export async function mergeGuestDataIntoUser(guestUserId: string, targetUserId: string): Promise<void> {
  if (guestUserId === targetUserId) {
    return
  }

  const supabaseAdmin = createAdminClient()

  const [guestProfile, targetProfile] = await Promise.all([
    getProfile(guestUserId),
    getProfile(targetUserId),
  ])

  const targetIsOnboarded =
    targetProfile?.onboarding_status === 'core_complete' ||
    targetProfile?.onboarding_status === 'enriched_complete'

  // Prefer the guest's onboarding state when the target account has not completed onboarding.
  // This is the common case: a guest finishes onboarding, then links Google afterward.
  const onboardingSource = targetIsOnboarded ? targetProfile : (guestProfile ?? targetProfile)

  const mergedProfile = {
    id: targetUserId,
    // Prefer the guest's display_name — it has the real onboarding name (e.g. "The Odd One").
    // The target Google profile is freshly created with display_name=null, so we'd get a
    // misleading "Guest" prefill from the session name if we used targetProfile first.
    // Only fall back to target's display_name if the guest genuinely has none.
    display_name: guestProfile?.display_name ?? targetProfile?.display_name ?? null,
    avatar_url: targetProfile?.avatar_url ?? guestProfile?.avatar_url ?? null,
    is_guest: false,
    guest_expires_at: null,
    api_key_enc: targetProfile?.api_key_enc ?? guestProfile?.api_key_enc ?? null,
    free_quota_exhausted: Boolean(targetProfile?.free_quota_exhausted || guestProfile?.free_quota_exhausted),
    free_user_messages_used: Math.max(targetProfile?.free_user_messages_used ?? 0, guestProfile?.free_user_messages_used ?? 0),
    last_active_at: new Date().toISOString(),
    // Carry over all onboarding fields so the guard doesn't redirect back to /onboarding
    onboarding_status: onboardingSource?.onboarding_status ?? null,
    onboarding_version: onboardingSource?.onboarding_version ?? null,
    onboarding_draft: onboardingSource?.onboarding_draft ?? null,
    onboarding_completion_percent: onboardingSource?.onboarding_completion_percent ?? null,
    onboarding_next_prompt_key: onboardingSource?.onboarding_next_prompt_key ?? null,
    onboarding_last_step: onboardingSource?.onboarding_last_step ?? null,
    onboarding_core_completed_at: onboardingSource?.onboarding_core_completed_at ?? null,
    onboarding_enriched_completed_at: onboardingSource?.onboarding_enriched_completed_at ?? null,
    onboarding_plan_status: onboardingSource?.onboarding_plan_status ?? null,
    onboarding_plan_error_code: onboardingSource?.onboarding_plan_error_code ?? null,
  }

  const profileUpsert = await supabaseAdmin
    .from('user_profiles')
    .upsert(mergedProfile, { onConflict: 'id' })

  if (profileUpsert.error && isMissingFreeUsageColumnError(profileUpsert.error)) {
    const legacyUpsert = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        id: targetUserId,
        display_name: mergedProfile.display_name,
        avatar_url: mergedProfile.avatar_url,
        is_guest: false,
        guest_expires_at: null,
        api_key_enc: mergedProfile.api_key_enc,
        free_quota_exhausted: mergedProfile.free_quota_exhausted,
        last_active_at: mergedProfile.last_active_at,
      }, { onConflict: 'id' })

    if (legacyUpsert.error) {
      throw new Error(`Failed to merge profile (legacy): ${legacyUpsert.error.message}`)
    }
  } else if (profileUpsert.error) {
    throw new Error(`Failed to merge profile: ${profileUpsert.error.message}`)
  }

  const { data: guestMemoryFiles, error: guestMemoryError } = await supabaseAdmin
    .from('memory_files')
    .select('filename, content, version, updated_at')
    .eq('user_id', guestUserId)

  if (guestMemoryError) {
    throw new Error(`Failed to load guest memory files: ${guestMemoryError.message}`)
  }

  if (guestMemoryFiles && guestMemoryFiles.length > 0) {
    const { error: upsertMemoryError } = await supabaseAdmin
      .from('memory_files')
      .upsert(
        guestMemoryFiles.map((row) => ({
          user_id: targetUserId,
          filename: row.filename,
          content: row.content,
          version: row.version,
          updated_at: row.updated_at,
        })),
        { onConflict: 'user_id,filename' },
      )

    if (upsertMemoryError) {
      throw new Error(`Failed to merge memory files: ${upsertMemoryError.message}`)
    }
  }

  const transferTables = [
    'memory_file_versions',
    'chat_sessions',
    'chat_messages',
    'progress_events',
    'audit_log',
  ] as const

  for (const table of transferTables) {
    const { error } = await supabaseAdmin
      .from(table)
      .update({ user_id: targetUserId })
      .eq('user_id', guestUserId)

    if (error) {
      throw new Error(`Failed to merge ${table}: ${error.message}`)
    }
  }

  const { error: deleteGuestProfileError } = await supabaseAdmin
    .from('user_profiles')
    .delete()
    .eq('id', guestUserId)

  if (deleteGuestProfileError) {
    console.warn('Failed to delete guest profile after merge', deleteGuestProfileError)
  }

  const { error: deleteGuestAuthError } = await supabaseAdmin.auth.admin.deleteUser(guestUserId)
  if (deleteGuestAuthError) {
    console.warn('Failed to delete guest auth user after merge', deleteGuestAuthError)
  }
}
