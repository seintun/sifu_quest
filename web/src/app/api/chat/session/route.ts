import { createAdminClient } from '@/lib/supabase-admin'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode')
    
    if (!mode) {
      return NextResponse.json({ error: 'Mode is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Calculate free-tier quota limits globally across all sessions
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('is_guest, api_key_enc, free_quota_exhausted')
      .eq('id', userId)
      .maybeSingle()

    let isFreeTier = true
    if (userProfile && !userProfile.is_guest && userProfile.api_key_enc) {
      isFreeTier = false
    }

    let freeQuota = null
    if (isFreeTier && userProfile) {
      if (userProfile.free_quota_exhausted) {
        freeQuota = { isFreeTier: true, remaining: 0, total: 5 }
      } else {
        const { data: totalMessagesData } = await supabase
          .from('chat_sessions')
          .select('message_count')
          .eq('user_id', userId)

        const totalMessages = totalMessagesData?.reduce((sum, session) => sum + (session.message_count || 0), 0) || 0
        const remaining = Math.max(0, 10 - totalMessages)
        freeQuota = { isFreeTier: true, remaining: Math.floor(remaining / 2), total: 5 }
      }
    } else if (!isFreeTier) {
       freeQuota = { isFreeTier: false, remaining: -1, total: -1 }
    } else {
       // no profile yet
       freeQuota = { isFreeTier: true, remaining: 5, total: 5 }
    }

    // Find the most recent unarchived session for this mode 
    // In a multi-session UI, we would return a list. For now, we return the active one.
    const { data: chatSession, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at, message_count')
      .eq('user_id', userId)
      .eq('mode', mode)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (sessionError && sessionError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error(sessionError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!chatSession) {
      return NextResponse.json({ session: null, messages: [], freeQuota })
    }

    // Fetch messages for this session
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('session_id', chatSession.id)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (messagesError) {
       console.error(messagesError)
       return NextResponse.json({ error: 'Database error fetching messages' }, { status: 500 })
    }

    return NextResponse.json({
      session: chatSession,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      freeQuota
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
    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const { mode, title } = await request.json()

    if (!mode) {
      return NextResponse.json({ error: 'Mode is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Mark existing sessions for this mode as archived (optional, depends on UX)
    // If we want a linear history per mode, we can archive old ones or just keep appending.
    // Let's archive old ones so the user gets a fresh slate.
    await supabase
      .from('chat_sessions')
      .update({ is_archived: true })
      .eq('user_id', userId)
      .eq('mode', mode)
      .eq('is_archived', false)

    // 2. Create the new session
    const { data: newSession, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: userId,
        mode,
        title: title || `Chat - ${mode}`
      })
      .select()
      .single()

    // 3. Re-calculate the free quota because this action creates a new session, but retains the global history count
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('is_guest, api_key_enc, free_quota_exhausted')
      .eq('id', userId)
      .maybeSingle()

    let isFreeTier = true
    if (userProfile && !userProfile.is_guest && userProfile.api_key_enc) {
      isFreeTier = false
    }

    let freeQuota = null
    if (isFreeTier && userProfile) {
      if (userProfile.free_quota_exhausted) {
        freeQuota = { isFreeTier: true, remaining: 0, total: 5 }
      } else {
        const { data: totalMessagesData } = await supabase
          .from('chat_sessions')
          .select('message_count')
          .eq('user_id', userId)

        const totalMessages = totalMessagesData?.reduce((sum, session) => sum + (session.message_count || 0), 0) || 0
        const remaining = Math.max(0, 10 - totalMessages)
        freeQuota = { isFreeTier: true, remaining: Math.floor(remaining / 2), total: 5 }
      }
    } else if (!isFreeTier) {
       freeQuota = { isFreeTier: false, remaining: -1, total: -1 }
    } else {
       freeQuota = { isFreeTier: true, remaining: 5, total: 5 }
    }

    if (error) {
       console.error(error)
       if (error.code === '23503') {
         return NextResponse.json(
           { error: 'Unable to create chat session for this account. Please sign out and sign in again.' },
           { status: 409 },
         )
       }
       return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    return NextResponse.json({ session: newSession, freeQuota })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
