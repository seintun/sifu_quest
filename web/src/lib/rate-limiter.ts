/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window approach with per-user tracking.
 *
 * NOTE: In serverless environments (Vercel), this is best-effort only.
 * Each function instance maintains its own state. For production-grade
 * rate limiting, consider Redis-based solutions like Upstash Ratelimit.
 */

type RateLimitEntry = {
  timestamps: number[]
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up stale entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanupStaleEntries(windowMs: number): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return
  }
  lastCleanup = now

  for (const [key, entry] of rateLimitStore) {
    entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs)
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key)
    }
  }
}

export type RateLimitConfig = {
  /** Maximum number of requests allowed in the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

/**
 * Check if a request is allowed under the rate limit.
 *
 * @param key - Unique identifier for the rate limit (e.g., user ID)
 * @param config - Rate limit configuration
 * @returns Result indicating if request is allowed
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const { maxRequests, windowMs } = config
  const now = Date.now()

  cleanupStaleEntries(windowMs)

  let entry = rateLimitStore.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    rateLimitStore.set(key, entry)
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs)

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfterMs = oldestInWindow + windowMs - now
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, retryAfterMs),
    }
  }

  entry.timestamps.push(now)
  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    retryAfterMs: 0,
  }
}

/**
 * Chat-specific rate limit: 30 requests per minute per user.
 * Reasonable for interactive coaching sessions.
 */
export const CHAT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60 * 1000, // 1 minute
}
