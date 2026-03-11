import { NextResponse } from 'next/server'
import { normalizeApiError } from './api-error-normalization'

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

export function createRequestId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `req_${Date.now()}`
  }
}

export function createApiErrorResponse(
  error: unknown,
  context: ApiErrorResponseContext,
) {
  const normalized = normalizeApiError(error)
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
