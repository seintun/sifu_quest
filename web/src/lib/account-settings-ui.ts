export type ApiKeyProvider = 'anthropic' | 'openrouter'

export function canSaveProviderApiKey(provider: ApiKeyProvider, input: string): boolean {
  const normalized = input.trim()
  if (normalized.length === 0) return false
  if (provider === 'anthropic') {
    return normalized.startsWith('sk-ant-')
  }
  return normalized.startsWith('sk-or-')
}

export function shouldShowRemoveApiKey(hasApiKey: boolean | null | undefined): boolean {
  return Boolean(hasApiKey)
}
