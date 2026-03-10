export const TRIAL_MESSAGE_LIMIT = 5
export const TRIAL_WINDOW_MS = 30 * 60 * 1000

export type TrialCheckInput = {
  trialStartedAt: string | null
  trialMessagesUsed: number
  now?: Date
}

export type TrialCheckResult = {
  allowed: boolean
  code?: 'trial_limit_reached' | 'trial_expired'
  remainingMessages: number
  expiresAt: string | null
}

export function evaluateTrialEntitlement(input: TrialCheckInput): TrialCheckResult {
  const now = input.now ?? new Date()
  const remainingMessages = Math.max(TRIAL_MESSAGE_LIMIT - input.trialMessagesUsed, 0)
  const expiresAt = input.trialStartedAt
    ? new Date(new Date(input.trialStartedAt).getTime() + TRIAL_WINDOW_MS).toISOString()
    : null

  if (input.trialMessagesUsed >= TRIAL_MESSAGE_LIMIT) {
    return {
      allowed: false,
      code: 'trial_limit_reached',
      remainingMessages: 0,
      expiresAt,
    }
  }

  if (!input.trialStartedAt) {
    return {
      allowed: true,
      remainingMessages,
      expiresAt: null,
    }
  }

  const trialStart = new Date(input.trialStartedAt)
  const expiresAtDate = new Date(trialStart.getTime() + TRIAL_WINDOW_MS)
  const computedExpiresAt = expiresAtDate.toISOString()

  if (now.getTime() > expiresAtDate.getTime()) {
    return {
      allowed: false,
      code: 'trial_expired',
      remainingMessages,
      expiresAt: computedExpiresAt,
    }
  }

  return {
    allowed: true,
    remainingMessages,
    expiresAt: computedExpiresAt,
  }
}
