import { createAdminClient } from '@/lib/supabase-admin'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)

    const supabase = createAdminClient()
    const { data: events, error } = await supabase
      .from('progress_events')
      .select('*')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json(events || [])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
