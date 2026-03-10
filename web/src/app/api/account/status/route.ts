import { auth } from '@/auth'
import { ensureUserProfile } from '@/lib/account-state'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const profile = await ensureUserProfile(userId, session.user.email)
    const sessionName = typeof session.user.name === 'string' ? session.user.name.trim() : ''
    const prefillName = profile.display_name ? null : (sessionName || null)
    const isAnonymousSession = Boolean(session.user.email?.endsWith('@anonymous.local'))

    return NextResponse.json({
      account: {
        userId,
        isGuest: profile.is_guest,
        isAnonymousSession,
        isLinked: !profile.is_guest,
        displayName: profile.display_name,
        hasApiKey: Boolean(profile.api_key_enc),
        prefillName,
        avatarUrl: profile.avatar_url,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
