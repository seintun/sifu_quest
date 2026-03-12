import 'server-only'
import { createHash } from 'node:crypto'
import { unstable_cache } from 'next/cache'

import {
  ANTHROPIC_MODEL_CATALOG,
  type ChatModelDescriptor,
  type ChatModelGroupDescriptor,
  type ChatProviderDescriptor,
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_ALL_MODELS_INITIAL_LIMIT,
  OPENROUTER_RECOMMENDED_MODELS_LIMIT,
  OPENROUTER_STATIC_FREE_MODEL_FALLBACKS,
  sanitizeModelLabel,
  type OpenRouterModelScope,
  type ProviderKeyMap,
} from './chat-provider-config.ts'
import {
  buildRecommendedOpenRouterModels,
  normalizeOpenRouterModelRecords,
  type OpenRouterModelRecord,
} from './openrouter-model-catalog-utils.ts'
import { extractRankingModelIdsFromPayload } from './openrouter-ranking-utils.ts'

const OPENROUTER_MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models'
const OPENROUTER_PROGRAMMING_RANKINGS_FETCH_URL = 'https://openrouter.ai/rankings?category=programming'
const OPENROUTER_CATALOG_TTL_MS = 5 * 60 * 1000
const OPENROUTER_RANKINGS_TTL_MS = 30 * 60 * 1000
const OPENROUTER_USER_CATALOG_TTL_MS = 2 * 60 * 1000
const OPENROUTER_USER_CACHE_MAX_ENTRIES = 120

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

let openRouterCache: OpenRouterCache | null = null
let openRouterRankingsCache: OpenRouterRankingsCache | null = null
const openRouterUserCache = new Map<string, OpenRouterUserCache>()
let openRouterFreeModelsInFlight: Promise<ChatModelDescriptor[]> | null = null
let openRouterRankingsInFlight: Promise<string[]> | null = null
const openRouterUserInFlight = new Map<string, Promise<ChatModelDescriptor[]>>()

const getCachedOpenRouterFreeModels = unstable_cache(
  async () => fetchOpenRouterFreeModels(fetch),
  ['openrouter-free-models'],
  { revalidate: 300, tags: ['openrouter-model-catalog'] },
)

const getCachedOpenRouterProgrammingRanking = unstable_cache(
  async () => fetchOpenRouterProgrammingRanking(fetch),
  ['openrouter-programming-ranking'],
  { revalidate: 1800, tags: ['openrouter-model-catalog'] },
)

function buildFallbackOpenRouterModels(): ChatModelDescriptor[] {
  return OPENROUTER_STATIC_FREE_MODEL_FALLBACKS.map((id) => ({
    id,
    label: sanitizeModelLabel(id),
    provider: 'openrouter',
    isFree: true,
    availability: 'available',
  }))
}

function hashUserCacheKey(userCacheKey: string): string {
  return createHash('sha256').update(userCacheKey).digest('hex').slice(0, 24)
}

async function fetchOpenRouterProgrammingRanking(fetchImpl: typeof fetch = fetch): Promise<string[]> {
  try {
    const htmlResponse = await fetchImpl(OPENROUTER_PROGRAMMING_RANKINGS_FETCH_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    })
    if (!htmlResponse.ok) {
      return []
    }

    const payload = await htmlResponse.text()
    return extractRankingModelIdsFromPayload(payload)
  } catch (error) {
    console.warn('OpenRouter programming ranking fetch failed; returning empty ranking list and keeping default catalog order', error)
    return []
  }
}

async function getOpenRouterProgrammingRanking(fetchImpl: typeof fetch = fetch): Promise<string[]> {
  if (fetchImpl === fetch) {
    return getCachedOpenRouterProgrammingRanking()
  }

  const now = Date.now()
  if (openRouterRankingsCache && openRouterRankingsCache.expiresAt > now) {
    return openRouterRankingsCache.modelOrder
  }

  if (openRouterRankingsInFlight) {
    return openRouterRankingsInFlight
  }

  openRouterRankingsInFlight = fetchOpenRouterProgrammingRanking(fetchImpl)
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

function pruneExpiredOpenRouterUserCache(now: number): void {
  for (const [key, entry] of openRouterUserCache.entries()) {
    if (entry.expiresAt <= now) {
      openRouterUserCache.delete(key)
    }
  }

  if (openRouterUserCache.size <= OPENROUTER_USER_CACHE_MAX_ENTRIES) return

  const entries = [...openRouterUserCache.entries()]
    .sort((a, b) => a[1].expiresAt - b[1].expiresAt)

  const toDelete = openRouterUserCache.size - OPENROUTER_USER_CACHE_MAX_ENTRIES
  for (let index = 0; index < toDelete; index += 1) {
    const [key] = entries[index]
    openRouterUserCache.delete(key)
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
  pruneExpiredOpenRouterUserCache(now)

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

export async function buildProviderCatalog(
  input: BuildProviderCatalogInput,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderCatalogResult> {
  const [freeOpenRouterModels, dynamicProgrammingOrder] = await Promise.all([
    getOpenRouterFreeModels(fetchImpl),
    getOpenRouterProgrammingRanking(fetchImpl),
  ])

  let openRouterModels = freeOpenRouterModels
  if (input.openRouterModelScope === 'full_catalog' && input.userCacheKey && input.openRouterApiKey) {
    try {
      const fullModels = await getOpenRouterFullModelsForUser(input.userCacheKey, input.openRouterApiKey, fetchImpl)
      if (fullModels.length > 0) {
        openRouterModels = fullModels
      }
    } catch (error) {
      console.warn('Falling back to free OpenRouter model catalog for user-scoped query', error)
    }
  }

  const query = input.openRouterQuery?.trim().toLowerCase()
  const filteredOpenRouterModels = query
    ? openRouterModels.filter((model) => model.id.toLowerCase().includes(query) || model.label.toLowerCase().includes(query))
    : openRouterModels

  const includeAll = Boolean(input.includeAllOpenRouterModels)
  const openRouterModelsForDropdown = includeAll
    ? filteredOpenRouterModels
    : filteredOpenRouterModels.slice(0, OPENROUTER_ALL_MODELS_INITIAL_LIMIT)
  const recommendedOpenRouterModels = buildRecommendedOpenRouterModels(
    openRouterModelsForDropdown,
    dynamicProgrammingOrder,
    OPENROUTER_RECOMMENDED_MODELS_LIMIT,
  )
  const openRouterFreeModelsForDropdown = openRouterModelsForDropdown.filter((model) => model.isFree)

  const anthropicModels = ANTHROPIC_MODEL_CATALOG.map<ChatModelDescriptor>((model) => ({
    id: model.id,
    label: model.label,
    provider: 'anthropic',
    isFree: false,
    availability: input.providerKeys.anthropic ? 'available' : 'requires_key',
    reason: input.providerKeys.anthropic ? undefined : 'Add Anthropic BYOK in Settings for unlimited AI chat.',
  }))

  return {
    providers: [
      {
        id: 'openrouter',
        label: 'OpenRouter',
        availability: 'available',
      },
      {
        id: 'anthropic',
        label: 'Anthropic',
        availability: input.providerKeys.anthropic ? 'available' : 'requires_key',
        reason: input.providerKeys.anthropic ? undefined : 'Add Anthropic BYOK in Settings for unlimited AI chat.',
      },
    ],
    modelsByProvider: {
      openrouter: openRouterModelsForDropdown,
      anthropic: anthropicModels,
    },
    modelGroupsByProvider: {
      openrouter: [
        {
          id: 'recommended',
          label: 'Recommended for Coding',
          models: recommendedOpenRouterModels,
        },
        {
          id: 'free',
          label: 'Free Models',
          models: openRouterFreeModelsForDropdown,
        },
        {
          id: 'all',
          label: 'All OpenRouter Models',
          models: openRouterModelsForDropdown,
          hasMore: !includeAll && filteredOpenRouterModels.length > openRouterModelsForDropdown.length,
        },
      ],
      anthropic: [
        {
          id: 'all',
          label: 'Anthropic Models',
          models: anthropicModels,
        },
      ],
    },
    defaults: {
      provider: 'openrouter',
      model: recommendedOpenRouterModels[0]?.id ?? openRouterModelsForDropdown[0]?.id ?? DEFAULT_OPENROUTER_MODEL,
    },
  }
}
