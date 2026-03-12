import 'server-only'
import { createHash } from 'node:crypto'
import { unstable_cache } from 'next/cache'

import {
  ANTHROPIC_MODEL_CATALOG,
  type ChatModelDescriptor,
  type ChatModelGroupDescriptor,
  type ChatProviderDescriptor,
  DEFAULT_OPENROUTER_MODEL,
  generateModelId,
  OPENROUTER_ALL_MODELS_INITIAL_LIMIT,
  OPENROUTER_RANKING_TOP_MODELS_LIMIT,
  OPENROUTER_RECOMMENDED_MODELS_LIMIT,
  OPENROUTER_STATIC_FREE_MODEL_FALLBACKS,
  sanitizeModelLabel,
  stripModelDateSuffix,
  type OpenRouterModelScope,
  type ProviderKeyMap,
} from './chat-provider-config.ts'
import {
  buildRecommendedOpenRouterModels,
  normalizeOpenRouterModelRecords,
  sortAndAnnotateOpenRouterModelsByRanking,
  type OpenRouterModelRecord,
} from './openrouter-model-catalog-utils.ts'
import { extractRankingModelIdsFromPayload } from './openrouter-ranking-utils.ts'

const OPENROUTER_MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models'

// Single source of truth: weekly rankings JSON endpoint
const OPENROUTER_RANKING_URL = 'https://openrouter.ai/rankings?view=week'

const OPENROUTER_CATALOG_TTL_MS = 5 * 60 * 1000          // 5 min
const OPENROUTER_RANKINGS_TTL_MS = 30 * 60 * 1000       // 30 min
const OPENROUTER_USER_CATALOG_TTL_MS = 2 * 60 * 1000    // 2 min
const OPENROUTER_USER_CACHE_MAX_ENTRIES = 120
const RANKING_FETCH_TIMEOUT_MS = 2500

type OpenRouterCatalogResponse = {
  data?: OpenRouterModelRecord[]
}

type OpenRouterCache = {
  models: ChatModelDescriptor[]
  expiresAt: number
}

type OpenRouterRankingsCache = {
  modelOrder: string[]
  expiresAt: number
}

type OpenRouterUserCache = {
  models: ChatModelDescriptor[]
  expiresAt: number
}

export type ProviderCatalogResult = {
  providers: ChatProviderDescriptor[]
  modelsByProvider: Record<'openrouter' | 'anthropic', ChatModelDescriptor[]>
  modelGroupsByProvider: Record<'openrouter' | 'anthropic', ChatModelGroupDescriptor[]>
  defaults: {
    provider: 'openrouter' | 'anthropic'
    model: string
  }
}

export type BuildProviderCatalogInput = {
  providerKeys: ProviderKeyMap
  openRouterModelScope: OpenRouterModelScope
  includeAllOpenRouterModels?: boolean
  openRouterQuery?: string | null
  userCacheKey?: string | null
  openRouterApiKey?: string | null
}

// In-memory caches (for non-cache API calls)
let openRouterCache: OpenRouterCache | null = null
let openRouterRankingsCache: OpenRouterRankingsCache | null = null
const openRouterUserCache = new Map<string, OpenRouterUserCache>()

// In-flight request deduplication
let openRouterFreeModelsInFlight: Promise<ChatModelDescriptor[]> | null = null
let openRouterRankingsInFlight: Promise<string[]> | null = null
const openRouterUserInFlight = new Map<string, Promise<ChatModelDescriptor[]>>()

// Next.js cache wrapper for production
const getCachedOpenRouterFreeModels = unstable_cache(
  async () => fetchOpenRouterFreeModels(fetch),
  ['openrouter-free-models'],
  { revalidate: 300, tags: ['openrouter-model-catalog'] },
)

const getCachedOpenRouterRanking = unstable_cache(
  async () => fetchOpenRouterRanking(fetch),
  ['openrouter-ranking'],
  { revalidate: 1800, tags: ['openrouter-model-catalog'] },
)

function buildFallbackOpenRouterModels(): ChatModelDescriptor[] {
  return OPENROUTER_STATIC_FREE_MODEL_FALLBACKS.map((id) => ({
    id,
    label: sanitizeModelLabel(id),
    modelId: generateModelId(id),
    provider: 'openrouter',
    isFree: true,
    availability: 'available',
  }))
}

function hashUserCacheKey(userCacheKey: string): string {
  return createHash('sha256').update(userCacheKey).digest('hex').slice(0, 24)
}

/**
 * Parse model IDs from JSON ranking response (handles various payload shapes)
 */
function parseRankingIdsFromJsonPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []

  const result: string[] = []
  const seen = new Set<string>()

  const visit = (value: unknown): void => {
    if (!value) return
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }
    if (typeof value !== 'object') return

    const record = value as Record<string, unknown>
    const modelId = [record.variant_permaslug, record.model, record.model_id, record.id]
      .find((candidate) => typeof candidate === 'string')

    if (typeof modelId === 'string') {
      const normalized = stripModelDateSuffix(modelId.trim().toLowerCase())
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized)
        result.push(normalized)
      }
    }

    // Recursively visit nested objects/arrays
    for (const nested of Object.values(record)) {
      if (Array.isArray(nested) || (nested && typeof nested === 'object')) {
        visit(nested)
      }
    }
  }

  visit(payload)
  return result
}

/**
 * Fetch ranking from OpenRouter (single source of truth)
 */
async function fetchOpenRouterRanking(fetchImpl: typeof fetch = fetch): Promise<string[]> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), RANKING_FETCH_TIMEOUT_MS)

    const response = await fetchImpl(OPENROUTER_RANKING_URL, {
      method: 'GET',
      cache: 'no-store',
      headers: { accept: 'application/json, text/html;q=0.9' },
      signal: controller.signal as AbortSignal,
    })

    clearTimeout(timeoutId)
    if (!response.ok) {
      console.warn('OpenRouter ranking fetch failed', { status: response.status })
      return []
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''

    // Prefer JSON response
    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => null)
      return parseRankingIdsFromJsonPayload(payload)
    }

    // Fallback to HTML parsing
    const payload = await response.text()
    return extractRankingModelIdsFromPayload(payload)
  } catch (error) {
    console.warn('OpenRouter ranking fetch failed', error)
    return []
  }
}

/**
 * Get rankings with in-memory cache fallback
 */
async function getOpenRouterRanking(fetchImpl: typeof fetch = fetch): Promise<string[]> {
  // Use Next.js cache in production
  if (fetchImpl === fetch) {
    return getCachedOpenRouterRanking()
  }

  // Manual cache for testing/custom fetch
  const now = Date.now()
  if (openRouterRankingsCache && openRouterRankingsCache.expiresAt > now) {
    return openRouterRankingsCache.modelOrder
  }

  if (openRouterRankingsInFlight) {
    return openRouterRankingsInFlight
  }

  openRouterRankingsInFlight = fetchOpenRouterRanking(fetchImpl)

  let modelOrder: string[]
  try {
    modelOrder = await openRouterRankingsInFlight
  } finally {
    openRouterRankingsInFlight = null
  }

  openRouterRankingsCache = {
    modelOrder,
    expiresAt: now + OPENROUTER_RANKINGS_TTL_MS,
  }
  return modelOrder
}

/**
 * Prune expired entries from user cache to prevent memory bloat
 */
function pruneExpiredUserCache(now: number): void {
  for (const [key, entry] of openRouterUserCache.entries()) {
    if (entry.expiresAt <= now) {
      openRouterUserCache.delete(key)
    }
  }

  if (openRouterUserCache.size <= OPENROUTER_USER_CACHE_MAX_ENTRIES) return

  // Remove oldest entries
  const entries = [...openRouterUserCache.entries()]
    .sort((a, b) => a[1].expiresAt - b[1].expiresAt)

  const toDelete = openRouterUserCache.size - OPENROUTER_USER_CACHE_MAX_ENTRIES
  for (let i = 0; i < toDelete; i++) {
    openRouterUserCache.delete(entries[i][0])
  }
}

async function fetchOpenRouterModels(
  fetchImpl: typeof fetch = fetch,
  apiKey?: string | null,
): Promise<ChatModelDescriptor[]> {
  const headers: Record<string, string> = {}
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  const response = await fetchImpl(OPENROUTER_MODELS_ENDPOINT, {
    method: 'GET',
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(7000),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter catalog request failed with ${response.status}`)
  }

  const payload = (await response.json()) as OpenRouterCatalogResponse
  return normalizeOpenRouterModelRecords(payload.data ?? [])
}

async function fetchOpenRouterFreeModels(fetchImpl: typeof fetch = fetch): Promise<ChatModelDescriptor[]> {
  try {
    const allModels = await fetchOpenRouterModels(fetchImpl)
    const freeModels = allModels.filter((model) => model.isFree)
    return freeModels.length > 0 ? freeModels : buildFallbackOpenRouterModels()
  } catch (error) {
    console.warn('Falling back to static OpenRouter free model catalog', error)
    return buildFallbackOpenRouterModels()
  }
}

export async function getOpenRouterFreeModels(fetchImpl: typeof fetch = fetch): Promise<ChatModelDescriptor[]> {
  if (fetchImpl === fetch) {
    return getCachedOpenRouterFreeModels()
  }

  const now = Date.now()
  if (openRouterCache && openRouterCache.expiresAt > now) {
    return openRouterCache.models
  }

  if (openRouterFreeModelsInFlight) {
    return openRouterFreeModelsInFlight
  }

  openRouterFreeModelsInFlight = fetchOpenRouterFreeModels(fetchImpl)

  let models: ChatModelDescriptor[]
  try {
    models = await openRouterFreeModelsInFlight
  } finally {
    openRouterFreeModelsInFlight = null
  }

  openRouterCache = {
    models,
    expiresAt: now + OPENROUTER_CATALOG_TTL_MS,
  }
  return models
}

async function getOpenRouterFullModelsForUser(
  userCacheKey: string,
  openRouterApiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ChatModelDescriptor[]> {
  const now = Date.now()
  pruneExpiredUserCache(now)

  const hashedKey = hashUserCacheKey(userCacheKey)
  const cached = openRouterUserCache.get(hashedKey)
  if (cached && cached.expiresAt > now) {
    return cached.models
  }

  const inFlight = openRouterUserInFlight.get(hashedKey)
  if (inFlight) {
    return inFlight
  }

  const nextFetch = fetchOpenRouterModels(fetchImpl, openRouterApiKey)
  openRouterUserInFlight.set(hashedKey, nextFetch)

  let models: ChatModelDescriptor[]
  try {
    models = await nextFetch
  } finally {
    openRouterUserInFlight.delete(hashedKey)
  }

  openRouterUserCache.set(hashedKey, {
    models,
    expiresAt: now + OPENROUTER_USER_CATALOG_TTL_MS,
  })
  return models
}

/**
 * Build the complete provider catalog with rankings
 */
export async function buildProviderCatalog(
  input: BuildProviderCatalogInput,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderCatalogResult> {
  // Parallel fetch: free models + rankings (both can load simultaneously)
  const [freeOpenRouterModels, dynamicOrder] = await Promise.all([
    getOpenRouterFreeModels(fetchImpl),
    getOpenRouterRanking(fetchImpl),
  ])

  // Get user-specific full catalog if needed
  let openRouterModels = freeOpenRouterModels
  if (input.openRouterModelScope === 'full_catalog' && input.userCacheKey && input.openRouterApiKey) {
    try {
      const fullModels = await getOpenRouterFullModelsForUser(
        input.userCacheKey,
        input.openRouterApiKey,
        fetchImpl,
      )
      if (fullModels.length > 0) {
        openRouterModels = fullModels
      }
    } catch (error) {
      console.warn('Falling back to free OpenRouter model catalog', error)
    }
  }

  // Filter by query if provided
  const query = input.openRouterQuery?.trim().toLowerCase()
  const filteredModels = query
    ? openRouterModels.filter(
        (m) => m.id.toLowerCase().includes(query) || m.label.toLowerCase().includes(query),
      )
    : openRouterModels

  // Sort and annotate with rankings
  const rankedModels = sortAndAnnotateOpenRouterModelsByRanking(filteredModels, dynamicOrder)

  // Prepare model lists
  const includeAll = Boolean(input.includeAllOpenRouterModels)
  const allModelsForDropdown = includeAll
    ? rankedModels
    : rankedModels.slice(0, OPENROUTER_ALL_MODELS_INITIAL_LIMIT)

  const recommendedModels = buildRecommendedOpenRouterModels(
    rankedModels,
    dynamicOrder,
    Math.min(OPENROUTER_RANKING_TOP_MODELS_LIMIT, OPENROUTER_RECOMMENDED_MODELS_LIMIT),
  )

  // Build free models list (deduplicate: prefer :free variants)
  const freeModelIds = new Set(
    rankedModels
      .filter((m) => m.isFree)
      .map((m) => m.id.toLowerCase()),
  )

  const freeModelsForDropdown = rankedModels
    .filter((model) => {
      if (!model.isFree) return false
      const idLower = model.id.toLowerCase()

      // Always include :free variants
      if (idLower.endsWith(':free')) return true

      // Exclude base model if :free version exists
      const freeVersionId = `${idLower}:free`
      return !freeModelIds.has(freeVersionId)
    })
    .slice(0, OPENROUTER_RANKING_TOP_MODELS_LIMIT)

  // Build Anthropic models
  const anthropicModels = ANTHROPIC_MODEL_CATALOG.map<ChatModelDescriptor>((model) => ({
    id: model.id,
    label: model.label,
    modelId: generateModelId(model.id),
    provider: 'anthropic',
    isFree: false,
    availability: input.providerKeys.anthropic ? 'available' : 'requires_key',
    reason: input.providerKeys.anthropic ? undefined : 'Add Anthropic BYOK in Settings for unlimited AI chat.',
  }))

  const defaultModelId = recommendedModels[0]?.id
    ?? allModelsForDropdown[0]?.id
    ?? DEFAULT_OPENROUTER_MODEL

  return {
    providers: [
      { id: 'openrouter', label: 'OpenRouter', availability: 'available' },
      {
        id: 'anthropic',
        label: 'Anthropic',
        availability: input.providerKeys.anthropic ? 'available' : 'requires_key',
        reason: input.providerKeys.anthropic ? undefined : 'Add Anthropic BYOK in Settings for unlimited AI chat.',
      },
    ],
    modelsByProvider: {
      openrouter: allModelsForDropdown,
      anthropic: anthropicModels,
    },
    modelGroupsByProvider: {
      openrouter: [
        { id: 'recommended', label: 'Recommended for Coding', models: recommendedModels },
        { id: 'free', label: 'Free Models', models: freeModelsForDropdown },
        {
          id: 'all',
          label: 'All OpenRouter Models',
          models: allModelsForDropdown,
          hasMore: !includeAll && rankedModels.length > allModelsForDropdown.length,
        },
      ],
      anthropic: [
        { id: 'all', label: 'Anthropic Models', models: anthropicModels },
      ],
    },
    defaults: {
      provider: 'openrouter',
      model: defaultModelId,
    },
  }
}
