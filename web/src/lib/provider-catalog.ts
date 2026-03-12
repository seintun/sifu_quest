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
import { extractRankingModelIdsFromPayload } from './openrouter-ranking-utils.ts'

const OPENROUTER_MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models'
const OPENROUTER_PROGRAMMING_RANKINGS_FETCH_URL = 'https://openrouter.ai/rankings?category=programming'
const OPENROUTER_CATALOG_TTL_MS = 5 * 60 * 1000
const OPENROUTER_RANKINGS_TTL_MS = 30 * 60 * 1000
const OPENROUTER_USER_CATALOG_TTL_MS = 2 * 60 * 1000

type OpenRouterModelRecord = {
  id?: string
}

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

function normalizeOpenRouterModelRecords(records: OpenRouterModelRecord[]): ChatModelDescriptor[] {
  const seen = new Set<string>()
  return records
    .map((record) => (typeof record.id === 'string' ? record.id.trim() : ''))
    .filter((id) => id.length > 0)
    .filter((id) => {
      const key = id.toLowerCase()
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    .map<ChatModelDescriptor>((id) => ({
      id,
      label: sanitizeModelLabel(id),
      provider: 'openrouter',
      isFree: id.endsWith(':free'),
      availability: 'available',
    }))
}

function sortAndAnnotateOpenRouterModels(
  models: ChatModelDescriptor[],
  dynamicOrder: readonly string[] = [],
): ChatModelDescriptor[] {
  if (dynamicOrder.length === 0) {
    return [...models].sort((a, b) => a.label.localeCompare(b.label))
  }

  const rankById = new Map<string, number>(dynamicOrder.map((id, index) => [id.toLowerCase(), index + 1]))

  return models
    .map((model) => {
      const rank = rankById.get(model.id.toLowerCase())
      return rank ? { ...model, recommendationRank: rank } : model
    })
    .sort((a, b) => {
      const rankA = a.recommendationRank ?? Number.MAX_SAFE_INTEGER
      const rankB = b.recommendationRank ?? Number.MAX_SAFE_INTEGER
      if (rankA !== rankB) return rankA - rankB
      return a.label.localeCompare(b.label)
    })
}

function hashUserCacheKey(userCacheKey: string): string {
  return createHash('sha256').update(userCacheKey).digest('hex').slice(0, 24)
}

async function fetchOpenRouterProgrammingRanking(fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const fetchOptions: Omit<RequestInit, 'signal'> = {
    method: 'GET',
    cache: 'no-store',
  }

  try {
    const rscResponse = await fetchImpl(OPENROUTER_PROGRAMMING_RANKINGS_FETCH_URL, {
      ...fetchOptions,
      signal: AbortSignal.timeout(3500),
      headers: { RSC: '1' },
    })

    if (rscResponse.ok) {
      const payload = await rscResponse.text()
      const extracted = extractRankingModelIdsFromPayload(payload)
      if (extracted.length > 0) return extracted
    }

    const htmlResponse = await fetchImpl(OPENROUTER_PROGRAMMING_RANKINGS_FETCH_URL, {
      ...fetchOptions,
      signal: AbortSignal.timeout(3500),
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

  const modelOrder = await fetchOpenRouterProgrammingRanking(fetchImpl)
  openRouterRankingsCache = {
    modelOrder,
    expiresAt: now + OPENROUTER_RANKINGS_TTL_MS,
  }
  return modelOrder
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

  const models = await fetchOpenRouterFreeModels(fetchImpl)
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
  const hashedKey = hashUserCacheKey(userCacheKey)
  const cached = openRouterUserCache.get(hashedKey)
  if (cached && cached.expiresAt > now) {
    return cached.models
  }

  const models = await fetchOpenRouterModels(fetchImpl, openRouterApiKey)
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

  const rankedOpenRouterModels = sortAndAnnotateOpenRouterModels(openRouterModels, dynamicProgrammingOrder)
  const query = input.openRouterQuery?.trim().toLowerCase()
  const filteredOpenRouterModels = query
    ? rankedOpenRouterModels.filter((model) => model.id.toLowerCase().includes(query) || model.label.toLowerCase().includes(query))
    : rankedOpenRouterModels

  const recommendedOpenRouterModels = filteredOpenRouterModels
    .filter((model) => typeof model.recommendationRank === 'number')
    .slice(0, OPENROUTER_RECOMMENDED_MODELS_LIMIT)

  if (recommendedOpenRouterModels.length === 0 && filteredOpenRouterModels.length > 0) {
    recommendedOpenRouterModels.push(...filteredOpenRouterModels.slice(0, Math.min(10, filteredOpenRouterModels.length)))
  }

  const includeAll = Boolean(input.includeAllOpenRouterModels)
  const openRouterModelsForDropdown = includeAll
    ? filteredOpenRouterModels
    : filteredOpenRouterModels.slice(0, OPENROUTER_ALL_MODELS_INITIAL_LIMIT)

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
      model: openRouterModelsForDropdown[0]?.id ?? DEFAULT_OPENROUTER_MODEL,
    },
  }
}
