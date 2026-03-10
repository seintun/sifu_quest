import { auth } from '@/auth'
import { getRuntimeConfigStatus } from '@/lib/env'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.email?.endsWith('@anonymous.local')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const status = getRuntimeConfigStatus()
  return NextResponse.json(status)
}
