const envLimit = Number(process.env.NEXT_PUBLIC_FREE_TIER_MAX_MESSAGES)
export const FREE_TIER_MAX_USER_MESSAGES = isNaN(envLimit) ? 25 : envLimit
