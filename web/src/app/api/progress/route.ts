import { computeMetrics } from '@/lib/metrics'
import { createProgressGetHandler } from '@/lib/progress-api'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const handleProgressGet = createProgressGetHandler({
  authFn: auth,
  resolveUserIdFn: resolveCanonicalUserId,
  computeMetricsFn: computeMetrics,
})

export async function GET() {
  const result = await handleProgressGet()
  return NextResponse.json(result.body, { status: result.status })
}
