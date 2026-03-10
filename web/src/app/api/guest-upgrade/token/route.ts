import { auth } from '@/auth'
import { ensureUserProfile } from '@/lib/account-state'
import { createGuestUpgradeToken } from '@/lib/guest-upgrade-token'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const guestUserId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const profile = await ensureUserProfile(guestUserId, session.user.email)

    if (!profile.is_guest) {
      return NextResponse.json({ error: 'Only guest accounts can request an upgrade token.' }, { status: 400 })
    }

    const token = createGuestUpgradeToken(guestUserId)
    return NextResponse.json({ token })
  } catch (error) {
    console.error('Failed to create guest upgrade token', error)
    return NextResponse.json(
      { error: 'Unable to start account upgrade right now. Please try again.' },
      { status: 500 },
    )
  }
}
