import 'server-only'

const envLimit = Number(process.env.FREE_TIER_MAX_MESSAGES)
export const FREE_TIER_MAX_USER_MESSAGES = isNaN(envLimit) ? 25 : envLimit

const envExpiry = Number(process.env.GUEST_EXPIRY_MS)
export const GUEST_SESSION_EXPIRY_MS = isNaN(envExpiry) ? 2 * 60 * 60 * 1000 : envExpiry
