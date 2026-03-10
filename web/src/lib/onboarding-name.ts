const ONBOARDING_MAX_FULL_NAME_LENGTH = 80

function normalizeName(input: string): string {
  return input.trim().replace(/\s+/g, ' ')
}

export function getOnboardingPrefillName(
  displayName: string | null | undefined,
  prefillName: string | null | undefined,
): string {
  const normalizedDisplayName = typeof displayName === 'string' ? displayName.trim() : ''
  if (normalizedDisplayName) {
    return normalizedDisplayName
  }

  const normalizedPrefillName = typeof prefillName === 'string' ? prefillName.trim() : ''
  if (normalizedPrefillName) {
    return normalizedPrefillName
  }

  return ''
}

export function getPersistableOnboardingDisplayName(name: unknown): string | null {
  if (typeof name !== 'string') {
    return null
  }

  const normalized = normalizeName(name)
  if (!normalized) {
    return null
  }

  if (normalized.length > ONBOARDING_MAX_FULL_NAME_LENGTH) {
    return null
  }

  return normalized
}
