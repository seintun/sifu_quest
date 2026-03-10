export function canSaveAnthropicApiKey(input: string): boolean {
  const normalized = input.trim()
  return normalized.length > 0 && normalized.startsWith('sk-ant-')
}

export function shouldShowRemoveApiKey(hasApiKey: boolean | null | undefined): boolean {
  return Boolean(hasApiKey)
}
