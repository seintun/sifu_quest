export type NormalizedApiError = {
  status: number
  code: string
  message: string
  exposeMessage: boolean
}

export function normalizeApiError(error: unknown): NormalizedApiError {
  if (error instanceof SyntaxError) {
    const message = error.message.toLowerCase()
    if (message.includes('json') || message.includes('unexpected token')) {
      return {
        status: 400,
        code: 'invalid_json',
        message: 'Invalid JSON payload.',
        exposeMessage: true,
      }
    }
  }

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

  if (error instanceof Error) {
    const name = error.name.toLowerCase()
    const message = error.message.toLowerCase()
    const sessionLike =
      name.includes('sessiontokenerror') ||
      name.includes('jwtsessionerror') ||
      name.includes('autherror') ||
      (message.includes('session') && message.includes('expired'))

    if (sessionLike) {
      return {
        status: 401,
        code: 'auth_expired',
        message: 'Session expired. Please sign in again.',
        exposeMessage: true,
      }
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
