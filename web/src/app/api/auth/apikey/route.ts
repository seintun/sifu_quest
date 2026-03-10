import { encryptKey } from '@/lib/apikey'
import { createAdminClient } from '@/lib/supabase-admin'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { apiKey } = await request.json()
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('sk-ant-')) {
      return NextResponse.json({ error: 'Invalid Anthropic API key' }, { status: 400 })
    }
    
    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const encryptedKey = encryptKey(apiKey)
    
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
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
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
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
