import { runOnboardingPlanJobs } from '@/lib/onboarding-service'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

function getWorkerSecret(): string | null {
  const secret = process.env.ONBOARDING_WORKER_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  if (!secret || secret.trim().length === 0) {
    return null
  }
  return secret
}

export async function POST(request: NextRequest) {
  try {
    const secret = getWorkerSecret()
    if (!secret) {
      return NextResponse.json(
        { error: 'Worker secret is not configured.' },
        { status: 503 },
      )
    }

    const incomingSecret = request.headers.get('x-onboarding-worker-secret')
    if (incomingSecret !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const limitRaw = typeof body?.limit === 'number' ? body.limit : 5
    const limit = Math.min(20, Math.max(1, Math.floor(limitRaw)))

    const result = await runOnboardingPlanJobs(limit)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
