import 'server-only'

import { createAdminClient } from './supabase-admin'

type ProviderApiKey = {
  provider: 'anthropic' | 'openrouter'
  api_key_enc: string
}

function isMissingUserApiKeysTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === '42P01' || Boolean(error.message?.includes('user_api_keys'))
}

export async function getEncryptedProviderApiKey(
  userId: string,
  provider: 'anthropic' | 'openrouter',
): Promise<string | null> {
  const supabase = createAdminClient()
  const modern = await supabase
    .from('user_api_keys')
    .select('api_key_enc')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle()

  if (!modern.error) {
    return modern.data?.api_key_enc ?? null
  }

  if (!isMissingUserApiKeysTable(modern.error)) {
    throw new Error(`Failed to load provider API key: ${modern.error.message}`)
  }

  if (provider !== 'anthropic') {
    return null
  }

  // Legacy fallback before provider-key table rollout.
  const legacy = await supabase
    .from('user_profiles')
    .select('api_key_enc')
    .eq('id', userId)
    .maybeSingle()

  if (legacy.error) {
    throw new Error(`Failed to load legacy API key: ${legacy.error.message}`)
  }

  return legacy.data?.api_key_enc ?? null
}

export async function upsertEncryptedProviderApiKey(
  userId: string,
  provider: 'anthropic' | 'openrouter',
  apiKeyEnc: string,
): Promise<void> {
  const supabase = createAdminClient()
  const modern = await supabase
    .from('user_api_keys')
    .upsert(
      {
        user_id: userId,
        provider,
        api_key_enc: apiKeyEnc,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    )

  if (modern.error && !isMissingUserApiKeysTable(modern.error)) {
    throw new Error(`Failed to save provider API key: ${modern.error.message}`)
  }

  if (modern.error && provider !== 'anthropic') {
    throw new Error(`Provider key table unavailable for ${provider}.`)
  }

  if (provider === 'anthropic') {
    // Keep legacy column synced for backward compatibility while migration rolls out.
    const legacy = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: userId,
          api_key_enc: apiKeyEnc,
          last_active_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )

    if (legacy.error) {
      throw new Error(`Failed to save legacy Anthropic API key: ${legacy.error.message}`)
    }
  }
}

export async function deleteEncryptedProviderApiKey(
  userId: string,
  provider: 'anthropic' | 'openrouter',
): Promise<void> {
  const supabase = createAdminClient()
  const modern = await supabase
    .from('user_api_keys')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider)

  if (modern.error && !isMissingUserApiKeysTable(modern.error)) {
    throw new Error(`Failed to delete provider API key: ${modern.error.message}`)
  }

  if (provider === 'anthropic') {
    const legacy = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: userId,
          api_key_enc: null,
          last_active_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )

    if (legacy.error) {
      throw new Error(`Failed to clear legacy Anthropic API key: ${legacy.error.message}`)
    }
  }
}

export async function hasEncryptedProviderApiKey(
  userId: string,
  provider: 'anthropic' | 'openrouter',
): Promise<boolean> {
  const encrypted = await getEncryptedProviderApiKey(userId, provider)
  return Boolean(encrypted)
}

export async function loadAllEncryptedProviderKeys(userId: string): Promise<ProviderApiKey[]> {
  const supabase = createAdminClient()
  const modern = await supabase
    .from('user_api_keys')
    .select('provider, api_key_enc')
    .eq('user_id', userId)

  if (!modern.error) {
    return (modern.data ?? []) as ProviderApiKey[]
  }

  if (!isMissingUserApiKeysTable(modern.error)) {
    throw new Error(`Failed to load provider API keys: ${modern.error.message}`)
  }

  const legacy = await supabase
    .from('user_profiles')
    .select('api_key_enc')
    .eq('id', userId)
    .maybeSingle()

  if (legacy.error) {
    throw new Error(`Failed to load legacy provider API key: ${legacy.error.message}`)
  }

  if (!legacy.data?.api_key_enc) {
    return []
  }

  return [{ provider: 'anthropic', api_key_enc: legacy.data.api_key_enc }]
}
