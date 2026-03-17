import { createApiErrorResponse, createRequestId } from '@/lib/api-error-response'
import { runOnboardingPlanJobs } from '@/lib/onboarding-service'
import { NextRequest, NextResponse } from 'next/server'

import { planJobsRunSchema, validationErrorResponse } from '@/lib/api-validation'

export const runtime = 'nodejs'
export const maxDuration = 60

function getWorkerSecret(): string | null {
  const secret = process.env.ONBOARDING_WORKER_SECRET
  if (!secret || secret.trim().length === 0) {
    return null
  }
  return secret
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId()

  try {
    const secret = getWorkerSecret()
    if (!secret) {
      return NextResponse.json(
        {
          error: 'Worker secret is not configured.',
          code: 'worker_secret_missing',
          requestId,
        },
        { status: 503 },
      )
    }

    const incomingSecret = request.headers.get('x-onboarding-worker-secret')
    if (incomingSecret !== secret) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'unauthorized', requestId },
        { status: 401 },
      )
    }

    const rawBody = await request.json().catch(() => ({}))
    const parsedBody = planJobsRunSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return NextResponse.json(validationErrorResponse(parsedBody.error), { status: 400 })
    }

    const limit = parsedBody.data.limit

    const result = await runOnboardingPlanJobs(limit)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return createApiErrorResponse(error, {
      route: '/api/internal/plan-jobs/run',
      requestId,
      action: 'run-onboarding-plan-jobs',
      fallbackMessage: 'Failed to run onboarding plan worker.',
    })
  }
}
