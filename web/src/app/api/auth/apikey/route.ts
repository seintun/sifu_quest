import { encryptKey } from '@/lib/apikey'
import { validateAnthropicApiKey } from '@/lib/apikey-validation'
import { createAdminClient } from '@/lib/supabase-admin'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'

function isApiKeyEncryptionConfigError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('API_KEY_ENCRYPTION_SECRET')
}

function buildSafeApiKeySaveError(error: unknown): { error: string; code?: string } {
  if (isApiKeyEncryptionConfigError(error)) {
    return {
      error: 'Secure key storage is temporarily unavailable. Please try again shortly.',
      code: 'apikey_config_error',
    }
  }

  return {
    error: 'Failed to save API key. Please try again.',
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { apiKey } = await request.json()
    const normalizedApiKey = typeof apiKey === 'string' ? apiKey.trim() : ''

    if (!normalizedApiKey || !normalizedApiKey.startsWith('sk-ant-')) {
      return NextResponse.json({ error: 'Invalid Anthropic API key' }, { status: 400 })
    }

    const keyValidation = await validateAnthropicApiKey(normalizedApiKey)
    if (!keyValidation.ok) {
      if (keyValidation.code === 'invalid_key') {
        return NextResponse.json({ error: keyValidation.error, code: keyValidation.code }, { status: 400 })
      }
      return NextResponse.json({ error: keyValidation.error, code: keyValidation.code }, { status: 503 })
    }
    
    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const encryptedKey = encryptKey(normalizedApiKey)
    
    const supabase = createAdminClient()
    
    // Upsert ensures a profile row exists even before first chat bootstrap.
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        api_key_enc: encryptedKey,
        last_active_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      
    if (error) {
      console.error("Failed to save API key:", error)
      if (error.code === '23503') {
        return NextResponse.json(
          { error: 'Session identity is out of sync. Please sign out and sign in again.', code: 'identity_mismatch' },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 })
    }
    
    // Log the action
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'api_key.set',
      resource: 'user_profiles'
    })
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Failed to process API key save request:', error)
    return NextResponse.json(buildSafeApiKeySaveError(error), { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const supabase = createAdminClient()
    
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        api_key_enc: null,
        last_active_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      
    if (error) {
      console.error("Failed to delete API key:", error)
      if (error.code === '23503') {
        return NextResponse.json(
          { error: 'Session identity is out of sync. Please sign out and sign in again.', code: 'identity_mismatch' },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 })
    }
    
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'api_key.delete',
      resource: 'user_profiles'
    })
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Failed to process API key delete request:', error)
    return NextResponse.json({ error: 'Failed to remove API key. Please try again.' }, { status: 500 })
  }
}
