import { NextResponse } from 'next/server'

type ApiErrorResponseContext = {
  route: string
  requestId: string
  userId?: string | null
  action?: string
  fallbackMessage?: string
  status?: number
  code?: string
  details?: Record<string, unknown>
}

type NormalizedError = {
  status: number
  code: string
  message: string
  exposeMessage: boolean
}

export function createRequestId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `req_${Date.now()}`
  }
}

function normalizeError(error: unknown): NormalizedError {
  if (error instanceof Error && error.name === 'OnboardingMigrationRequiredError') {
    return {
      status: 503,
      code: 'onboarding_schema_unavailable',
      message: error.message,
      exposeMessage: true,
    }
  }

  if (error instanceof Error && error.name === 'OnboardingValidationError') {
    return {
      status: 400,
      code: 'onboarding_validation_error',
      message: error.message,
      exposeMessage: true,
    }
  }

  if (error instanceof Error && error.message.toLowerCase().includes('unauthorized')) {
    return {
      status: 401,
      code: 'unauthorized',
      message: 'Unauthorized',
      exposeMessage: true,
    }
  }

  const fallback = error instanceof Error ? error.message : 'Unknown error'
  return {
    status: 500,
    code: 'internal_error',
    message: fallback,
    exposeMessage: false,
  }
}

export function createApiErrorResponse(
  error: unknown,
  context: ApiErrorResponseContext,
) {
  const normalized = normalizeError(error)
  const status = context.status ?? normalized.status
  const code = context.code ?? normalized.code
  const safeMessage =
    normalized.exposeMessage
      ? normalized.message
      : (context.fallbackMessage ?? 'An unexpected server error occurred.')

  console.error(`[api-error] ${context.route}`, {
    requestId: context.requestId,
    userId: context.userId ?? null,
    action: context.action ?? null,
    status,
    code,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    details: context.details ?? null,
  })

  return NextResponse.json(
    {
      error: safeMessage,
      code,
      requestId: context.requestId,
    },
    { status },
  )
}
