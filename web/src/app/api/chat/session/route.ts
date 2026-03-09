import { createClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode')
    
    if (!mode) {
      return NextResponse.json({ error: 'Mode is required' }, { status: 400 })
    }

    const supabase = await createClient()

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
      return NextResponse.json({ session: null, messages: [] })
    }

    // Fetch messages for this session
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('session_id', chatSession.id)
      .order('created_at', { ascending: true })

    if (messagesError) {
       console.error(messagesError)
       return NextResponse.json({ error: 'Database error fetching messages' }, { status: 500 })
    }

    return NextResponse.json({
      session: chatSession,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
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
    const userId = session.user.id
    const { mode, title } = await request.json()

    if (!mode) {
      return NextResponse.json({ error: 'Mode is required' }, { status: 400 })
    }

    const supabase = await createClient()

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

    if (error) {
       console.error(error)
       return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
    }

    return NextResponse.json({ session: newSession })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
