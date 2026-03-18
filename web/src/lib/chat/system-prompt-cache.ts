/**
 * In-memory cache for system prompts to avoid rebuilding on every request.
 *
 * Cache key: `${userId}:${mode}:${isGreeting ? 'greeting' : 'normal'}`
 * TTL: 5 minutes for normal prompts, 2 minutes for greetings
 *
 * NOTE: In serverless environments, cache is per-instance and resets on cold starts.
 * This is acceptable since rebuilding the prompt is cheap, and the cache mainly helps
 * with burst traffic to the same instance.
 */

type CacheEntry = {
  prompt: string
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

const NORMAL_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const GREETING_CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes (shorter since onboarding state can change)
const MAX_CACHE_SIZE = 100

function evictExpired() {
  const now = Date.now()
  for (const [key, entry] of cache) {
    if (now > entry.expiresAt) {
      cache.delete(key)
    }
  }
}

function makeCacheKey(
  userId: string,
  mode: string | undefined,
  isGreeting: boolean | undefined,
): string {
  return `${userId}:${mode ?? 'default'}:${isGreeting ? 'greeting' : 'normal'}`
}

export function getCachedSystemPrompt(
  userId: string,
  mode: string | undefined,
  isGreeting: boolean | undefined,
): string | null {
  const key = makeCacheKey(userId, mode, isGreeting)
  const entry = cache.get(key)

  if (!entry) {
    return null
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }

  return entry.prompt
}

export function setCachedSystemPrompt(
  userId: string,
  mode: string | undefined,
  isGreeting: boolean | undefined,
  prompt: string,
): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    evictExpired()
  }

  const key = makeCacheKey(userId, mode, isGreeting)
  const ttl = isGreeting ? GREETING_CACHE_TTL_MS : NORMAL_CACHE_TTL_MS

  cache.set(key, {
    prompt,
    expiresAt: Date.now() + ttl,
  })
}

/**
 * Invalidate all cached prompts for a user.
 * Call this when memory files change for the user.
 */
export function invalidateSystemPromptCache(userId: string): void {
  const prefix = `${userId}:`
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
    }
  }
}

/**
 * Invalidate only greeting cache entries for a user.
 * Use when onboarding status changes.
 */
export function invalidateGreetingCacheForUser(userId: string): void {
  const prefix = `${userId}:`
  for (const key of cache.keys()) {
    if (key.startsWith(prefix) && key.endsWith(':greeting')) {
      cache.delete(key)
    }
  }
}
