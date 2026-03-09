import { encryptKey } from '@/lib/apikey'
import { createClient } from '@/lib/supabase'
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
    
    const userId = session.user.id
    const encryptedKey = encryptKey(apiKey)
    
    const supabase = await createClient()
    
    // Update the user_profiles table with the encrypted key
    const { error } = await supabase
      .from('user_profiles')
      .update({ api_key_enc: encryptedKey })
      .eq('id', userId)
      
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
