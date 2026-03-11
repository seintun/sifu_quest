export type ProviderApiKeyDbError = {
  code?: string | null
  message?: string | null
}

export class ProviderApiKeyStoreError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'ProviderApiKeyStoreError'
    this.code = code
  }
}

export function toProviderApiKeyStoreError(
  context: string,
  error: ProviderApiKeyDbError,
): ProviderApiKeyStoreError {
  const message = error.message ?? 'unknown database error'
  return new ProviderApiKeyStoreError(`${context}: ${message}`, error.code ?? undefined)
}
