import { createAdminClient } from '@/lib/supabase-admin'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { progressEventsGetSchema, validationErrorResponse } from '@/lib/api-validation'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const { searchParams } = new URL(request.url)
    const rawParams = { limit: searchParams.get('limit') ?? undefined }
    const parsedParams = progressEventsGetSchema.safeParse(rawParams)
    if (!parsedParams.success) {
      return NextResponse.json(validationErrorResponse(parsedParams.error), { status: 400 })
    }
    const limit = parsedParams.data.limit

    const supabase = createAdminClient()
    const { data: events, error } = await supabase
      .from('progress_events')
      .select('id,event_type,domain,payload,occurred_at')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    return NextResponse.json(events || [])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
