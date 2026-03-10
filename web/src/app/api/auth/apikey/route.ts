import { encryptKey } from '@/lib/apikey'
import { evaluateTrialEntitlement } from '@/lib/entitlements'
import { createClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const supabase = await createClient()
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('api_key_enc, trial_started_at, trial_messages_used')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error("Failed to fetch API key status:", error)
      return NextResponse.json({ error: 'Failed to fetch API key status' }, { status: 500 })
    }

    const hasPersonalKey = Boolean(profile?.api_key_enc)
    const trial = evaluateTrialEntitlement({
      trialStartedAt: profile?.trial_started_at || null,
      trialMessagesUsed: profile?.trial_messages_used || 0,
    })

    return NextResponse.json({
      hasPersonalKey,
      trial: {
        active: trial.allowed,
        code: trial.code || null,
        remainingMessages: trial.remainingMessages,
        expiresAt: trial.expiresAt,
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

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
    
    const userId = session.user.id
    const encryptedKey = encryptKey(apiKey)
    
    const supabase = await createClient()
    
    // Upsert the profile row so key save works even before onboarding bootstrap.
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        api_key_enc: encryptedKey,
        last_active_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      })
      
    if (error) {
      console.error("Failed to save API key:", error)
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

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userId = session.user.id
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('user_profiles')
      .update({ api_key_enc: null })
      .eq('id', userId)
      
    if (error) {
      console.error("Failed to delete API key:", error)
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
