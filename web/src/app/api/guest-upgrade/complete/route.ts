import { auth } from '@/auth'
import { mergeGuestDataIntoUser } from '@/lib/guest-data-merge'
import { verifyGuestUpgradeToken } from '@/lib/guest-upgrade-token'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(`${url.origin}/settings?error=link_failed`)
  }

  const payload = verifyGuestUpgradeToken(token)
  if (!payload) {
    return NextResponse.redirect(`${url.origin}/settings?error=link_failed`)
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(`${url.origin}/login`)
  }

  const targetUserId = await resolveCanonicalUserId(session.user.id, session.user.email)

  try {
    await mergeGuestDataIntoUser(payload.guestUserId, targetUserId)
    return NextResponse.redirect(`${url.origin}/settings?success=linked`)
  } catch (error) {
    console.error('Failed to complete guest data merge after Google sign-in', error)
    return NextResponse.redirect(`${url.origin}/settings?error=link_failed`)
  }
}
