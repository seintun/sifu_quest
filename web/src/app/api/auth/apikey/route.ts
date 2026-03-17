import { encryptKey } from '@/lib/apikey'
import { validateAnthropicApiKey, validateOpenRouterApiKey } from '@/lib/apikey-validation'
import { createAdminClient } from '@/lib/supabase-admin'
import { deleteEncryptedProviderApiKey, upsertEncryptedProviderApiKey } from '@/lib/provider-api-keys'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { apiKeyPostSchema, apiKeyDeleteSchema, validationErrorResponse } from '@/lib/api-validation'

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

function extractDbErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  const maybeCode = (error as { code?: unknown }).code
  return typeof maybeCode === 'string' ? maybeCode : null
}

function parseProvider(value: unknown): 'anthropic' | 'openrouter' | null {
  if (value === 'anthropic' || value === 'openrouter') {
    return value
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const rawBody = await request.json().catch(() => ({}))
    const parsedBody = apiKeyPostSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return NextResponse.json(validationErrorResponse(parsedBody.error), { status: 400 })
    }

    const { apiKey, provider } = parsedBody.data
    const normalizedApiKey = apiKey.trim()
    const normalizedProvider = provider

    if (!normalizedProvider) {
      return NextResponse.json({ error: 'Provider is required.' }, { status: 400 })
    }

    if (normalizedProvider === 'anthropic') {
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
    } else {
      if (!normalizedApiKey || !normalizedApiKey.startsWith('sk-or-')) {
        return NextResponse.json({ error: 'Invalid OpenRouter API key' }, { status: 400 })
      }
      const keyValidation = await validateOpenRouterApiKey(normalizedApiKey)
      if (!keyValidation.ok) {
        if (keyValidation.code === 'invalid_key') {
          return NextResponse.json({ error: keyValidation.error, code: keyValidation.code }, { status: 400 })
        }
        return NextResponse.json({ error: keyValidation.error, code: keyValidation.code }, { status: 503 })
      }
    }
    
    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const encryptedKey = encryptKey(normalizedApiKey)
    await upsertEncryptedProviderApiKey(userId, normalizedProvider, encryptedKey)
    const supabase = createAdminClient()
    
    // Log the action
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'api_key.set',
      resource: normalizedProvider,
      details: { provider: normalizedProvider },
    })
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    if (extractDbErrorCode(error) === '23503') {
      return NextResponse.json(
        { error: 'Session identity is out of sync. Please sign out and sign in again.', code: 'identity_mismatch' },
        { status: 409 },
      )
    }
    console.error('Failed to process API key save request:', error)
    return NextResponse.json(buildSafeApiKeySaveError(error), { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const rawProvider = { provider: searchParams.get('provider') }
    const parsedProvider = apiKeyDeleteSchema.safeParse(rawProvider)
    if (!parsedProvider.success) {
      return NextResponse.json(validationErrorResponse(parsedProvider.error), { status: 400 })
    }
    const normalizedProvider = parsedProvider.data.provider
    await deleteEncryptedProviderApiKey(userId, normalizedProvider)
    
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'api_key.delete',
      resource: normalizedProvider,
      details: { provider: normalizedProvider },
    })
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    if (extractDbErrorCode(error) === '23503') {
      return NextResponse.json(
        { error: 'Session identity is out of sync. Please sign out and sign in again.', code: 'identity_mismatch' },
        { status: 409 },
      )
    }
    console.error('Failed to process API key delete request:', error)
    return NextResponse.json({ error: 'Failed to remove API key. Please try again.' }, { status: 500 })
  }
}
