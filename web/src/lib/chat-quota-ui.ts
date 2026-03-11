export type ChatFreeQuota = {
  isFreeTier: boolean
  remaining: number
  total: number
  isGuest?: boolean
}

type QuotaBlockingErrorCode = 'missing_api_key' | 'guest_limit_reached' | 'session_expired'

function isQuotaBlockingErrorCode(errorCode: string | null): errorCode is QuotaBlockingErrorCode {
  return errorCode === 'missing_api_key' || errorCode === 'guest_limit_reached' || errorCode === 'session_expired'
}

export function applyQuotaOnChatError(
  previousQuota: ChatFreeQuota | null,
  errorCode: string | null,
): ChatFreeQuota | null {
  if (!previousQuota || !previousQuota.isFreeTier) {
    return previousQuota
  }

  if (!isQuotaBlockingErrorCode(errorCode)) {
    return previousQuota
  }

  return {
    ...previousQuota,
    remaining: 0,
  }
}
